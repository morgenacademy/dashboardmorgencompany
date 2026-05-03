import { renderApp } from './app.js';
import { renderLogin, getSession } from './ui/login.js';
import { supabase, loadAll } from './data/store.js';

let authed = false;

async function boot() {
  const session = await getSession();
  authed = !!session;
  if (authed) {
    renderApp();
    await loadAll();
  } else {
    renderLogin(boot);
  }
}

supabase.auth.onAuthStateChange(async (event, session) => {
  authed = !!session;
  if (event === 'SIGNED_IN') {
    renderApp();
    await loadAll();
  } else if (event === 'SIGNED_OUT') {
    renderLogin(boot);
  }
});

window.addEventListener('hashchange', () => { if (authed) renderApp(); });
window.addEventListener('DOMContentLoaded', boot);
