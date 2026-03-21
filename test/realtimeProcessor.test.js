const { expect } = require('chai');
const sinon = require('sinon');

const {
    STREAM_KEY,
    DEAD_LETTER_STREAM_KEY,
    GROUP,
    claimStaleMessages,
    handleMessage,
    updatePendingGaugeOnce
} = require('../src/workers/realtimeProcessor');

describe('Realtime Processor', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('dead-letters malformed payloads and acknowledges the original message', async () => {
        const redisClient = {
            xadd: sinon.stub().resolves('2-0'),
            xack: sinon.stub().resolves(1)
        };
        const logger = {
            error: sinon.stub(),
            log: sinon.stub()
        };

        const result = await handleMessage('1-0', { payload: '{invalid-json' }, {
            redisClient,
            logger
        });

        expect(result.success).to.equal(false);
        expect(result.deadLettered).to.equal(true);
        expect(redisClient.xadd.calledOnce).to.equal(true);
        expect(redisClient.xadd.firstCall.args[0]).to.equal(DEAD_LETTER_STREAM_KEY);
        expect(redisClient.xack.calledWith(STREAM_KEY, GROUP, '1-0')).to.equal(true);
    });

    it('claims stale pending messages through xautoclaim', async () => {
        const redisClient = {
            xautoclaim: sinon.stub().resolves([
                '0-0',
                [
                    ['1-0', ['payload', '{"type":"log"}']]
                ]
            ])
        };

        const result = await claimStaleMessages({ redisClient });

        expect(result).to.deep.equal({
            nextStart: '0-0',
            messages: [
                {
                    id: '1-0',
                    fields: {
                        payload: '{"type":"log"}'
                    }
                }
            ]
        });
    });

    it('updates the pending gauge from XPENDING summary data', async () => {
        const redisClient = {
            xpending: sinon.stub().resolves(['7', '1-0', '4-0', []])
        };
        const gauge = {
            set: sinon.stub()
        };

        const pendingCount = await updatePendingGaugeOnce({ redisClient, gauge });

        expect(pendingCount).to.equal(7);
        expect(gauge.set.calledOnceWith(7)).to.equal(true);
    });

    it('routes saved realtime alerts through the incident response service before publishing', async () => {
        function ObjectId(value) {
            return value;
        }

        const redisClient = {
            xack: sinon.stub().resolves(1)
        };
        const publisherClient = {
            publish: sinon.stub().resolves(1)
        };
        const SecurityAlertModel = {
            insertMany: sinon.stub().resolves([
                {
                    _id: 'alert-1',
                    user: '507f1f77bcf86cd799439011',
                    type: 'injection_attempt',
                    severity: 'high',
                    summary: 'Injection attempt detected',
                    scoreSource: 'trained-logistic-regression',
                    mlScore: 0.95,
                    details: { ip: '203.0.113.77' }
                }
            ])
        };
        const executeIncidentResponsesFn = sinon.stub().resolves({
            alerts: [
                {
                    _id: 'alert-1',
                    user: '507f1f77bcf86cd799439011',
                    type: 'injection_attempt',
                    severity: 'high',
                    summary: 'Injection attempt detected',
                    scoreSource: 'trained-logistic-regression',
                    mlScore: 0.95,
                    details: { ip: '203.0.113.77' },
                    response: {
                        level: 'block',
                        reason: 'ML score crossed the block threshold.',
                        actions: []
                    }
                }
            ]
        });

        const result = await handleMessage('1-0', {
            payload: JSON.stringify({
                type: 'log',
                user: '507f1f77bcf86cd799439011',
                logText: 'ignored by stub'
            })
        }, {
            redisClient,
            publisherClient,
            SecurityAlertModel,
            analyzeLogTextFn: () => ({
                alerts: [
                    {
                        type: 'injection_attempt',
                        severity: 'high',
                        summary: 'Injection attempt detected',
                        details: { ip: '203.0.113.77' }
                    }
                ]
            }),
            executeIncidentResponsesFn,
            mongooseLib: { Types: { ObjectId } },
            logger: {
                log: sinon.stub(),
                error: sinon.stub()
            }
        });

        expect(result.success).to.equal(true);
        expect(SecurityAlertModel.insertMany.calledOnce).to.equal(true);
        expect(executeIncidentResponsesFn.calledOnce).to.equal(true);
        expect(publisherClient.publish.called).to.equal(true);
        expect(redisClient.xack.calledWith(STREAM_KEY, GROUP, '1-0')).to.equal(true);
    });
});
