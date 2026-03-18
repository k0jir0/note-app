const base = 'http://localhost:3000';
const cookieJar = {};
function updateCookies(res) {
  const sc = res.headers.get('set-cookie');
  if (!sc) return;
  // Node fetch concatenates multiple set-cookie into a single header sometimes; split on comma naive
  const parts = sc.split(/, (?=[^ ]+?=)/g);
  parts.forEach((p) => {
    const m = p.match(/^([^=]+)=([^;]+)/);
    if (m) cookieJar[m[1]] = m[2];
  });
}
function cookieHeader() {
  return Object.entries(cookieJar).map(([k,v]) => `${k}=${v}`).join('; ');
}
async function fetchWithCookies(path, opts={}){
  opts.headers = opts.headers || {};
  if (cookieHeader()) opts.headers['Cookie'] = cookieHeader();
  const res = await fetch(base+path, opts);
  // fetch in node may not expose set-cookie via single header; use headers.raw if available
  try { if (res.headers.raw && res.headers.raw()['set-cookie']) { res.headers.raw()['set-cookie'].forEach(c => { const m = c.match(/^([^=]+)=([^;]+)/); if (m) cookieJar[m[1]] = m[2]; }); } } catch(e){}
  updateCookies(res);
  return res;
}
(async ()=>{
  try{
    console.log('GET /auth/signup');
    let r = await fetchWithCookies('/auth/signup');
    let text = await r.text();
    const csrfMatch = text.match(/name="_csrf" value="([a-f0-9]+)"/);
    if(!csrfMatch) { console.error('CSRF token not found on signup page'); process.exit(1);} 
    const csrf = csrfMatch[1];
    const email = `probe+${Date.now()}@example.com`;
    const password = 'Password123!';
    const body = new URLSearchParams({email, password, _csrf: csrf});
    console.log('POST /auth/signup');
    r = await fetchWithCookies('/auth/signup', {method:'POST', body: body.toString(), headers:{'Content-Type':'application/x-www-form-urlencoded'}, redirect:'manual'});
    console.log('signup status', r.status);
    // get login csrf
    r = await fetchWithCookies('/auth/login');
    text = await r.text();
    const loginCsrf = text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    const loginBody = new URLSearchParams({email, password, _csrf: loginCsrf});
    console.log('POST /auth/login');
    r = await fetchWithCookies('/auth/login', {method:'POST', body: loginBody.toString(), headers:{'Content-Type':'application/x-www-form-urlencoded'}, redirect:'manual'});
    console.log('login status', r.status);
    // probe SSE
    console.log('GET /api/security/stream');
    const controller = new AbortController();
    const to = setTimeout(()=>controller.abort(), 5000);
    try{
      r = await fetchWithCookies('/api/security/stream', {signal: controller.signal});
      clearTimeout(to);
      console.log('stream status', r.status);
      const ct = r.headers.get('content-type');
      console.log('content-type', ct);
      if (r.status === 200) console.log('SSE reachable for authenticated user');
      else console.log('SSE returned', r.status);
    } catch(e){
      clearTimeout(to);
      console.error('stream request error', e.message);
    }
  }catch(e){
    console.error('error', e.message);
    process.exit(1);
  }
})();
