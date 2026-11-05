import { state } from '../core/state';
import { renderApp } from '../ui/render_app';

export function attachShellEvents() {
  // Language Switcher (EN | IT)
  document.getElementById('btn-lang-en')?.addEventListener('click', () => {
    state.lang = 'en';
    renderApp();
  });
  document.getElementById('btn-lang-it')?.addEventListener('click', () => {
    state.lang = 'it';
    renderApp();
  });

  // Main Navigation Tabs
  document.getElementById('tab-nav-data')?.addEventListener('click', () => {
    state.currentTab = 'data';
    renderApp();
  });
  document.getElementById('tab-nav-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
  });
  document.getElementById('tab-nav-multi')?.addEventListener('click', () => {
    state.currentTab = 'multi';
    renderApp();
  });
  document.getElementById('tab-nav-maps')?.addEventListener('click', () => {
    state.currentTab = 'maps';
    renderApp();
  });
  document.getElementById('tab-nav-physics')?.addEventListener('click', () => {
    state.currentTab = 'physics';
    renderApp();
  });
  document.getElementById('tab-nav-editorial')?.addEventListener('click', () => {
    state.currentTab = 'editorial';
    renderApp();
  });

  document.getElementById('btn-goto-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
  });
  document.getElementById('btn-goto-maps')?.addEventListener('click', () => {
    state.currentTab = 'maps';
    renderApp();
  });

  // Progressive Sub-Tabs (Single Canvas)
  document.querySelectorAll('[data-csub]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sub = (e.currentTarget as HTMLElement).getAttribute('data-csub') as any;
      if (sub) {
        state.canvasSubTab = sub;
        renderApp();
      }
    });
  });

  // Progressive Sub-Tabs (MultiPlot)
  document.querySelectorAll('[data-mpsub]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sub = (e.currentTarget as HTMLElement).getAttribute('data-mpsub') as any;
      if (sub) {
        state.mpSubTab = sub;
        renderApp();
      }
    });
  });
}
