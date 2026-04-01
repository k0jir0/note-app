const BreakGlassState = require('../models/BreakGlassState');
const { BREAK_GLASS_MODES, buildBreakGlassState } = require('./breakGlassService');

const DEFAULT_CONTROL_KEY = 'default';

function normalizeStoredState(document = {}, fallbackState = {}) {
    return buildBreakGlassState({
        mode: document.mode || fallbackState.mode,
        reason: document.reason || fallbackState.reason,
        activatedAt: document.activatedAt || fallbackState.activatedAt,
        activatedBy: document.activatedBy || fallbackState.activatedBy
    });
}

function buildPersistedStateUpdate(nextState = {}) {
    const normalizedState = buildBreakGlassState(nextState);

    return {
        mode: normalizedState.mode,
        reason: normalizedState.reason,
        activatedAt: normalizedState.activatedAt ? new Date(normalizedState.activatedAt) : null,
        activatedBy: normalizedState.activatedBy
    };
}

function buildPersistenceFailureState(clock = () => new Date()) {
    const timestamp = clock();

    return buildBreakGlassState({
        mode: BREAK_GLASS_MODES.OFFLINE,
        reason: 'Break-glass runtime state is unavailable because persistent storage could not be reached.',
        activatedAt: timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString(),
        activatedBy: 'system'
    });
}

function createBreakGlassStateStore({
    BreakGlassStateModel = BreakGlassState,
    controlKey = DEFAULT_CONTROL_KEY,
    seedState = buildBreakGlassState(),
    logger = console,
    strictPersistence = false,
    clock = () => new Date()
} = {}) {
    let cachedState = buildBreakGlassState(seedState);
    let hydrated = false;

    async function readPersistedState() {
        if (!BreakGlassStateModel || typeof BreakGlassStateModel.findOne !== 'function') {
            return cachedState;
        }

        let query = BreakGlassStateModel.findOne({ controlKey });
        if (query && typeof query.lean === 'function') {
            query = query.lean();
        }

        const persistedState = await query;
        if (!persistedState) {
            return writePersistedState(cachedState);
        }

        return normalizeStoredState(persistedState, cachedState);
    }

    async function writePersistedState(nextState = {}) {
        const normalizedState = buildBreakGlassState(nextState);
        cachedState = normalizedState;
        hydrated = true;

        if (!BreakGlassStateModel || typeof BreakGlassStateModel.findOneAndUpdate !== 'function') {
            return cachedState;
        }

        let query = BreakGlassStateModel.findOneAndUpdate(
            { controlKey },
            {
                $set: buildPersistedStateUpdate(normalizedState),
                $setOnInsert: { controlKey }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        if (query && typeof query.lean === 'function') {
            query = query.lean();
        }

        const persistedState = await query;
        cachedState = normalizeStoredState(persistedState || normalizedState, normalizedState);
        return cachedState;
    }

    async function getCurrentState({ refresh = false } = {}) {
        if (hydrated && !refresh) {
            return cachedState;
        }

        try {
            cachedState = await readPersistedState();
            hydrated = true;
        } catch (error) {
            if (strictPersistence) {
                cachedState = buildPersistenceFailureState(clock);
                hydrated = true;
                logger.error('[break-glass] failed to load persisted runtime state', error && error.message ? error.message : error);
                return cachedState;
            }

            logger.warn('[break-glass] failed to load persisted runtime state', error && error.message ? error.message : error);
        }

        return cachedState;
    }

    return {
        async getCurrentState(options = {}) {
            return getCurrentState(options);
        },
        async updateState(nextState = {}) {
            try {
                return await writePersistedState(nextState);
            } catch (error) {
                if (strictPersistence) {
                    cachedState = buildPersistenceFailureState(clock);
                    hydrated = true;
                    logger.error('[break-glass] failed to persist runtime state', error && error.message ? error.message : error);
                    const persistenceError = new Error('Unable to persist break-glass runtime state.');
                    persistenceError.code = 'BREAK_GLASS_STATE_PERSISTENCE_FAILED';
                    persistenceError.cause = error;
                    persistenceError.breakGlass = cachedState;
                    throw persistenceError;
                }

                logger.warn('[break-glass] failed to persist runtime state', error && error.message ? error.message : error);
                cachedState = buildBreakGlassState(nextState);
                hydrated = true;
                return cachedState;
            }
        },
        peekState() {
            return cachedState;
        }
    };
}

module.exports = {
    DEFAULT_CONTROL_KEY,
    buildPersistenceFailureState,
    createBreakGlassStateStore
};
