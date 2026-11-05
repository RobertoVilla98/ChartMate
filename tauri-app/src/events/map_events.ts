import { updateMapChart } from '../charts/map';
import { MAP_PRESETS, state } from '../core/state';
import { persistProjectsStore, saveMapConfig } from '../data/persistence';
import { renderApp } from '../ui/render_app';

export function attachMapEvents() {
  // Maps Studio Listeners
  document.querySelectorAll('.map-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = (e.currentTarget as HTMLElement).getAttribute('data-mapmode') as any;
      if (mode) {
        state.mapMode = mode;
        renderApp();
      }
    });
  });

  document.getElementById('map-basemap')?.addEventListener('change', (e) => {
    state.mapBasemap = (e.target as HTMLSelectElement).value as any;
    updateMapChart();
  });

  document.getElementById('map-lat-col')?.addEventListener('change', (e) => {
    state.geoLatCol = (e.target as HTMLSelectElement).value;
    renderApp();
  });

  document.getElementById('map-lon-col')?.addEventListener('change', (e) => {
    state.geoLonCol = (e.target as HTMLSelectElement).value;
    renderApp();
  });

  document.getElementById('map-color-col')?.addEventListener('change', (e) => {
    state.mapColorCol = (e.target as HTMLSelectElement).value;
    updateMapChart();
  });

  document.getElementById('map-size-col')?.addEventListener('change', (e) => {
    state.mapSizeCol = (e.target as HTMLSelectElement).value;
    updateMapChart();
  });

  document.getElementById('map-colorscale')?.addEventListener('change', (e) => {
    state.mapColorscale = (e.target as HTMLSelectElement).value as any;
    updateMapChart();
  });

  document.getElementById('map-decimals')?.addEventListener('change', (e) => {
    state.mapDecimals = (e.target as HTMLSelectElement).value as any;
    updateMapChart();
  });

  document.getElementById('map-cluster-toggle')?.addEventListener('change', (e) => {
    state.mapClusterEnabled = (e.target as HTMLInputElement).checked;
    renderApp();
  });

  document.getElementById('map-cluster-agg')?.addEventListener('change', (e) => {
    state.mapClusterAgg = (e.target as HTMLSelectElement).value as any;
    updateMapChart();
  });

  document.getElementById('map-cluster-grid')?.addEventListener('change', (e) => {
    state.mapClusterGridDeg = parseFloat((e.target as HTMLSelectElement).value) || 0.005;
    updateMapChart();
  });

  document.querySelectorAll('.map-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-mappreset') as keyof typeof MAP_PRESETS | null;
      if (p && MAP_PRESETS[p]) {
        state.mapPreset = p;
        state.mapWidthCm = MAP_PRESETS[p].w;
        state.mapHeightCm = MAP_PRESETS[p].h;
        renderApp();
      }
    });
  });

  document.getElementById('sel-map')?.addEventListener('change', (e) => {
    const mapName = (e.target as HTMLSelectElement).value;
    if (mapName && state.activeProject && state.projectsStore[state.activeProject]?.maps?.[mapName]) {
      const cfg = state.projectsStore[state.activeProject].maps![mapName];
      state.activeMap = cfg.name;
      state.mapMode = cfg.mode;
      state.mapBasemap = cfg.basemap;
      if (cfg.lat_col) state.geoLatCol = cfg.lat_col;
      if (cfg.lon_col) state.geoLonCol = cfg.lon_col;
      if (cfg.coord_format) state.geoCoordFormat = cfg.coord_format;
      state.mapColorCol = cfg.color_col;
      state.mapSizeCol = cfg.size_col;
      state.mapClusterEnabled = cfg.cluster_enabled;
      state.mapClusterAgg = cfg.cluster_agg;
      state.mapClusterGridDeg = cfg.cluster_grid_deg;
      state.mapColorscale = cfg.colorscale;
      state.mapDecimals = cfg.decimals || '1';
      state.mapPreset = cfg.preset as any;
      state.mapWidthCm = cfg.width_cm;
      state.mapHeightCm = cfg.height_cm;
      renderApp();
    }
  });

  document.getElementById('btn-save-map')?.addEventListener('click', async () => {
    await saveMapConfig(state.activeMap || 'Map_1');
  });

  document.getElementById('btn-new-map')?.addEventListener('click', async () => {
    const newName = prompt('Enter new Map name:', `Map_${Date.now().toString().slice(-3)}`);
    if (newName && newName.trim()) {
      state.activeMap = newName.trim();
      await saveMapConfig(newName.trim());
    }
  });

  document.getElementById('btn-delete-map')?.addEventListener('click', async () => {
    if (!state.activeProject || !state.projectsStore[state.activeProject]?.maps) return;
    delete state.projectsStore[state.activeProject].maps![state.activeMap];
    await persistProjectsStore();
    renderApp();
  });
}
