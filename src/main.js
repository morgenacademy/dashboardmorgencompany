import { renderApp } from './app.js';

window.addEventListener('hashchange', renderApp);
window.addEventListener('DOMContentLoaded', renderApp);
