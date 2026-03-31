const { expect } = require('chai');
const sinon = require('sinon');

const {
    buildPersistenceFailureState,
    createBreakGlassStateStore
} = require('../src/services/breakGlassStateStoreService');

describe('break-glass state store service', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('fails safe to offline mode when strict persistence cannot load the stored state', async () => {
        const logger = {
            warn: sinon.stub(),
            error: sinon.stub()
        };
        const store = createBreakGlassStateStore({
            strictPersistence: true,
            logger,
            clock: () => new Date('2026-03-31T14:15:00.000Z'),
            BreakGlassStateModel: {
                findOne() {
                    throw new Error('database unavailable');
                }
            }
        });

        const state = await store.getCurrentState({ refresh: true });

        expect(state).to.deep.equal(buildPersistenceFailureState(() => new Date('2026-03-31T14:15:00.000Z')));
        expect(logger.error.calledOnce).to.equal(true);
        expect(logger.warn.called).to.equal(false);
    });

    it('throws and switches to fail-safe offline mode when strict persistence cannot store updates', async () => {
        const logger = {
            warn: sinon.stub(),
            error: sinon.stub()
        };
        const store = createBreakGlassStateStore({
            strictPersistence: true,
            logger,
            clock: () => new Date('2026-03-31T14:16:00.000Z'),
            BreakGlassStateModel: {
                findOneAndUpdate() {
                    throw new Error('database unavailable');
                }
            }
        });

        try {
            await store.updateState({
                mode: 'read_only',
                reason: 'Containment'
            });
            expect.fail('Expected updateState() to reject when strict persistence fails');
        } catch (error) {
            expect(error.code).to.equal('BREAK_GLASS_STATE_PERSISTENCE_FAILED');
            expect(error.breakGlass).to.deep.equal(buildPersistenceFailureState(() => new Date('2026-03-31T14:16:00.000Z')));
            expect(store.peekState()).to.deep.equal(error.breakGlass);
            expect(logger.error.calledOnce).to.equal(true);
            expect(logger.warn.called).to.equal(false);
        }
    });
});
