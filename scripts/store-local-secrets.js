const readline = require('readline');

async function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function run() {
    try {
        const keytar = require('keytar');
        const service = 'helios-local';

        console.log('This will store Google credentials in your OS keyring (Windows Credential Manager).');
        const id = (await prompt('Google Client ID: ')).trim();
        const secret = (await prompt('Google Client Secret: ')).trim();

        if (!id || !secret) {
            console.error('Both values are required.');
            process.exit(1);
        }

        await keytar.setPassword(service, 'google_client_id', id);
        await keytar.setPassword(service, 'google_client_secret', secret);

        console.log('Credentials stored in OS keyring under service:', service);
    } catch (err) {
        console.error('Failed to store secrets:', err.message || err);
        process.exit(1);
    }
}

run();
