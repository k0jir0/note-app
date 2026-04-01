async function tryLoadKeytarGoogleSecrets() {
    if (process.env.DISABLE_KEYTAR === '1') {
        return { loaded: false, skipped: true };
    }

    try {
        const keytar = require('keytar');
        const service = 'note-app-local';

        const id = await keytar.getPassword(service, 'google_client_id');
        const secret = await keytar.getPassword(service, 'google_client_secret');

        if (id && id.trim().length > 0) {
            process.env.GOOGLE_CLIENT_ID = id.trim();
        }
        if (secret && secret.trim().length > 0) {
            process.env.GOOGLE_CLIENT_SECRET = secret.trim();
        }

        return { loaded: Boolean(id && secret) };
    } catch (err) {
        return { loaded: false, error: err };
    }
}

module.exports = {
    tryLoadKeytarGoogleSecrets
};
