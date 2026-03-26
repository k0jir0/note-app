const base = 'http://localhost:3000';
const cookieJar = {};

function updateCookies(res) {
    const setCookieHeader = res.headers.get('set-cookie');
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(/, (?=[^ ]+?=)/g);
    parts.forEach((part) => {
        const match = part.match(/^([^=]+)=([^;]+)/);
        if (match) cookieJar[match[1]] = match[2];
    });
}

function cookieHeader() {
    return Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ');
}

async function fetchWithCookies(path, opts = {}) {
    opts.headers = opts.headers || {};
    if (cookieHeader()) opts.headers.Cookie = cookieHeader();
    const res = await fetch(base + path, opts);
    try {
        if (res.headers.raw && res.headers.raw()['set-cookie']) {
            res.headers.raw()['set-cookie'].forEach((cookie) => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) cookieJar[match[1]] = match[2];
            });
        }
    } catch (error) {
        void error;
    }
    updateCookies(res);
    return res;
}

(async () => {
    try {
        console.log('GET /auth/signup');
        let response = await fetchWithCookies('/auth/signup');
        let text = await response.text();
        const signupCsrfMatch = text.match(/name="_csrf" value="([a-f0-9]+)"/);
        if (!signupCsrfMatch) {
            console.error('CSRF token not found on signup page');
            process.exit(1);
        }

        const email = `probe+${Date.now()}@example.com`;
        const password = 'Password123!';
        const signupBody = new URLSearchParams({ email, password, _csrf: signupCsrfMatch[1] });

        console.log('POST /auth/signup');
        response = await fetchWithCookies('/auth/signup', {
            method: 'POST',
            body: signupBody.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'manual'
        });
        console.log('signup status', response.status);

        console.log('GET /auth/login');
        response = await fetchWithCookies('/auth/login');
        text = await response.text();
        const loginCsrfMatch = text.match(/name="_csrf" value="([a-f0-9]+)"/);
        if (!loginCsrfMatch) {
            console.error('CSRF token not found on login page');
            process.exit(1);
        }

        const loginBody = new URLSearchParams({ email, password, _csrf: loginCsrfMatch[1] });

        console.log('POST /auth/login');
        response = await fetchWithCookies('/auth/login', {
            method: 'POST',
            body: loginBody.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'manual'
        });
        console.log('login status', response.status);

        console.log('GET /notes');
        response = await fetchWithCookies('/notes');
        text = await response.text();
        const metaCsrfMatch = text.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (!metaCsrfMatch) {
            console.error('CSRF token not found on notes page');
            process.exit(1);
        }
        const csrf = metaCsrfMatch[1];
        console.log('csrf token obtained');

        console.log('POST /api/settings/theme -> enable nightMode');
        response = await fetchWithCookies('/api/settings/theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
            body: JSON.stringify({ nightMode: true })
        });
        console.log('/api/settings/theme status', response.status);

        console.log('Reload /notes and check for body.dark-mode');
        response = await fetchWithCookies('/notes');
        text = await response.text();
        const hasDark = /<body[^>]*class="[^"]*dark-mode[^"]*"/.test(text);
        console.log('Dark mode present on server-rendered page after toggle:', hasDark);
        process.exit(hasDark ? 0 : 2);

    } catch (err) {
        console.error('error', err.message);
        process.exit(1);
    }
})();
