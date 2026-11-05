import { state } from '../core/state';
import { deleteCanvas, deleteProject, loadCanvas, loadProject, saveCanvas, saveCurrentProject } from '../data/persistence';
import { renderApp } from '../ui/render_app';

export function attachProjectEvents() {
  // Project Management Listeners
  document.getElementById('sel-load-project')?.addEventListener('change', async (e) => {
    const projName = (e.target as HTMLSelectElement).value;
    if (projName) {
      await loadProject(projName);
    }
  });

  document.getElementById('btn-save-project')?.addEventListener('click', async () => {
    const inputEl = document.getElementById('inp-project-name') as HTMLInputElement | null;
    const name = inputEl?.value.trim() || state.activeProject;
    await saveCurrentProject(name);
  });

  document.getElementById('btn-new-project')?.addEventListener('click', () => {
    state.activeProject = '';
    state.activeCanvas = 'Canvas_1';
    renderApp();
  });

  document.getElementById('btn-delete-project')?.addEventListener('click', async () => {
    if (state.activeProject) {
      await deleteProject(state.activeProject);
    }
  });

  // Canvas Management Listeners
  document.getElementById('sel-canvas')?.addEventListener('change', async (e) => {
    const canvasName = (e.target as HTMLSelectElement).value;
    if (canvasName) {
      await loadCanvas(canvasName);
    }
  });

  document.getElementById('btn-save-canvas')?.addEventListener('click', async () => {
    await saveCanvas(state.activeCanvas || 'Canvas_1');
  });

  document.getElementById('btn-new-canvas')?.addEventListener('click', async () => {
    const existingCount = Object.keys(state.projectsStore[state.activeProject]?.canvases || {}).length;
    const newName = prompt('Enter new Canvas name:', `Canvas_${existingCount + 1}`);
    if (newName && newName.trim()) {
      state.activeCanvas = newName.trim();
      await saveCanvas(newName.trim());
    }
  });

  document.getElementById('btn-delete-canvas')?.addEventListener('click', async () => {
    if (state.activeCanvas) {
      await deleteCanvas(state.activeCanvas);
    }
  });
}
