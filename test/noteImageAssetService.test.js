const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { expect } = require('chai');
const sinon = require('sinon');

const noteImageAssetService = require('../src/services/noteImageAssetService');

function buildImageResponse({
    status = 200,
    contentType = 'image/png',
    body = Buffer.from('image-bytes')
} = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get(headerName) {
                const normalizedHeader = String(headerName || '').toLowerCase();
                if (normalizedHeader === 'content-type') {
                    return contentType;
                }

                if (normalizedHeader === 'content-length') {
                    return String(body.length);
                }

                return '';
            }
        },
        arrayBuffer: async () => body
    };
}

describe('noteImageAssetService SSRF protections', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('rejects localhost image URLs before issuing a fetch', async () => {
        const fetchImpl = sinon.stub().rejects(new Error('fetch should not run'));

        try {
            await noteImageAssetService.persistRemoteNoteImage({
                noteId: 'note-1',
                sourceUrl: 'http://localhost/image.png',
                fetchImpl
            });
            throw new Error('Expected request to be rejected');
        } catch (error) {
            expect(error.message).to.equal('Image downloads from local or private network hosts are not allowed.');
            expect(fetchImpl.called).to.equal(false);
        }
    });

    it('rejects hostnames that resolve to private network addresses', async () => {
        const fetchImpl = sinon.stub().rejects(new Error('fetch should not run'));
        const dnsLookupImpl = sinon.stub().resolves([{ address: '10.0.0.5', family: 4 }]);

        try {
            await noteImageAssetService.persistRemoteNoteImage({
                noteId: 'note-2',
                sourceUrl: 'https://internal.example/image.png',
                fetchImpl,
                dnsLookupImpl
            });
            throw new Error('Expected request to be rejected');
        } catch (error) {
            expect(error.message).to.equal('Image downloads from local or private network hosts are not allowed.');
            expect(fetchImpl.called).to.equal(false);
        }
    });

    it('stores an image when the host resolves to a public address', async () => {
        const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'note-image-'));
        const fetchImpl = sinon.stub().resolves(buildImageResponse());
        const dnsLookupImpl = sinon.stub().resolves([{ address: '93.184.216.34', family: 4 }]);

        try {
            const result = await noteImageAssetService.persistRemoteNoteImage({
                noteId: 'note-3',
                sourceUrl: 'https://example.com/image.png',
                fetchImpl,
                dnsLookupImpl,
                storageDir
            });

            expect(result.contentType).to.equal('image/png');
            expect(result.assetKey.endsWith('.png')).to.equal(true);
            const storedImage = await fs.readFile(result.assetPath);
            expect(storedImage.length).to.be.greaterThan(0);
        } finally {
            await fs.rm(storageDir, { recursive: true, force: true });
        }
    });
});
