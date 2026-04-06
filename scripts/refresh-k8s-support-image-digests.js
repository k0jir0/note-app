#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'ops', 'kubernetes', 'immutable-stack.yaml');

const supportImages = [
    {
        containerName: 'mongo',
        repository: 'library/mongo',
        tag: '7'
    },
    {
        containerName: 'proxy',
        repository: 'library/nginx',
        tag: '1.27-alpine'
    }
];

function normalizeLineEndings(text) {
    return String(text || '').replace(/\r\n/g, '\n');
}

async function fetchDockerHubToken(repository, { fetchImpl = fetch } = {}) {
    const tokenUrl = new URL('https://auth.docker.io/token');
    tokenUrl.searchParams.set('service', 'registry.docker.io');
    tokenUrl.searchParams.set('scope', `repository:${repository}:pull`);

    const response = await fetchImpl(tokenUrl, {
        headers: {
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch Docker Hub token for ${repository}. HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (!payload || typeof payload.token !== 'string' || !payload.token.trim()) {
        throw new Error(`Docker Hub token response for ${repository} did not include a usable token.`);
    }

    return payload.token;
}

async function fetchManifestList(repository, tag, {
    fetchImpl = fetch,
    token = ''
} = {}) {
    const manifestUrl = `https://registry-1.docker.io/v2/${repository}/manifests/${tag}`;
    const authToken = token || await fetchDockerHubToken(repository, { fetchImpl });
    const response = await fetchImpl(manifestUrl, {
        headers: {
            Accept: [
                'application/vnd.oci.image.index.v1+json',
                'application/vnd.docker.distribution.manifest.list.v2+json',
                'application/vnd.oci.image.manifest.v1+json',
                'application/vnd.docker.distribution.manifest.v2+json'
            ].join(', '),
            Authorization: `Bearer ${authToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch manifest list for ${repository}:${tag}. HTTP ${response.status}.`);
    }

    return response.json();
}

function selectPlatformDigest(manifestList, {
    os = 'linux',
    architecture = 'amd64'
} = {}) {
    const manifests = Array.isArray(manifestList && manifestList.manifests)
        ? manifestList.manifests
        : [];

    const match = manifests.find((manifest) => {
        const platform = manifest && manifest.platform ? manifest.platform : {};
        return platform.os === os
            && platform.architecture === architecture
            && typeof manifest.digest === 'string'
            && /^sha256:[a-f0-9]{64}$/.test(manifest.digest);
    });

    if (!match) {
        throw new Error(`No manifest digest found for ${os}/${architecture}.`);
    }

    return match.digest;
}

function buildPinnedReference(repository, tag, digest) {
    return `docker.io/${repository}:${tag}@${digest}`;
}

function updateManifestImageReference(manifestText, {
    containerName,
    imageReference
}) {
    const lines = normalizeLineEndings(manifestText).split('\n');
    let currentContainerName = '';
    let encounteredContainer = false;
    let replacedImageLine = false;
    let updated = false;

    const nextLines = lines.map((line) => {
        if (line.startsWith('        - name: ')) {
            currentContainerName = line.slice('        - name: '.length).trim();
            encounteredContainer = encounteredContainer || currentContainerName === containerName;
            return line;
        }

        if (line === '---') {
            currentContainerName = '';
            return line;
        }

        if (currentContainerName === containerName && /^ {10}image:\s+/.test(line)) {
            const nextLine = `          image: ${imageReference}`;
            replacedImageLine = true;
            updated = updated || nextLine !== line;
            return nextLine;
        }

        return line;
    });

    if (!encounteredContainer || !replacedImageLine) {
        throw new Error(`Unable to update image reference for container ${containerName}.`);
    }

    return {
        updated,
        manifestText: `${nextLines.join('\n')}\n`
    };
}

async function resolvePinnedReferences({
    images = supportImages,
    fetchImpl = fetch
} = {}) {
    const resolved = {};

    for (const image of images) {
        const token = await fetchDockerHubToken(image.repository, { fetchImpl });
        const manifestList = await fetchManifestList(image.repository, image.tag, {
            fetchImpl,
            token
        });
        const digest = selectPlatformDigest(manifestList);

        resolved[image.containerName] = buildPinnedReference(image.repository, image.tag, digest);
    }

    return resolved;
}

async function refreshPinnedSupportImageDigests({
    manifestFile = manifestPath,
    fetchImpl = fetch,
    writeChanges = true
} = {}) {
    const originalManifestText = normalizeLineEndings(fs.readFileSync(manifestFile, 'utf8'));
    const resolvedReferences = await resolvePinnedReferences({
        fetchImpl
    });

    let nextManifestText = originalManifestText.endsWith('\n')
        ? originalManifestText
        : `${originalManifestText}\n`;
    let changed = false;

    for (const image of supportImages) {
        const result = updateManifestImageReference(nextManifestText, {
            containerName: image.containerName,
            imageReference: resolvedReferences[image.containerName]
        });
        nextManifestText = result.manifestText;
        changed = changed || result.updated;
    }

    if (writeChanges && changed) {
        fs.writeFileSync(manifestFile, nextManifestText, 'utf8');
    }

    return {
        changed,
        manifestText: nextManifestText,
        pinnedReferences: resolvedReferences
    };
}

if (require.main === module) {
    refreshPinnedSupportImageDigests()
        .then((result) => {
            Object.entries(result.pinnedReferences).forEach(([containerName, reference]) => {
                console.log(`${containerName}: ${reference}`);
            });
            console.log(result.changed
                ? 'Updated Kubernetes support-image digests.'
                : 'Kubernetes support-image digests are already current.');
        })
        .catch((error) => {
            console.error(error.message || error);
            process.exit(1);
        });
}

module.exports = {
    buildPinnedReference,
    fetchDockerHubToken,
    fetchManifestList,
    refreshPinnedSupportImageDigests,
    resolvePinnedReferences,
    selectPlatformDigest,
    supportImages,
    updateManifestImageReference
};
