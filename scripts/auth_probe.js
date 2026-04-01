const base = 'http://localhost:3000';
const cookieJar = {};

function updateCookies(res) {
    const setCookieHeader = res.headers.get('set-cookie');
    if (!setCookieHeader) {
        return;
    }

    const parts = setCookieHeader.split(/, (?=[^ ]+?=)/g);
    parts.forEach((part) => {
        const match = part.match(/^([^=]+)=([^;]+)/);
        if (match) {
            cookieJar[match[1]] = match[2];
        }
    });
}

function cookieHeader() {
    return Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ');
}

async function fetchWithCookies(path, opts = {}) {
    opts.headers = opts.headers || {};
    if (cookieHeader()) {
        opts.headers.Cookie = cookieHeader();
    }

    const res = await fetch(base + path, opts);

    try {
        if (res.headers.raw && res.headers.raw()['set-cookie']) {
            res.headers.raw()['set-cookie'].forEach((cookie) => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) {
                    cookieJar[match[1]] = match[2];
                }
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
        const signupBody = new URLSearchParams({
            email,
            password,
            _csrf: signupCsrfMatch[1]
        });

        console.log('POST /auth/signup');
        response = await fetchWithCookies('/auth/signup', {
            method: 'POST',
            body: signupBody.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'manual'
        });
        console.log('signup status', response.status);

        response = await fetchWithCookies('/auth/login');
        text = await response.text();
        const loginCsrfMatch = text.match(/name="_csrf" value="([a-f0-9]+)"/);
        if (!loginCsrfMatch) {
            console.error('CSRF token not found on login page');
            process.exit(1);
        }

        const loginBody = new URLSearchParams({
            email,
            password,
            _csrf: loginCsrfMatch[1]
        });

        console.log('POST /auth/login');
        response = await fetchWithCookies('/auth/login', {
            method: 'POST',
            body: loginBody.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'manual'
        });
        console.log('login status', response.status);

        console.log('GET /api/security/stream');
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 5000);

        try {
            response = await fetchWithCookies('/api/security/stream', { signal: controller.signal });
            clearTimeout(timeoutHandle);
            console.log('stream status', response.status);
            console.log('content-type', response.headers.get('content-type'));
            if (response.status === 200) {
                console.log('SSE reachable for authenticated user');
            } else {
                console.log('SSE returned', response.status);
            }
        } catch (error) {
            clearTimeout(timeoutHandle);
            console.error('stream request error', error.message);
        }
    } catch (error) {
        console.error('error', error.message);
        process.exit(1);
    }
})();
