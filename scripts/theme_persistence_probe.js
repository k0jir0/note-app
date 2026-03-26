const base = 'http://localhost:3000';
const cookieJar = {};

function updateCookiesFromHeaders(setCookieHeaders) {
  if (!setCookieHeaders) return;
  setCookieHeaders.forEach((cookie) => {
    const match = cookie.match(/^([^=]+)=([^;]+)/);
    if (match) cookieJar[match[1]] = match[2];
  });
}

function cookieHeader() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function fetchWithCookies(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (cookieHeader()) opts.headers.Cookie = cookieHeader();
  const res = await fetch(base + path, opts);
  try {
    const raw = res.headers.raw && res.headers.raw()['set-cookie'];
    if (raw) updateCookiesFromHeaders(raw);
  } catch {};
  return res;
}

(async () => {
  try {
    console.log('Visiting signup page to get CSRF');
    let res = await fetchWithCookies('/auth/signup');
    let html = await res.text();
    const signupCsrfMatch = html.match(/name="_csrf" value="([a-f0-9]+)"/);
    if (!signupCsrfMatch) {
      console.error('No CSRF on signup page');
      process.exit(1);
    }

    const email = `probe+${Date.now()}@example.com`;
    const password = 'Password123!';
    const signupBody = new URLSearchParams({ email, password, _csrf: signupCsrfMatch[1] });

    console.log('POST /auth/signup');
    res = await fetchWithCookies('/auth/signup', { method: 'POST', body: signupBody.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    console.log('signup status', res.status);

    console.log('GET /auth/login');
    res = await fetchWithCookies('/auth/login');
    html = await res.text();
    const loginCsrfMatch = html.match(/name="_csrf" value="([a-f0-9]+)"/);
    if (!loginCsrfMatch) { console.error('No CSRF on login page'); process.exit(1); }

    const loginBody = new URLSearchParams({ email, password, _csrf: loginCsrfMatch[1] });
    console.log('POST /auth/login');
    res = await fetchWithCookies('/auth/login', { method: 'POST', body: loginBody.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    console.log('login status', res.status);

    console.log('GET /notes (to read CSRF meta and check auth)');
    res = await fetchWithCookies('/notes');
    html = await res.text();
    const metaCsrf = html.match(/<meta name="csrf-token" content="([^"]+)"/);
    if (!metaCsrf) { console.error('No meta csrf token on /notes'); process.exit(1); }
    const csrf = metaCsrf[1];
    console.log('csrf token obtained');

    console.log('POST /api/settings/theme -> enable nightMode');
    res = await fetchWithCookies('/api/settings/theme', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ nightMode: true }) });
    console.log('/api/settings/theme status', res.status);

    console.log('Reload /notes and check for body.dark-mode');
    res = await fetchWithCookies('/notes');
    html = await res.text();
    const hasDark = /<body[^>]*class="[^"]*dark-mode[^"]*"/.test(html);
    console.log('Dark mode present on server-rendered page after toggle:', hasDark);
    process.exit(hasDark ? 0 : 2);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();