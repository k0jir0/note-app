const { expect } = require('chai');

const {
    readExistingTimestamp,
    stabilizeSbom
} = require('../scripts/generate-sbom');

describe('SBOM generation helpers', () => {
    it('preserves stable committed metadata when stabilizing a regenerated sbom', () => {
        const rawSbom = JSON.stringify({
            serialNumber: 'urn:uuid:new-serial',
            metadata: {
                timestamp: '2026-03-31T00:11:38.856Z',
                tools: [
                    {
                        vendor: 'npm',
                        name: 'cli',
                        version: '10.9.2'
                    }
                ]
            },
            components: [{ name: 'example' }]
        });

        const stabilized = JSON.parse(stabilizeSbom(rawSbom, {
            serialNumber: 'urn:uuid:committed-serial',
            metadata: {
                timestamp: '2026-03-30T16:44:50.663Z',
                tools: [
                    {
                        vendor: 'npm',
                        name: 'cli',
                        version: '11.6.2'
                    }
                ]
            }
        }));

        expect(stabilized.serialNumber).to.equal('urn:uuid:committed-serial');
        expect(stabilized.metadata.timestamp).to.equal('2026-03-30T16:44:50.663Z');
        expect(stabilized.metadata.tools).to.deep.equal([
            {
                vendor: 'npm',
                name: 'cli',
                version: '11.6.2'
            }
        ]);
        expect(stabilized.components).to.deep.equal([{ name: 'example' }]);
    });

    it('returns null when the destination file does not exist', () => {
        expect(readExistingTimestamp('this-file-should-not-exist.cdx.json')).to.equal(null);
    });
});
