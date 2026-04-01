const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs/promises');
const net = require('net');
const path = require('path');

const NOTE_IMAGE_STORAGE_DIR = path.resolve(__dirname, '../../storage/note-images');
const MAX_IMAGE_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10000;
const MAX_IMAGE_REDIRECTS = 3;
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

function normalizeHostname(value = '') {
    return String(value || '').trim().replace(/\.+$/, '').toLowerCase();
}

function isDisallowedHostname(hostname = '') {
    const normalizedHostname = normalizeHostname(hostname);
    return normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost');
}

function isPublicIpv4Address(address) {
    const octets = String(address || '').split('.').map((entry) => Number.parseInt(entry, 10));
    if (octets.length !== 4 || octets.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 255)) {
        return false;
    }

    const [first, second, third] = octets;

    if (first === 0 || first === 10 || first === 127 || first >= 224) {
        return false;
    }

    if (first === 100 && second >= 64 && second <= 127) {
        return false;
    }

    if (first === 169 && second === 254) {
        return false;
    }

    if (first === 172 && second >= 16 && second <= 31) {
        return false;
    }

    if (first === 192 && second === 0 && third === 0) {
        return false;
    }

    if (first === 192 && second === 168) {
        return false;
    }

    if (first === 198 && (second === 18 || second === 19)) {
        return false;
    }

    if (first >= 240) {
        return false;
    }

    return true;
}

function isPublicIpv6Address(address) {
    const normalizedAddress = String(address || '').trim().toLowerCase();
    if (!normalizedAddress) {
        return false;
    }

    if (normalizedAddress === '::' || normalizedAddress === '::1') {
        return false;
    }

    if (normalizedAddress.startsWith('::ffff:')) {
        return isPublicIpv4Address(normalizedAddress.slice('::ffff:'.length));
    }

    if (normalizedAddress.startsWith('fc') || normalizedAddress.startsWith('fd')) {
        return false;
    }

    if (/^fe[89ab]/.test(normalizedAddress)) {
        return false;
    }

    return true;
}

function isPublicIpAddress(address = '') {
    const ipVersion = net.isIP(String(address || '').trim());
    if (ipVersion === 4) {
        return isPublicIpv4Address(address);
    }

    if (ipVersion === 6) {
        return isPublicIpv6Address(address);
    }

    return false;
}

async function assertPublicRemoteUrl(parsedUrl, dnsLookupImpl = dns.lookup) {
    const hostname = normalizeHostname(parsedUrl && parsedUrl.hostname ? parsedUrl.hostname : '');
    if (!hostname) {
        throw new Error('Image must be a valid URL (http:// or https://).');
    }

    if (isDisallowedHostname(hostname)) {
        throw new Error('Image downloads from local or private network hosts are not allowed.');
    }

    if (net.isIP(hostname)) {
        if (!isPublicIpAddress(hostname)) {
            throw new Error('Image downloads from local or private network hosts are not allowed.');
        }

        return;
    }

    const addresses = await dnsLookupImpl(hostname, { all: true, verbatim: true });
    if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new Error('Unable to resolve the image host.');
    }

    if (addresses.some((entry) => !isPublicIpAddress(entry && entry.address ? entry.address : ''))) {
        throw new Error('Image downloads from local or private network hosts are not allowed.');
    }
}

function isRedirectResponse(response) {
    return Boolean(response && response.status >= 300 && response.status < 400);
}

async function fetchRemoteImageResponse(initialUrl, options = {}) {
    const {
        fetchImpl,
        dnsLookupImpl = dns.lookup,
        controller,
        maxRedirects = MAX_IMAGE_REDIRECTS
    } = options;

    let currentUrl = initialUrl;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        await assertPublicRemoteUrl(currentUrl, dnsLookupImpl);

        const response = await fetchImpl(currentUrl.toString(), {
            redirect: 'manual',
            signal: controller ? controller.signal : undefined,
            headers: {
                Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1'
            }
        });

        if (!isRedirectResponse(response)) {
            return response;
        }

        const location = response.headers && response.headers.get
            ? response.headers.get('location') || ''
            : '';
        if (!location) {
            throw new Error('Unable to download the image from the provided URL.');
        }

        if (redirectCount === maxRedirects) {
            throw new Error('Image URL redirected too many times.');
        }

        currentUrl = new URL(location, currentUrl);
    }

    throw new Error('Unable to download the image from the provided URL.');
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
        dnsLookupImpl = dns.lookup,
        storageDir = NOTE_IMAGE_STORAGE_DIR,
        timeoutMs = IMAGE_DOWNLOAD_TIMEOUT_MS,
        maxBytes = MAX_IMAGE_DOWNLOAD_BYTES,
        maxRedirects = MAX_IMAGE_REDIRECTS
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
        const response = await fetchRemoteImageResponse(parsedUrl, {
            fetchImpl,
            dnsLookupImpl,
            controller,
            maxRedirects
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
    MAX_IMAGE_REDIRECTS,
    MAX_IMAGE_DOWNLOAD_BYTES,
    NOTE_IMAGE_STORAGE_DIR,
    assertPublicRemoteUrl,
    buildNoteImagePublicPath,
    deleteNoteImageAsset,
    ensureStorageDirectory,
    fetchRemoteImageResponse,
    isPublicIpAddress,
    persistRemoteNoteImage,
    resolveStoredAssetPath
};
