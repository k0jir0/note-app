const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    buildPinnedReference,
    refreshPinnedSupportImageDigests,
    selectPlatformDigest,
    updateManifestImageReference
} = require('../scripts/refresh-k8s-support-image-digests');

describe('Kubernetes support-image digest refresh', () => {
    it('selects the linux amd64 digest from a manifest list', () => {
        const digest = selectPlatformDigest({
            manifests: [
                {
                    digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    platform: {
                        architecture: 'arm64',
                        os: 'linux'
                    }
                },
                {
                    digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    platform: {
                        architecture: 'amd64',
                        os: 'linux'
                    }
                }
            ]
        });

        expect(digest).to.equal('sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('updates only the targeted container image reference', () => {
        const manifestText = [
            '        - name: mongo',
            '          image: docker.io/library/mongo:7@sha256:1111111111111111111111111111111111111111111111111111111111111111',
            '          imagePullPolicy: IfNotPresent',
            '---',
            '        - name: proxy',
            '          image: docker.io/library/nginx:1.27-alpine@sha256:2222222222222222222222222222222222222222222222222222222222222222',
            '          imagePullPolicy: IfNotPresent',
            ''
        ].join('\n');

        const result = updateManifestImageReference(manifestText, {
            containerName: 'mongo',
            imageReference: 'docker.io/library/mongo:7@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        });

        expect(result.updated).to.equal(true);
        expect(result.manifestText).to.include('docker.io/library/mongo:7@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        expect(result.manifestText).to.include('docker.io/library/nginx:1.27-alpine@sha256:2222222222222222222222222222222222222222222222222222222222222222');
    });

    it('refreshes the manifest file from fetched registry digests', async () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-k8s-digest-refresh-'));
        const manifestFile = path.join(tempDirectory, 'immutable-stack.yaml');
        fs.writeFileSync(manifestFile, [
            '        - name: mongo',
            '          image: docker.io/library/mongo:7@sha256:1111111111111111111111111111111111111111111111111111111111111111',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 256Mi',
            '            limits:',
            '              cpu: 500m',
            '              memory: 512Mi',
            '---',
            '        - name: proxy',
            '          image: docker.io/library/nginx:1.27-alpine@sha256:2222222222222222222222222222222222222222222222222222222222222222',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 128Mi',
            '            limits:',
            '              cpu: 300m',
            '              memory: 256Mi',
            ''
        ].join('\n'), 'utf8');

        const responses = new Map([
            ['https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Fmongo%3Apull', { token: 'mongo-token' }],
            ['https://registry-1.docker.io/v2/library/mongo/manifests/7', {
                manifests: [
                    {
                        digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        platform: { architecture: 'amd64', os: 'linux' }
                    }
                ]
            }],
            ['https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Fnginx%3Apull', { token: 'nginx-token' }],
            ['https://registry-1.docker.io/v2/library/nginx/manifests/1.27-alpine', {
                manifests: [
                    {
                        digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                        platform: { architecture: 'amd64', os: 'linux' }
                    }
                ]
            }]
        ]);

        const fetchImpl = async (url) => {
            const payload = responses.get(String(url));
            if (!payload) {
                throw new Error(`Unexpected fetch URL: ${url}`);
            }

            return {
                ok: true,
                json: async () => payload
            };
        };

        const result = await refreshPinnedSupportImageDigests({
            manifestFile,
            fetchImpl
        });

        expect(result.changed).to.equal(true);
        expect(result.pinnedReferences).to.deep.equal({
            mongo: buildPinnedReference('library/mongo', '7', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
            proxy: buildPinnedReference('library/nginx', '1.27-alpine', 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
        });
        const updatedManifest = fs.readFileSync(manifestFile, 'utf8');
        expect(updatedManifest).to.include('docker.io/library/mongo:7@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        expect(updatedManifest).to.include('docker.io/library/nginx:1.27-alpine@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    });
});
