const { expect } = require('chai');
const sinon = require('sinon');

const {
    buildTelemetryEvent,
    configureDatabaseTelemetry,
    findDocumentsByIds,
    runTelemetryAwareBulkWrite
} = require('../src/utils/databaseTelemetry');
const { requestContextMiddleware } = require('../src/utils/requestContext');

function runWithRequestContext(req, callback) {
    return new Promise((resolve, reject) => {
        requestContextMiddleware(req, {}, async (error) => {
            if (error) {
                reject(error);
                return;
            }

            try {
                resolve(await callback());
            } catch (callbackError) {
                reject(callbackError);
            }
        });
    });
}

describe('Database telemetry', () => {
    afterEach(() => {
        sinon.restore();
        configureDatabaseTelemetry();
    });

    it('builds telemetry events with request actor and request metadata', async () => {
        const event = await runWithRequestContext({
            method: 'patch',
            originalUrl: '/api/alerts/alert-1',
            ip: '10.0.0.5',
            headers: {
                'x-forwarded-for': '203.0.113.15, 10.0.0.5',
                'user-agent': 'telemetry-test'
            },
            get(headerName) {
                return this.headers[String(headerName).toLowerCase()];
            },
            user: {
                _id: 'user-42',
                email: 'user42@example.com'
            }
        }, () => buildTelemetryEvent({
            modelName: 'SecurityAlert',
            action: 'update',
            operation: 'updateOne',
            documentId: 'alert-1',
            before: { id: 'alert-1' },
            after: { id: 'alert-1' },
            changeSet: { changedPaths: ['response.level'] }
        }));

        expect(event.category).to.equal('db-state-change');
        expect(event.who).to.deep.equal({
            type: 'user',
            userId: 'user-42',
            email: 'user42@example.com'
        });
        expect(event.what.model).to.equal('SecurityAlert');
        expect(event.what.action).to.equal('update');
        expect(event.where.channel).to.equal('http');
        expect(event.where.method).to.equal('PATCH');
        expect(event.where.path).to.equal('/api/alerts/alert-1');
        expect(event.where.ip).to.equal('203.0.113.15');
        expect(event.where.userAgent).to.equal('telemetry-test');
        expect(event.where.requestId).to.be.a('string').and.not.empty;
        expect(event.how).to.deep.equal({
            mechanism: 'updateOne',
            telemetryVersion: 1
        });
    });

    it('emits telemetry for bulk updates using before and after document snapshots', async () => {
        const audit = sinon.stub().resolves(true);
        configureDatabaseTelemetry({
            client: {
                enabled: true,
                audit
            }
        });

        const model = {
            find: sinon.stub()
                .onFirstCall()
                .returns({
                    lean: async () => ([{ _id: 'alert-9', status: 'queued', severity: 'high' }])
                })
                .onSecondCall()
                .returns({
                    lean: async () => ([{ _id: 'alert-9', status: 'closed', severity: 'high' }])
                }),
            findById: sinon.stub().returns({
                lean: async () => ({ _id: 'alert-9', status: 'closed', severity: 'high' })
            }),
            bulkWrite: sinon.stub().resolves({ modifiedCount: 1 })
        };

        await runWithRequestContext({
            method: 'post',
            originalUrl: '/api/automation/respond',
            ip: '198.51.100.30',
            headers: {
                'user-agent': 'bulk-telemetry-test'
            },
            get(headerName) {
                return this.headers[String(headerName).toLowerCase()];
            },
            user: {
                _id: 'analyst-7',
                email: 'analyst7@example.com'
            }
        }, async () => {
            await runTelemetryAwareBulkWrite({
                model,
                modelName: 'SecurityAlert',
                operations: [{
                    updateOne: {
                        filter: { _id: 'alert-9' },
                        update: {
                            $set: {
                                status: 'closed'
                            }
                        }
                    }
                }],
                bulkWriteOptions: { ordered: false }
            });
        });

        expect(model.bulkWrite.calledOnce).to.equal(true);
        expect(audit.calledOnce).to.equal(true);
        expect(audit.firstCall.args[0]).to.equal('Database state changed');
        expect(audit.firstCall.args[1].what).to.include({
            model: 'SecurityAlert',
            action: 'update',
            documentId: 'alert-9'
        });
        expect(audit.firstCall.args[1].what.changeSet.changedPaths).to.deep.equal(['status']);
        expect(audit.firstCall.args[1].what.before.id).to.equal('alert-9');
        expect(audit.firstCall.args[1].what.after.id).to.equal('alert-9');
        expect(audit.firstCall.args[1].who.userId).to.equal('analyst-7');
        expect(audit.firstCall.args[1].where.path).to.equal('/api/automation/respond');
    });

    it('still executes bulkWrite when the caller does not expose query helpers', async () => {
        const audit = sinon.stub().resolves(true);
        configureDatabaseTelemetry({
            client: {
                enabled: true,
                audit
            }
        });

        const model = {
            bulkWrite: sinon.stub().resolves({ modifiedCount: 1 })
        };

        const result = await runTelemetryAwareBulkWrite({
            model,
            modelName: 'SecurityAlert',
            operations: [{
                updateOne: {
                    filter: { _id: 'alert-11' },
                    update: {
                        $set: {
                            status: 'closed'
                        }
                    }
                }
            }],
            bulkWriteOptions: { ordered: false }
        });

        expect(result).to.deep.equal({ modifiedCount: 1 });
        expect(model.bulkWrite.calledOnce).to.equal(true);
        expect(audit.called).to.equal(false);
    });

    it('re-fetches updated documents by id without building a $in filter', async () => {
        const model = {
            findById: sinon.stub()
                .onFirstCall()
                .returns({ lean: async () => ({ _id: 'user-1', status: 'open' }) })
                .onSecondCall()
                .returns({ lean: async () => ({ _id: 'user-2', status: 'closed' }) })
        };

        const documents = await findDocumentsByIds(model, ['user-1', 'user-2']);

        expect(model.findById.calledTwice).to.equal(true);
        expect(model.findById.firstCall.args[0]).to.equal('user-1');
        expect(model.findById.secondCall.args[0]).to.equal('user-2');
        expect(documents).to.deep.equal([
            { _id: 'user-1', status: 'open' },
            { _id: 'user-2', status: 'closed' }
        ]);
    });
});
