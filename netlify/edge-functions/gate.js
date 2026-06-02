// Wachtwoord-gate met langlevende cookie. Draait op elke request (Netlify Edge / Deno).
// - Geen COCKPIT_PASSWORD ingesteld -> gate uit (site werkt direct, geen lockout-risico).
// - Juist wachtwoord -> 180-daagse HttpOnly-cookie -> daarna elke browserstart direct door.
const COOKIE = 'ck_gate';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 dagen

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loginPage(error) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morgen · Cockpit</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:'Barlow',system-ui,sans-serif;background:#0C0818;color:#F0ECF5;
 background-image:radial-gradient(ellipse 70% 50% at 50% -10%,rgba(91,45,142,.55),transparent 60%),radial-gradient(ellipse 50% 40% at 85% 70%,rgba(123,77,174,.25),transparent 50%)}
form{display:grid;gap:14px;width:min(360px,calc(100vw - 40px));padding:34px;border-radius:28px;background:rgba(155,111,207,.18);
 border:1px solid rgba(180,145,230,.38);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);box-shadow:0 4px 24px rgba(0,0,0,.4)}
.brand{font-weight:900;font-size:1.7rem;letter-spacing:.04em;text-transform:uppercase;text-align:center;margin-bottom:4px}
.brand span{color:#D8FE56}
input{height:46px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:1rem}
input:focus{outline:none;border-color:#9B6FCF;box-shadow:0 0 0 3px rgba(155,111,207,.22)}
button{height:46px;border:none;border-radius:14px;background:linear-gradient(135deg,#D8FE56,#b8e040);color:#1A1A2E;font:inherit;font-weight:700;font-size:.95rem;cursor:pointer}
button:hover{transform:translateY(-1px)}
.err{color:#FF8FB6;font-size:.85rem;text-align:center;margin:0}
</style></head>
<body><form method="POST" action="/__gate">
<div class="brand">MORGEN<span>.</span></div>
${error ? '<p class="err">Onjuist wachtwoord</p>' : ''}
<input type="password" name="password" placeholder="Wachtwoord" autofocus autocomplete="current-password" required>
<button type="submit">Toegang</button>
</form></body></html>`;
}

export default async (request, context) => {
  const password = Deno.env.get('COCKPIT_PASSWORD');
  if (!password) return; // gate uit

  const url = new URL(request.url);
  const expected = await sha256(password);

  if (url.pathname === '/__gate' && request.method === 'POST') {
    const form = await request.formData();
    if (form.get('password') !== password) {
      return new Response(loginPage(true), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: '/',
        'set-cookie': `${COOKIE}=${expected}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)ck_gate=([a-f0-9]{64})/);
  if (m && m[1] === expected) return; // geldige cookie -> doorlaten

  return new Response(loginPage(false), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};

export const config = { path: '/*' };
