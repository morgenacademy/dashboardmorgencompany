import { renderApp } from './app.js';
import { renderLogin, getSession } from './ui/login.js';
import { supabase, loadAll } from './data/store.js';

let authed = false;
let bootRan = false;

async function boot() {
  if (bootRan) return;
  bootRan = true;
  console.log('[boot] starting…');
  try {
    const session = await Promise.race([
      getSession(),
      new Promise((_, r) => setTimeout(() => r(new Error('getSession timeout 6s')), 6000)),
    ]);
    authed = !!session;
    console.log('[boot] session check ok, authed =', authed);
  } catch (err) {
    console.error('[boot] session check failed:', err);
    authed = false;
  }
  if (authed) {
    renderApp();
    await loadAll();
  } else {
    renderLogin(() => { bootRan = false; boot(); });
  }
}

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[auth] event:', event, '· session:', !!session);
  authed = !!session;
  if (event === 'SIGNED_IN') {
    renderApp();
    await loadAll();
  } else if (event === 'SIGNED_OUT') {
    bootRan = false;
    renderLogin(boot);
  }
});

window.addEventListener('hashchange', () => { if (authed) renderApp(); });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
