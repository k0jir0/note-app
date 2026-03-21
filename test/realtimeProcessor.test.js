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
});
