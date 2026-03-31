const { expect } = require('chai');
const sinon = require('sinon');
const { ObjectId } = require('bson');

const {
    collectReconstitutionStatus,
    decodeBackupArchive,
    encodeBackupArchive,
    exportBackupArchive,
    parseBackupArchivePayload,
    restoreBackupArchive,
    serializeBackupArchive
} = require('../src/services/continuityService');

function createExportModel(documents = []) {
    const toArray = sinon.stub().resolves(documents);
    const sort = sinon.stub().returns({ toArray });
    const find = sinon.stub().returns({ sort });

    return {
        collection: {
            find,
            sort,
            toArray,
            deleteMany: sinon.stub().resolves(),
            insertMany: sinon.stub().resolves(),
            countDocuments: sinon.stub().resolves(documents.length)
        }
    };
}

function createCountingModel(count) {
    return {
        collection: {
            countDocuments: sinon.stub().resolves(count),
            deleteMany: sinon.stub().resolves(),
            insertMany: sinon.stub().resolves(),
            find: sinon.stub().returns({
                sort: sinon.stub().returns({
                    toArray: sinon.stub().resolves([])
                })
            })
        }
    };
}

describe('continuity service', () => {
    const backupProtection = {
        secret: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    };

    afterEach(() => {
        sinon.restore();
    });

    it('exports and parses a backup archive without losing BSON types', async () => {
        const noteId = new ObjectId('507f1f77bcf86cd799439011');
        const definitions = [
            {
                id: 'notes',
                label: 'Notes',
                Model: createExportModel([{
                    _id: noteId,
                    title: 'Recovered note',
                    createdAt: new Date('2026-03-31T00:00:00.000Z')
                }])
            }
        ];

        const archive = await exportBackupArchive({
            collectionDefinitions: definitions,
            metadata: {
                nodeEnv: 'test',
                reason: 'unit-test'
            }
        });
        const parsed = parseBackupArchivePayload(serializeBackupArchive(archive));

        expect(parsed.summary[0].count).to.equal(1);
        expect(String(parsed.collections.notes[0]._id)).to.equal(String(noteId));
        expect(parsed.collections.notes[0].createdAt).to.be.instanceOf(Date);
    });

    it('encodes and decodes protected backup archives', () => {
        const archive = {
            schemaVersion: 1,
            application: 'note-app',
            collections: {
                users: [{ _id: new ObjectId('507f1f77bcf86cd799439012'), email: 'restored@example.com' }]
            }
        };

        const encoded = encodeBackupArchive(archive, {
            protection: backupProtection
        });
        const decoded = decodeBackupArchive(encoded, {
            protection: backupProtection
        });

        expect(decoded.collections.users).to.have.lengthOf(1);
        expect(decoded.collections.users[0].email).to.equal('restored@example.com');
        expect(() => decodeBackupArchive(Buffer.from(serializeBackupArchive(archive), 'utf8'))).to.throw('Plaintext backup archives are not accepted by default');
    });

    it('restores collections from a parsed archive', async () => {
        const backupArchive = {
            schemaVersion: 1,
            application: 'note-app',
            collections: {
                users: [{ _id: new ObjectId('507f1f77bcf86cd799439012'), email: 'restored@example.com' }]
            }
        };
        const model = createExportModel();
        const definitions = [
            {
                id: 'users',
                label: 'Users',
                Model: model
            }
        ];

        const summary = await restoreBackupArchive({
            backupArchive,
            collectionDefinitions: definitions,
            allowNonTransactionalRestore: true
        });

        expect(model.collection.deleteMany.calledOnce).to.equal(true);
        expect(model.collection.deleteMany.firstCall.args[0]).to.deep.equal({});
        expect(model.collection.insertMany.calledOnce).to.equal(true);
        expect(summary[0].restoredCount).to.equal(1);
    });

    it('requires explicit transactional support before destructive restore', async () => {
        const backupArchive = {
            schemaVersion: 1,
            application: 'note-app',
            collections: {
                users: []
            }
        };

        try {
            await restoreBackupArchive({
                backupArchive,
                collectionDefinitions: [{
                    id: 'users',
                    label: 'Users',
                    Model: createExportModel()
                }]
            });
            throw new Error('Expected restoreBackupArchive to reject without transactional support');
        } catch (error) {
            expect(error.message).to.include('Transactional restore support is required before applying a destructive restore.');
        }
    });

    it('reports reconstitution issues for missing users and duplicated singleton state', async () => {
        const status = await collectReconstitutionStatus({
            collectionDefinitions: [
                { id: 'users', label: 'Users', Model: createCountingModel(0) },
                { id: 'auditChainStates', label: 'Audit Chain States', Model: createCountingModel(2) },
                { id: 'breakGlassStates', label: 'Break Glass States', Model: createCountingModel(2) }
            ],
            runtimeConfig: {
                identityLifecycle: { protectedRuntime: true },
                transport: { secureTransportRequired: true },
                immutableLogging: { required: true }
            },
            requireUsers: true
        });

        expect(status.ready).to.equal(false);
        expect(status.runtime.protectedRuntime).to.equal(true);
        expect(status.issues.join(' ')).to.include('No user records are present');
        expect(status.issues.join(' ')).to.include('Audit chain state contains more than one record');
        expect(status.issues.join(' ')).to.include('Break-glass state contains more than one record');
    });
});
