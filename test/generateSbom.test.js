const { expect } = require('chai');

const { readExistingTimestamp, stabilizeSbom } = require('../scripts/generate-sbom');

describe('SBOM generation helpers', () => {
    it('preserves the committed timestamp when stabilizing a regenerated sbom', () => {
        const rawSbom = JSON.stringify({
            metadata: {
                timestamp: '2026-03-31T00:11:38.856Z'
            },
            components: [{ name: 'example' }]
        });

        const stabilized = JSON.parse(stabilizeSbom(rawSbom, '2026-03-30T16:44:50.663Z'));

        expect(stabilized.metadata.timestamp).to.equal('2026-03-30T16:44:50.663Z');
        expect(stabilized.components).to.deep.equal([{ name: 'example' }]);
    });

    it('returns null when the destination file does not exist', () => {
        expect(readExistingTimestamp('this-file-should-not-exist.cdx.json')).to.equal(null);
    });
});
