const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const NOTE_IMAGE_STORAGE_DIR = path.resolve(__dirname, '../../storage/note-images');
const MAX_IMAGE_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10000;
const SUPPORTED_IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['image/avif', 'avif']
]);

function normalizeImageContentType(value = '') {
    return String(value || '').split(';')[0].trim().toLowerCase();
}

function buildAssetFileName(noteId, extension) {
    return `${String(noteId)}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
}

async function ensureStorageDirectory(storageDir = NOTE_IMAGE_STORAGE_DIR) {
    await fs.mkdir(storageDir, { recursive: true });
    return storageDir;
}

function buildNoteImagePublicPath(noteId, timestamp = null) {
    const basePath = `/notes/${String(noteId)}/image`;
    return timestamp ? `${basePath}?v=${timestamp}` : basePath;
}

function resolveStoredAssetPath(assetKey, storageDir = NOTE_IMAGE_STORAGE_DIR) {
    const normalizedKey = path.basename(String(assetKey || '').trim());
    if (!normalizedKey) {
        return '';
    }

    return path.join(storageDir, normalizedKey);
}

async function deleteNoteImageAsset(note = {}, storageDir = NOTE_IMAGE_STORAGE_DIR) {
    const assetPath = resolveStoredAssetPath(note.imageAssetKey, storageDir);
    if (!assetPath) {
        return false;
    }

    try {
        await fs.unlink(assetPath);
        return true;
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return false;
        }

        throw error;
    }
}

async function persistRemoteNoteImage(options = {}) {
    const {
        noteId,
        sourceUrl,
        fetchImpl = global.fetch,
        storageDir = NOTE_IMAGE_STORAGE_DIR,
        timeoutMs = IMAGE_DOWNLOAD_TIMEOUT_MS,
        maxBytes = MAX_IMAGE_DOWNLOAD_BYTES
    } = options;

    if (!noteId) {
        throw new Error('A note id is required to store an image asset.');
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('Image download is unavailable because fetch is not configured.');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(String(sourceUrl || '').trim());
    } catch (_error) {
        throw new Error('Image must be a valid URL (http:// or https://).');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Image must be a valid URL (http:// or https://).');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutHandle = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const response = await fetchImpl(parsedUrl.toString(), {
            redirect: 'follow',
            signal: controller ? controller.signal : undefined,
            headers: {
                Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1'
            }
        });

        if (!response || !response.ok) {
            throw new Error('Unable to download the image from the provided URL.');
        }

        const contentType = normalizeImageContentType(response.headers && response.headers.get
            ? response.headers.get('content-type')
            : '');
        const extension = SUPPORTED_IMAGE_TYPES.get(contentType);
        if (!extension) {
            throw new Error('Only JPEG, PNG, GIF, WebP, and AVIF images are supported.');
        }

        const declaredLength = Number.parseInt(response.headers && response.headers.get
            ? response.headers.get('content-length') || ''
            : '', 10);
        if (Number.isInteger(declaredLength) && declaredLength > maxBytes) {
            throw new Error(`Image must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        if (imageBuffer.length === 0) {
            throw new Error('Downloaded image was empty.');
        }

        if (imageBuffer.length > maxBytes) {
            throw new Error(`Image must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`);
        }

        await ensureStorageDirectory(storageDir);
        const assetKey = buildAssetFileName(noteId, extension);
        const assetPath = resolveStoredAssetPath(assetKey, storageDir);
        await fs.writeFile(assetPath, imageBuffer);

        return {
            assetKey,
            contentType,
            assetPath,
            byteLength: imageBuffer.length
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error('Image download timed out.');
        }

        throw error;
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

module.exports = {
    IMAGE_DOWNLOAD_TIMEOUT_MS,
    MAX_IMAGE_DOWNLOAD_BYTES,
    NOTE_IMAGE_STORAGE_DIR,
    buildNoteImagePublicPath,
    deleteNoteImageAsset,
    ensureStorageDirectory,
    persistRemoteNoteImage,
    resolveStoredAssetPath
};
