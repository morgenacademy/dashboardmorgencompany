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
      new Promise((_, r) => setTimeout(() => r(new Error('getSession timeout 4s')), 4000)),
    ]);
    authed = !!session;
    console.log('[boot] session check ok, authed =', authed);
    // Als de access_token bijna/al verlopen is: proactief refresh om geen 401 op queries te krijgen.
    if (authed && session?.expires_at) {
      const expiresInSec = session.expires_at - Math.floor(Date.now() / 1000);
      if (expiresInSec < 120) {
        console.log('[boot] token bijna verlopen, refresh…');
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          console.warn('[boot] refresh mislukt, opnieuw inloggen');
          authed = false;
        }
      }
    }
  } catch (err) {
    console.error('[boot] session check failed:', err);
    authed = false;
  }
  if (authed) {
    renderApp();
    await loadAll();
    // Als loadAll een sessie-error gaf zal cache.error zijn gezet en supabase.auth.signOut() draaien
    // → onAuthStateChange SIGNED_OUT triggert renderLogin
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
