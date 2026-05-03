import { supabase } from '../data/store.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.reload();
}

export function renderLogin(onSuccess) {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;position:relative;z-index:1;">
      <form id="login-form" class="panel stack-form" style="width:100%;max-width:420px;">
        <div>
          <span class="eyebrow" style="display:block;color:var(--accent);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:.7rem;margin-bottom:10px;">Internal operating system</span>
          <h2 style="margin:0;font-weight:900;color:var(--white);font-size:1.6rem;">Morgen Dashboard</h2>
          <p style="color:var(--text-secondary);margin:.4rem 0 0;">Log in om door te gaan.</p>
        </div>
        <label><span>E-mail</span><input type="email" name="email" autocomplete="email" required autofocus /></label>
        <label><span>Wachtwoord</span><input type="password" name="password" autocomplete="current-password" required /></label>
        <p id="login-error" style="color:#FF8FB6;margin:0;font-size:.85rem;display:none;"></p>
        <button type="submit" class="button primary" id="login-submit">Inloggen</button>
      </form>
    </div>`;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const submitBtn = document.getElementById('login-submit');
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Inloggen…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Inloggen';
    if (error) {
      errorEl.textContent = 'Inloggen mislukt: ' + error.message;
      errorEl.style.display = 'block';
      return;
    }
    onSuccess?.();
  });
}
