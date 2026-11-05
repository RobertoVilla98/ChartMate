import './style.css';
import { fetchProjectsStore } from './data/persistence';
import { renderApp } from './ui/render_app';

async function initApp() {
  await fetchProjectsStore();
  renderApp();
}

initApp();
