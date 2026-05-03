import { renderApp } from './app.js';
import { loadAll } from './data/store.js';

window.addEventListener('hashchange', renderApp);
window.addEventListener('DOMContentLoaded', async () => {
  renderApp();
  await loadAll();
});
