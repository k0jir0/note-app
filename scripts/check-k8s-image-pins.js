#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'ops', 'kubernetes', 'immutable-stack.yaml');

function extractContainerBlock(manifestText, containerName) {
    const lines = manifestText.split('\n');
    const startIndex = lines.findIndex((line) => line === `        - name: ${containerName}`);

    if (startIndex === -1) {
        throw new Error(`Container block not found for ${containerName}.`);
    }

    const blockLines = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line === '---' || line.startsWith('        - name: ')) {
            break;
        }

        blockLines.push(line);
    }

    return blockLines.join('\n');
}

function validateSupportContainer(manifestText, {
    name,
    imagePrefix
}) {
    const block = extractContainerBlock(manifestText, name);
    const imageMatch = block.match(/^ {10}image:\s+([^\s]+)$/m);

    if (!imageMatch) {
        throw new Error(`${name} is missing an image reference.`);
    }

    const image = imageMatch[1];
    if (!image.startsWith(imagePrefix)) {
        throw new Error(`${name} image must start with ${imagePrefix}. Found ${image}.`);
    }

    if (!/@sha256:[a-f0-9]{64}$/.test(image)) {
        throw new Error(`${name} image must be pinned by immutable digest. Found ${image}.`);
    }

    const hasRequests = /resources:\n\s+requests:\n\s+cpu:\s+.+\n\s+memory:\s+.+/m.test(block);
    const hasLimits = /limits:\n\s+cpu:\s+.+\n\s+memory:\s+.+/m.test(block);

    if (!hasRequests || !hasLimits) {
        throw new Error(`${name} must declare CPU and memory requests and limits.`);
    }

    return image;
}

function checkKubernetesSupportImages({ manifestFile = manifestPath, manifestText = '' } = {}) {
    const resolvedManifestText = typeof manifestText === 'string' && manifestText.trim()
        ? manifestText
        : fs.readFileSync(manifestFile, 'utf8');
    const normalizedManifestText = resolvedManifestText.replace(/\r\n/g, '\n');

    return {
        mongo: validateSupportContainer(normalizedManifestText, {
            name: 'mongo',
            imagePrefix: 'docker.io/library/mongo:'
        }),
        proxy: validateSupportContainer(normalizedManifestText, {
            name: 'proxy',
            imagePrefix: 'docker.io/library/nginx:'
        })
    };
}

if (require.main === module) {
    const result = checkKubernetesSupportImages();
    console.log(`Validated immutable support-image pins: mongo=${result.mongo}, proxy=${result.proxy}`);
}

module.exports = {
    checkKubernetesSupportImages,
    extractContainerBlock,
    validateSupportContainer
};
