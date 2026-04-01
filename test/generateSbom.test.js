const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    buildStabilizedSbom,
    isSbomCurrent,
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

    it('detects when the committed SBOM no longer matches the lockfile-derived content', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'note-app-sbom-'));
        const destination = path.join(tempDirectory, 'note-app.cdx.json');
        fs.writeFileSync(path.join(tempDirectory, 'package.json'), JSON.stringify({
            name: 'note-app'
        }, null, 2));
        const rawSbom = JSON.stringify({
            serialNumber: 'urn:uuid:new-serial',
            metadata: {
                timestamp: '2026-04-01T00:11:38.856Z',
                tools: [{ vendor: 'npm', name: 'cli', version: '10.9.2' }],
                component: {
                    name: 'temp-folder-name'
                }
            },
            components: [{ name: 'example', version: '1.0.0' }]
        });

        fs.writeFileSync(destination, buildStabilizedSbom({
            rootDir: tempDirectory,
            destination,
            rawSbom
        }), 'utf8');

        expect(isSbomCurrent({
            rootDir: tempDirectory,
            destination,
            rawSbom
        })).to.equal(true);
        expect(JSON.parse(fs.readFileSync(destination, 'utf8')).metadata.component.name).to.equal('note-app');

        expect(isSbomCurrent({
            rootDir: tempDirectory,
            destination,
            rawSbom: JSON.stringify({
                serialNumber: 'urn:uuid:new-serial',
                metadata: {
                    timestamp: '2026-04-01T00:11:38.856Z',
                    tools: [{ vendor: 'npm', name: 'cli', version: '10.9.2' }],
                    component: {
                        name: 'different-temp-folder-name'
                    }
                },
                components: [{ name: 'example', version: '2.0.0' }]
            })
        })).to.equal(false);
    });
});
