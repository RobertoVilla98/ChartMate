import { invoke } from '@tauri-apps/api/core';
import { state, t } from '../core/state';
import type { CanvasConfig, ProjectConfig, ProjectsStore } from '../core/types';
import { loadFile } from './loader';
import { renderApp } from '../ui/render_app';

export async function saveMultiPlot(mpName: string) {
  if (!state.activeProject) {
    await saveCurrentProject('IEQ_Project');
  }
  if (!state.activeProject) return;
  const proj = state.projectsStore[state.activeProject];
  if (!proj.multiplots) proj.multiplots = {};
  proj.multiplots[mpName] = {
    name: mpName,
    topology: state.mpTopology,
    custom_rows: state.mpCustomRows,
    custom_cols: state.mpCustomCols,
    share_x: state.mpShareX,
    share_y: state.mpShareY,
    auto_lettering: state.mpAutoLettering,
    letter_pos: state.mpLetterPos,
    legend_mode: state.mpLegendMode,
    macro_x_label: state.mpMacroX,
    macro_y_label: state.mpMacroY,
    grid_frame: { ...state.gridFrame },
    preset: state.mpPreset,
    width_cm: state.mpWidthCm,
    height_cm: state.mpHeightCm,
    panels: JSON.parse(JSON.stringify(state.mpPanels))
  };
  await persistProjectsStore();
  renderApp();
}

export async function saveMapConfig(mapName: string) {
  if (!state.activeProject) {
    await saveCurrentProject('GIS_Project');
  }
  if (!state.activeProject) return;
  const proj = state.projectsStore[state.activeProject];
  if (!proj.maps) proj.maps = {};
  proj.maps[mapName] = {
    name: mapName,
    mode: state.mapMode,
    basemap: state.mapBasemap,
    lat_col: state.geoLatCol,
    lon_col: state.geoLonCol,
    coord_format: state.geoCoordFormat,
    color_col: state.mapColorCol,
    size_col: state.mapSizeCol,
    decimals: state.mapDecimals,
    cluster_enabled: state.mapClusterEnabled,
    cluster_agg: state.mapClusterAgg,
    cluster_grid_deg: state.mapClusterGridDeg,
    colorscale: state.mapColorscale,
    preset: state.mapPreset,
    width_cm: state.mapWidthCm,
    height_cm: state.mapHeightCm
  };
  await persistProjectsStore();
  renderApp();
}

export function serializeCanvasConfig(name: string): CanvasConfig {
  return {
    name,
    selected_x: state.selectedX,
    x_title: state.xTitle,
    traces: JSON.parse(JSON.stringify(state.traces)),
    y1_title: state.y1Title,
    y2_title: state.y2Title,
    y3_title: state.y3Title,
    y4_title: state.y4Title,
    axis_scales: JSON.parse(JSON.stringify(state.axisScales)),
    grid_frame: { ...state.gridFrame },
    legend_pos: state.legendPos,
    timeframe_mode: state.timeframeMode,
    start_date: state.startDate,
    end_date: state.endDate,
    preset: state.preset,
    width_cm: state.widthCm,
    height_cm: state.heightCm,
    font_family: state.fontFamily,
    font_size: state.fontSize,
    peak_mode: state.peakMode,
    comfort_band: state.comfortBand,
    comfort_season: state.comfortSeason,
    comfort_min: state.comfortMin,
    comfort_max: state.comfortMax,
  };
}

export function applyCanvasConfig(cfg: CanvasConfig) {
  state.activeCanvas = cfg.name;
  state.selectedX = cfg.selected_x || '';
  state.xTitle = cfg.x_title || '';
  state.traces = cfg.traces ? JSON.parse(JSON.stringify(cfg.traces)) : [];
  state.y1Title = cfg.y1_title || '';
  state.y2Title = cfg.y2_title || '';
  state.y3Title = cfg.y3_title || '';
  state.y4Title = cfg.y4_title || '';
  if (cfg.axis_scales) {
    state.axisScales = JSON.parse(JSON.stringify(cfg.axis_scales));
  }
  if (cfg.grid_frame) {
    state.gridFrame = { ...cfg.grid_frame };
  }
  state.legendPos = cfg.legend_pos || 'top';
  state.timeframeMode = cfg.timeframe_mode || 'all';
  state.startDate = cfg.start_date || '';
  state.endDate = cfg.end_date || '';
  state.preset = cfg.preset || 'double';
  state.widthCm = cfg.width_cm || 17.0;
  state.heightCm = cfg.height_cm || 9.5;
  state.fontFamily = cfg.font_family || 'Outfit, sans-serif';
  state.fontSize = cfg.font_size || 11;
  state.peakMode = cfg.peak_mode || 'none';
  state.comfortBand = !!cfg.comfort_band;
  state.comfortSeason = cfg.comfort_season || 'winter';
  state.comfortMin = cfg.comfort_min ?? 20.0;
  state.comfortMax = cfg.comfort_max ?? 22.0;
}

export async function fetchProjectsStore() {
  try {
    const res = await invoke<ProjectsStore>('load_projects_store');
    state.projectsStore = res || {};
  } catch (err) {
    console.error('Failed to load projects store:', err);
    state.projectsStore = {};
  }
}

export async function persistProjectsStore() {
  try {
    await invoke('save_projects_store', { data: state.projectsStore });
  } catch (err) {
    console.error('Failed to save projects store:', err);
    alert(`Error saving projects store: ${err}`);
  }
}

const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Writes the analysis settings (row limit, Tab 5, Tab 6) into a project. */
function storeAnalysisSettings(p: ProjectConfig) {
  p.row_limit = state.rowLimit;
  p.physics = {
    mode: state.physicsMode,
    carpet: deepCopy(state.carpetState),
    comfort: deepCopy(state.comfortState),
    duration: deepCopy(state.durationState),
    calib: deepCopy(state.calibState)
  };
  p.editorial = deepCopy(state.editorialState);
}

/**
 * Restores the Tab 5 / Tab 6 settings of a project. Called after the data are loaded, because
 * loading picks default columns; a saved column name is kept only if the dataset still has it.
 */
function restoreAnalysisSettings(p: ProjectConfig) {
  const cols = new Set(state.dataset?.columns ?? []);
  const keepCols = <T extends object>(saved: T, current: T): T => {
    const out: any = { ...current, ...deepCopy(saved) };
    for (const [k, v] of Object.entries(saved)) {
      if (/col$/i.test(k) && typeof v === 'string' && v !== '' && cols.size > 0 && !cols.has(v)) {
        out[k] = (current as any)[k];
      }
    }
    return out;
  };
  if (p.physics) {
    state.physicsMode = p.physics.mode || state.physicsMode;
    if (p.physics.carpet) state.carpetState = keepCols(p.physics.carpet, state.carpetState);
    if (p.physics.comfort) state.comfortState = keepCols(p.physics.comfort, state.comfortState);
    if (p.physics.duration) state.durationState = keepCols(p.physics.duration, state.durationState);
    if (p.physics.calib) state.calibState = keepCols(p.physics.calib, state.calibState);
  }
  if (p.editorial) {
    const ed = deepCopy(p.editorial);
    if (cols.size > 0) {
      ed.variables = (ed.variables || []).filter(v => cols.has(v.column));
      if (ed.variables.length === 0) ed.variables = state.editorialState.variables;
    }
    state.editorialState = { ...state.editorialState, ...ed };
  }
}

export async function saveCurrentProject(projectName?: string) {
  let name = (projectName || state.activeProject || '').trim();
  if (!name) {
    const prompted = prompt('Enter a project name:', 'New_IEQ_Project');
    if (!prompted || !prompted.trim()) return;
    name = prompted.trim();
  }

  state.activeProject = name;

  if (!state.projectsStore[name]) {
    state.projectsStore[name] = {
      name,
      lang: state.lang,
      file_path: state.filePath || '',
      data_fingerprint: state.dataFingerprint || undefined,
      source_type: state.sourceType,
      sql_config: {
        host: state.sqlConfig.host,
        port: state.sqlConfig.port,
        database: state.sqlConfig.database,
        user: state.sqlConfig.user,
        query: state.sqlQuery
      },
      geo_config: {
        coord_format: state.geoCoordFormat,
        lat_col: state.geoLatCol,
        lon_col: state.geoLonCol
      },
      separator: state.separator,
      decimal: state.decimal,
      has_timestamp: state.hasTimestamp,
      timestamp_col: state.timestampCol,
      timestamp_format: state.timestampFormat,
      active_canvas: state.activeCanvas || 'Canvas_1',
      updated_at: new Date().toISOString(),
      canvases: {},
      multiplots: {},
      maps: {}
    };
  } else {
    state.projectsStore[name].lang = state.lang;
    state.projectsStore[name].file_path = state.filePath || '';
    state.projectsStore[name].data_fingerprint = state.dataFingerprint || undefined;
    state.projectsStore[name].source_type = state.sourceType;
    state.projectsStore[name].sql_config = {
      host: state.sqlConfig.host,
      port: state.sqlConfig.port,
      database: state.sqlConfig.database,
      user: state.sqlConfig.user,
      query: state.sqlQuery
    };
    state.projectsStore[name].geo_config = {
      coord_format: state.geoCoordFormat,
      lat_col: state.geoLatCol,
      lon_col: state.geoLonCol
    };
    state.projectsStore[name].separator = state.separator;
    state.projectsStore[name].decimal = state.decimal;
    state.projectsStore[name].has_timestamp = state.hasTimestamp;
    state.projectsStore[name].timestamp_col = state.timestampCol;
    state.projectsStore[name].timestamp_format = state.timestampFormat;
    state.projectsStore[name].updated_at = new Date().toISOString();
  }

  storeAnalysisSettings(state.projectsStore[name]);

  const currentCanvasName = state.activeCanvas || 'Canvas_1';
  state.projectsStore[name].canvases[currentCanvasName] = serializeCanvasConfig(currentCanvasName);
  state.projectsStore[name].active_canvas = currentCanvasName;

  await persistProjectsStore();
  renderApp();
}

export async function loadProject(projectName: string) {
  const p = state.projectsStore[projectName];
  if (!p) return;

  state.activeProject = projectName;
  if (p.lang) state.lang = p.lang;
  state.sourceType = p.source_type || 'file';
  if (p.sql_config) {
    state.sqlConfig = {
      host: p.sql_config.host,
      port: p.sql_config.port,
      database: p.sql_config.database,
      user: p.sql_config.user,
      password: ''
    };
    state.sqlQuery = p.sql_config.query || 'SELECT * FROM sensor_readings LIMIT 50000;';
  }
  if (p.geo_config) {
    state.geoCoordFormat = p.geo_config.coord_format || 'decimal_degrees';
    state.geoLatCol = p.geo_config.lat_col || '';
    state.geoLonCol = p.geo_config.lon_col || '';
  }
  state.separator = p.separator || 'auto';
  state.decimal = p.decimal || '.';
  state.hasTimestamp = !!p.has_timestamp;
  state.timestampCol = p.timestamp_col || '';
  state.timestampFormat = p.timestamp_format || '%Y-%m-%d %H:%M:%S';
  if (typeof p.row_limit === 'number') state.rowLimit = p.row_limit;

  const canvasKeys = Object.keys(p.canvases || {});
  const targetCanvasName = p.active_canvas && p.canvases[p.active_canvas]
    ? p.active_canvas
    : (canvasKeys.length > 0 ? canvasKeys[0] : 'Canvas_1');

  if (p.canvases && p.canvases[targetCanvasName]) {
    applyCanvasConfig(p.canvases[targetCanvasName]);
  } else {
    state.activeCanvas = targetCanvasName;
  }

  if (p.file_path && !p.file_path.startsWith('mysql://')) {
    await loadFile(p.file_path, false);
    // Reproducibility check: warn if the data file changed since the project was saved.
    if (p.data_fingerprint) {
      try {
        const fp = await invoke<{ size: number; sha256: string }>('file_fingerprint', { filePath: p.file_path });
        state.dataFingerprint = fp;
        if (fp.sha256 !== p.data_fingerprint.sha256) {
          alert(t('fingerprint_mismatch').replace('{path}', p.file_path));
        }
      } catch { /* file missing: loadFile already reported it */ }
    }
    restoreAnalysisSettings(p);
    renderApp();
  } else {
    state.filePath = p.file_path || null;
    restoreAnalysisSettings(p);
    renderApp();
  }
}

export async function deleteProject(projectName: string) {
  if (!confirm(`Are you sure you want to delete project "${projectName}"?`)) {
    return;
  }
  delete state.projectsStore[projectName];
  if (state.activeProject === projectName) {
    state.activeProject = '';
  }
  await persistProjectsStore();
  renderApp();
}

export async function saveCanvas(canvasName: string) {
  if (!state.activeProject) {
    const projName = prompt('Create a Project first. Project Name:', 'Project_1');
    if (!projName || !projName.trim()) return;
    state.activeProject = projName.trim();
    state.projectsStore[state.activeProject] = {
      name: state.activeProject,
      lang: state.lang,
      file_path: state.filePath || '',
      separator: state.separator,
      decimal: state.decimal,
      has_timestamp: state.hasTimestamp,
      timestamp_col: state.timestampCol,
      timestamp_format: state.timestampFormat,
      active_canvas: canvasName,
      updated_at: new Date().toISOString(),
      canvases: {}
    };
  }

  state.activeCanvas = canvasName;
  state.projectsStore[state.activeProject].canvases[canvasName] = serializeCanvasConfig(canvasName);
  state.projectsStore[state.activeProject].active_canvas = canvasName;
  state.projectsStore[state.activeProject].updated_at = new Date().toISOString();

  await persistProjectsStore();
  renderApp();
}

export async function loadCanvas(canvasName: string) {
  if (!state.activeProject || !state.projectsStore[state.activeProject]) return;
  if (state.activeCanvas && state.projectsStore[state.activeProject].canvases[state.activeCanvas]) {
    state.projectsStore[state.activeProject].canvases[state.activeCanvas] = serializeCanvasConfig(state.activeCanvas);
  }
  const cfg = state.projectsStore[state.activeProject].canvases[canvasName];
  if (cfg) {
    applyCanvasConfig(cfg);
    state.projectsStore[state.activeProject].active_canvas = canvasName;
    await persistProjectsStore();
    renderApp();
  }
}

export async function deleteCanvas(canvasName: string) {
  if (!state.activeProject || !state.projectsStore[state.activeProject]) return;
  const proj = state.projectsStore[state.activeProject];
  const keys = Object.keys(proj.canvases);
  if (keys.length <= 1) {
    alert('Cannot delete the only chart in the project.');
    return;
  }
  if (!confirm(`Delete canvas "${canvasName}"?`)) return;

  delete proj.canvases[canvasName];
  const remaining = Object.keys(proj.canvases);
  const nextCanvas = remaining[0];
  proj.active_canvas = nextCanvas;
  applyCanvasConfig(proj.canvases[nextCanvas]);
  await persistProjectsStore();
  renderApp();
}
