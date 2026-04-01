function isHex64(value) {
    return /^[a-fA-F0-9]{64}$/.test(value);
}

function isBase64Of32Bytes(value) {
    try {
        const buffer = Buffer.from(value, 'base64');
        return buffer.length === 32;
    } catch (error) {
        return false;
    }
}

const required = [
    'MONGODB_URI',
    'SESSION_SECRET',
    'NOTE_ENCRYPTION_KEY'
];

const errors = [];

required.forEach((name) => {
    if (!process.env[name] || String(process.env[name]).trim() === '') {
        errors.push(`${name} is missing or empty`);
    }
});

if (process.env.SESSION_SECRET && String(process.env.SESSION_SECRET).length < 32) {
    errors.push('SESSION_SECRET should be at least 32 characters long');
}

if (process.env.NOTE_ENCRYPTION_KEY) {
    const key = String(process.env.NOTE_ENCRYPTION_KEY).trim();
    if (!isHex64(key) && !isBase64Of32Bytes(key)) {
        errors.push('NOTE_ENCRYPTION_KEY must be 64 hex chars or base64 that decodes to 32 bytes');
    }
}

const clientId = process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
if ((clientId && !clientSecret) || (!clientId && clientSecret)) {
    errors.push('Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to enable Google OAuth');
}

if (errors.length) {
    console.error('Environment check failed:');
    errors.forEach((error) => console.error(' -', error));
    process.exitCode = 2;
    process.exit(2);
}

console.log('Environment check passed - required variables present and valid.');
process.exit(0);
