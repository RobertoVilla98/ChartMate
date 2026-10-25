import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';

interface DatasetPreview {
  columns: string[];
  rows: string[][];
  total_rows: number;
  detected_sep: string;
  suggested_ts_col?: string;
  suggested_ts_format?: string;
}

interface ParseOptions {
  separator?: string;
  decimal?: string;
  timestamp_col?: string;
  timestamp_format?: string;
  max_rows?: number;
}

interface TraceConfig {
  column: string;
  axis: 'y1' | 'y2' | 'y3' | 'y4';
  chartType: 'line' | 'scatter' | 'bar' | 'area';
  color: string;
  lineWidth: number;
  lineDash: 'solid' | 'dash' | 'dot';
}

interface CanvasConfig {
  name: string;
  selected_x: string;
  traces: TraceConfig[];
  y1_title: string;
  y2_title: string;
  y3_title: string;
  y4_title: string;
  timeframe_mode: 'all' | 'day' | 'week' | 'month' | 'custom';
  start_date: string;
  end_date: string;
  preset: 'single' | 'double' | 'square' | 'custom';
  width_cm: number;
  height_cm: number;
  font_family: string;
  font_size: number;
  peak_mode: 'none' | 'global' | 'daily' | 'weekly';
  comfort_band: boolean;
  comfort_season: 'winter' | 'summer' | 'custom';
  comfort_min: number;
  comfort_max: number;
}

interface SqlConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

interface SqlConnectionStatus {
  connected: boolean;
  latency_ms: number;
  tables: string[];
  message: string;
}

interface MultiPlotPanelConfig {
  y1Col: string;
  y1Type: 'line' | 'scatter' | 'bar' | 'area';
  y1Color: string;
  y2Col: string;
  y2Color: string;
  yTitle: string;
}

interface MultiPlotConfig {
  name: string;
  topology: '3x1' | '2x1' | '2x2' | '1x2';
  share_x: boolean;
  auto_lettering: boolean;
  preset: 'single_stack' | 'double_stack' | 'square_grid' | 'custom';
  width_cm: number;
  height_cm: number;
  panels: MultiPlotPanelConfig[];
}

interface MapConfig {
  name: string;
  mode: 'bubble' | 'density' | 'track';
  basemap: 'carto-positron' | 'esri-satellite' | 'open-street-map' | 'carto-darkmatter' | 'opentopomap';
  lat_col: string;
  lon_col: string;
  coord_format: 'decimal_degrees' | 'dms';
  color_col: string;
  size_col: string;
  colorscale: 'Viridis' | 'Plasma' | 'RdBu' | 'YlOrRd' | 'Emerald';
  cluster_enabled: boolean;
  cluster_grid_deg: number;
  cluster_agg: 'mean' | 'sum' | 'mode' | 'max' | 'min' | 'count';
  preset: 'single' | 'double' | 'square' | 'custom';
  width_cm: number;
  height_cm: number;
}

interface ProjectConfig {
  name: string;
  source_type?: 'file' | 'sql';
  file_path: string;
  sql_config?: {
    host: string;
    port: number;
    database: string;
    user: string;
    query: string;
  };
  geo_config?: {
    lat_col: string;
    lon_col: string;
    coord_format: 'decimal_degrees' | 'dms';
  };
  separator: string;
  decimal: string;
  has_timestamp: boolean;
  timestamp_col: string;
  timestamp_format: string;
  active_canvas?: string;
  active_multiplot?: string;
  active_map?: string;
  updated_at?: string;
  canvases: Record<string, CanvasConfig>;
  multiplots?: Record<string, MultiPlotConfig>;
  maps?: Record<string, MapConfig>;
}

type ProjectsStore = Record<string, ProjectConfig>;

interface AppState {
  currentTab: 'data' | 'canvas' | 'multi' | 'maps';
  sourceType: 'file' | 'sql';
  filePath: string | null;
  dataset: DatasetPreview | null;

  // SQL Connection State
  sqlConfig: SqlConnectionConfig;
  sqlQuery: string;
  sqlStatus: SqlConnectionStatus | null;

  // Project & Canvas Persistence
  activeProject: string;
  activeCanvas: string;
  activeMultiPlot: string;
  activeMap: string;
  projectsStore: ProjectsStore;

  // Ingestion & Parsing Config
  separator: string;
  decimal: string;
  hasTimestamp: boolean;
  timestampCol: string;
  timestampFormat: string;

  // Geospatial Global Metadata
  geoLatCol: string;
  geoLonCol: string;
  geoCoordFormat: 'decimal_degrees' | 'dms';

  // Timeframe Filtering
  timeframeMode: 'all' | 'day' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;

  // Canvas Mapping & Axes
  selectedX: string;
  traces: TraceConfig[];
  preset: 'single' | 'double' | 'square' | 'custom';
  widthCm: number;
  heightCm: number;

  // Axis Titles
  y1Title: string;
  y2Title: string;
  y3Title: string;
  y4Title: string;

  // Typography
  fontFamily: string;
  fontSize: number;

  // Smart Annotations
  peakMode: 'none' | 'global' | 'daily' | 'weekly';
  comfortBand: boolean;
  comfortSeason: 'winter' | 'summer' | 'custom';
  comfortMin: number;
  comfortMax: number;
  comfortColor: string;

  // MultiPlot Grid State
  mpTopology: '3x1' | '2x1' | '2x2' | '1x2';
  mpShareX: boolean;
  mpAutoLettering: boolean;
  mpPreset: 'single_stack' | 'double_stack' | 'square_grid' | 'custom';
  mpWidthCm: number;
  mpHeightCm: number;
  mpPanels: MultiPlotPanelConfig[];

  // Maps & Geo-Analytics State
  mapMode: 'bubble' | 'density' | 'track';
  mapBasemap: 'carto-positron' | 'esri-satellite' | 'open-street-map' | 'carto-darkmatter' | 'opentopomap';
  mapColorCol: string;
  mapSizeCol: string;
  mapColorscale: 'Viridis' | 'Plasma' | 'RdBu' | 'YlOrRd' | 'Emerald';
  mapClusterEnabled: boolean;
  mapClusterGridDeg: number;
  mapClusterAgg: 'mean' | 'sum' | 'mode' | 'max' | 'min' | 'count';
  mapPreset: 'single' | 'double' | 'square' | 'custom';
  mapWidthCm: number;
  mapHeightCm: number;
  mapLastClusterCount: number;
  mapLastSummaryStat: string;
}

const DEFAULT_PALETTE = ['#000000', '#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48'];

const state: AppState = {
  currentTab: 'data',
  sourceType: 'file',
  filePath: null,
  dataset: null,
  sqlConfig: {
    host: 'localhost',
    port: 3306,
    database: 'monitoring_db',
    user: 'root',
    password: ''
  },
  sqlQuery: 'SELECT * FROM sensor_readings LIMIT 50000;',
  sqlStatus: null,
  activeProject: '',
  activeCanvas: 'Canvas_1',
  activeMultiPlot: 'MultiPlot_1',
  activeMap: 'Mappa_1',
  projectsStore: {},
  separator: 'auto',
  decimal: '.',
  hasTimestamp: true,
  timestampCol: '',
  timestampFormat: '%Y-%m-%d %H:%M:%S',
  geoLatCol: '',
  geoLonCol: '',
  geoCoordFormat: 'decimal_degrees',
  timeframeMode: 'all',
  startDate: '',
  endDate: '',
  selectedX: '',
  traces: [],
  preset: 'double',
  widthCm: 17.0,
  heightCm: 9.5,
  y1Title: '',
  y2Title: '',
  y3Title: '',
  y4Title: '',
  fontFamily: 'Outfit, sans-serif',
  fontSize: 11,
  peakMode: 'none',
  comfortBand: false,
  comfortSeason: 'winter',
  comfortMin: 20.0,
  comfortMax: 22.0,
  comfortColor: 'rgba(5, 150, 105, 0.12)',
  mpTopology: '3x1',
  mpShareX: true,
  mpAutoLettering: true,
  mpPreset: 'double_stack',
  mpWidthCm: 17.0,
  mpHeightCm: 13.5,
  mpPanels: [
    { y1Col: '', y1Type: 'line', y1Color: '#000000', y2Col: '', y2Color: '#0284c7', yTitle: 'Panel (a)' },
    { y1Col: '', y1Type: 'line', y1Color: '#059669', y2Col: '', y2Color: '#d97706', yTitle: 'Panel (b)' },
    { y1Col: '', y1Type: 'bar', y1Color: '#0284c7', y2Col: '', y2Color: '#7c3aed', yTitle: 'Panel (c)' },
    { y1Col: '', y1Type: 'area', y1Color: '#d97706', y2Col: '', y2Color: '#e11d48', yTitle: 'Panel (d)' }
  ],
  mapMode: 'bubble',
  mapBasemap: 'carto-positron',
  mapColorCol: '',
  mapSizeCol: '',
  mapColorscale: 'Viridis',
  mapClusterEnabled: false,
  mapClusterGridDeg: 0.002,
  mapClusterAgg: 'mean',
  mapPreset: 'double',
  mapWidthCm: 17.0,
  mapHeightCm: 10.5,
  mapLastClusterCount: 0,
  mapLastSummaryStat: ''
};

const PRESETS = {
  single: { w: 8.5, h: 6.5 },
  double: { w: 17.0, h: 9.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 9.5 }
};

const MP_PRESETS = {
  single_stack: { w: 8.5, h: 11.5 },
  double_stack: { w: 17.0, h: 13.5 },
  square_grid: { w: 14.0, h: 14.0 },
  custom: { w: 17.0, h: 13.5 }
};

const MAP_PRESETS = {
  single: { w: 8.5, h: 7.5 },
  double: { w: 17.0, h: 10.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 10.5 }
};

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

function renderApp() {
  appContainer.innerHTML = `
    <!-- Top Navigation Bar -->
    <header class="cm-navbar">
      <div class="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V21H21" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M7 16L12 11L15 14L20 7" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="20" cy="7" r="2.5" fill="#0284c7"/>
        </svg>
        <span>CHARTMATE</span>
        <span class="brand-badge">DESKTOP STUDIO</span>
      </div>
      <nav class="nav-tabs">
        <button class="nav-btn ${state.currentTab === 'data' ? 'active' : ''}" id="tab-nav-data">1. Data Source & Parser</button>
        <button class="nav-btn ${state.currentTab === 'canvas' ? 'active' : ''}" id="tab-nav-canvas">2. Single Canvas Studio</button>
        <button class="nav-btn ${state.currentTab === 'multi' ? 'active' : ''}" id="tab-nav-multi">3. MultiPlot Grid</button>
        <button class="nav-btn ${state.currentTab === 'maps' ? 'active' : ''}" id="tab-nav-maps">4. Maps & Geo Studio</button>
      </nav>
      <div>
        <button class="btn btn-primary" id="btn-export">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Export Figure (SVG)
        </button>
      </div>
    </header>

    <div class="main-container">
      <!-- VIEW 1: DATA INGESTION (Source, Parquet, SQL MySQL, Delimiters, Geo Coordinates & Preview Table) -->
      <div class="view-panel ${state.currentTab === 'data' ? 'active' : ''}" id="view-data">
        <aside class="sidebar">

          <!-- 0. PROGETTO & SESSIONE -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>Progetto & Sessione</span>
              ${state.activeProject ? `
                <span class="cm-badge cm-badge-emerald">Attivo: ${state.activeProject}</span>
              ` : `
                <span class="cm-badge cm-badge-sky">Nuovo</span>
              `}
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">Carica Progetto Esistente</label>
              <select class="form-select" id="sel-load-project" style="font-size: 0.8rem;">
                <option value="">-- Seleziona Progetto Salvato --</option>
                ${Object.keys(state.projectsStore).map(p => `
                  <option value="${p}" ${p === state.activeProject ? 'selected' : ''}>
                    📁 ${p} (${Object.keys(state.projectsStore[p].canvases || {}).length} grafici)
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">Nome Progetto</label>
              <input type="text" class="form-input" id="inp-project-name" value="${state.activeProject}" placeholder="es. Monitoraggio IEQ Settembre" style="font-size: 0.82rem;" />
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary" id="btn-save-project" style="flex: 1; font-size: 0.76rem; padding: 5px 8px;">
                💾 Salva Progetto
              </button>
              ${state.activeProject ? `
                <button class="btn btn-secondary" id="btn-new-project" style="font-size: 0.76rem; padding: 5px 8px;" title="Crea un nuovo progetto vuoto">
                  + Nuovo
                </button>
                <button class="btn btn-secondary" id="btn-delete-project" style="font-size: 0.76rem; padding: 5px 8px; color: var(--rose);" title="Elimina questo progetto">
                  🗑️
                </button>
              ` : ''}
            </div>
          </section>

          <!-- 1. SELETTORE SORGENTE DATI: FILE LOCALE (CSV/Excel/Parquet) vs SQL (MySQL) -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Sorgente Dati & Connettori</span>
              <span class="cm-badge cm-badge-emerald">${state.sourceType === 'sql' ? 'MySQL DB' : 'Direct I/O'}</span>
            </div>

            <div class="source-toggle-group">
              <button class="source-toggle-btn ${state.sourceType === 'file' ? 'active' : ''}" id="btn-src-file">
                📂 File (CSV / Excel / Parquet)
              </button>
              <button class="source-toggle-btn ${state.sourceType === 'sql' ? 'active' : ''}" id="btn-src-sql">
                🗄️ Database SQL (MySQL)
              </button>
            </div>

            ${state.sourceType === 'file' ? `
              <div class="dropzone" id="dropzone-data">
                <div class="dropzone-icon">📂</div>
                <div style="font-weight: 600; font-size: 0.88rem; color: #000000;">Trascina file qui (CSV, XLSX, Parquet)</div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">oppure clicca per sfogliare cartelle locali / SharePoint</div>
              </div>
              ${state.filePath ? `
                <div class="file-path-display">${state.filePath}</div>
                <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 0.75rem;">
                  <span>Total Rows: <strong>${state.dataset?.total_rows || 0}</strong></span>
                  <span class="cm-badge cm-badge-sky">${state.dataset?.detected_sep || 'Unknown'}</span>
                </div>
              ` : ''}
            ` : `
              <!-- PANNELLO CONNETTORE MYSQL -->
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div class="form-row">
                  <div class="form-group" style="flex: 2;">
                    <label class="form-label">Host / Server IP</label>
                    <input type="text" class="form-input" id="sql-host" value="${state.sqlConfig.host}" placeholder="localhost o 192.168.1.x" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Porta</label>
                    <input type="number" class="form-input" id="sql-port" value="${state.sqlConfig.port}" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Database</label>
                    <input type="text" class="form-input" id="sql-db" value="${state.sqlConfig.database}" placeholder="building_db" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Username</label>
                    <input type="text" class="form-input" id="sql-user" value="${state.sqlConfig.user}" placeholder="root" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Password (Sessione)</label>
                  <input type="password" class="form-input" id="sql-pass" value="${state.sqlConfig.password || ''}" placeholder="••••••••" />
                </div>

                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                  <button class="btn btn-secondary" id="btn-sql-test" style="flex: 1; font-size: 0.76rem;">
                    🔌 Test Connessione
                  </button>
                  ${state.sqlStatus ? `
                    <span class="cm-badge ${state.sqlStatus.connected ? 'cm-badge-emerald' : 'cm-badge-rose'}">
                      ${state.sqlStatus.connected ? `✓ ${state.sqlStatus.latency_ms}ms` : '✕ Errore'}
                    </span>
                  ` : ''}
                </div>

                ${state.sqlStatus?.tables && state.sqlStatus.tables.length > 0 ? `
                  <div class="form-group">
                    <label class="form-label">Seleziona Tabella Rilevata</label>
                    <select class="form-select" id="sql-table-select">
                      <option value="">-- Seleziona tabella per auto-query --</option>
                      ${state.sqlStatus.tables.map(t => `<option value="${t}">📋 ${t}</option>`).join('')}
                    </select>
                  </div>
                ` : ''}

                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label">Query SQL (SELECT / Aggregazioni)</label>
                  <textarea class="sql-editor" id="sql-query-input" placeholder="SELECT * FROM sensor_readings LIMIT 50000;">${state.sqlQuery}</textarea>
                </div>

                <button class="btn btn-primary" id="btn-sql-exec" style="width: 100%; font-size: 0.78rem;">
                  🚀 Esegui Query & Carica Dataset
                </button>
              </div>
            `}
          </section>

          <!-- Separators & Formatting (Only relevant for CSV/TSV) -->
          ${state.sourceType === 'file' ? `
            <section class="sidebar-section">
              <div class="sidebar-title">Delimiter & Decimals (CSV/TSV)</div>
              
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Separator</label>
                  <select class="form-select" id="cfg-separator">
                    <option value="auto" ${state.separator === 'auto' ? 'selected' : ''}>Auto-Detect</option>
                    <option value="," ${state.separator === ',' ? 'selected' : ''}>, (Comma)</option>
                    <option value=";" ${state.separator === ';' ? 'selected' : ''}>; (Semicolon)</option>
                    <option value="\t" ${state.separator === '\t' ? 'selected' : ''}>\\t (Tab)</option>
                    <option value="|" ${state.separator === '|' ? 'selected' : ''}>| (Pipe)</option>
                  </select>
                </div>

                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Decimal Format</label>
                  <select class="form-select" id="cfg-decimal">
                    <option value="." ${state.decimal === '.' ? 'selected' : ''}>. (Dot: 12.34)</option>
                    <option value="," ${state.decimal === ',' ? 'selected' : ''}>, (Comma: 12,34)</option>
                  </select>
                </div>
              </div>

              <button class="btn btn-secondary" id="btn-reparse" style="width: 100%; margin-top: 2px;">
                Apply & Re-Parse
              </button>
            </section>
          ` : ''}

          <!-- Timestamp Detection -->
          <section class="sidebar-section">
            <div class="sidebar-title">Timestamp & Time-Series</div>
            
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="cfg-has-ts" ${state.hasTimestamp ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">Dataset has timestamp column</span>
            </label>

            <div id="ts-config-panel" style="display: ${state.hasTimestamp ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label">Timestamp Column</label>
                <select class="form-select" id="cfg-ts-col">
                  <option value="">Select timestamp column...</option>
                  ${renderColumnOptions(state.timestampCol)}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Datetime Parsing Format</label>
                <input type="text" class="form-input" id="cfg-ts-format" value="${state.timestampFormat}" placeholder="%Y-%m-%d %H:%M:%S" />
              </div>
            </div>
          </section>

          <!-- Coordinate Geospaziali (GIS & Maps Setup) -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Coordinate Geospaziali (GIS)</span>
              <span class="cm-badge cm-badge-sky">Maps Ready</span>
            </div>

            <div class="form-group">
              <label class="form-label">Formato Coordinate</label>
              <select class="form-select" id="cfg-geo-format">
                <option value="decimal_degrees" ${state.geoCoordFormat === 'decimal_degrees' ? 'selected' : ''}>Gradi Decimali (DD: 45.4781, 9.2270)</option>
                <option value="dms" ${state.geoCoordFormat === 'dms' ? 'selected' : ''}>Gradi Minuti Secondi (DMS: 45°28'41"N)</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Colonna Latitudine</label>
                <select class="form-select" id="cfg-geo-lat">
                  <option value="">-- Nessuna --</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Colonna Longitudine</label>
                <select class="form-select" id="cfg-geo-lon">
                  <option value="">-- Nessuna --</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>

            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-primary" id="btn-goto-canvas" style="flex: 1; font-size: 0.76rem;">
                Canvas Studio →
              </button>
              <button class="btn btn-secondary" id="btn-goto-maps" style="flex: 1; font-size: 0.76rem;">
                🗺️ Maps Studio →
              </button>
            </div>
          </section>
        </aside>

        <!-- Ingestion Table Preview Body -->
        <main class="data-ingestion-view">
          <div class="data-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 1.1rem; font-weight: 700; color: #000000;">Dataset Schema & Raw Preview</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  Visualizzazione prime 100 righe del file selezionato
                </div>
              </div>
              <div>
                ${state.dataset ? `
                  <span class="cm-badge cm-badge-emerald" style="font-size: 0.8rem; padding: 4px 8px;">
                    ✓ ${state.dataset.columns.length} Colonne · ${state.dataset.total_rows} Righe Totali
                  </span>
                ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Nessun dataset caricato</span>'}
              </div>
            </div>

            <div class="table-preview-scroll">
              ${renderPreviewTable()}
            </div>
          </div>
        </main>
      </div>

      <!-- VIEW 2: SINGLE CANVAS STUDIO (Trace Styler, Multi-Axis Y1-Y4, Advanced Annotations) -->
      <div class="view-panel ${state.currentTab === 'canvas' ? 'active' : ''}" id="view-canvas">
        <aside class="sidebar">

          <!-- 0. CANVAS / GRAFICI SALVATI -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>Grafici del Progetto (Canvas)</span>
              <span class="cm-badge cm-badge-emerald">${state.activeCanvas || 'Canvas_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              <select class="form-select" id="sel-canvas" style="flex: 1; font-size: 0.8rem; font-weight: 600; padding: 4px 8px;">
                ${renderCanvasSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-canvas" style="font-size: 0.76rem; padding: 4px 10px; white-space: nowrap;" title="Salva modifiche a questo canvas">
                💾 Salva
              </button>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-canvas" style="flex: 1; font-size: 0.74rem; padding: 4px 6px;">
                + Salva come Nuovo
              </button>
              <button class="btn btn-secondary" id="btn-delete-canvas" style="font-size: 0.74rem; padding: 4px 6px; color: var(--rose);" title="Elimina questo canvas">
                ✕ Elimina
              </button>
            </div>
          </section>
          
          <!-- 1. TIMEFRAME SELECTOR -->
          ${state.hasTimestamp ? `
            <section class="sidebar-section">
              <div class="sidebar-title">
                <span>Timeframe & Finestra Temporale</span>
                <span class="cm-badge cm-badge-sky">Filter</span>
              </div>
              
              <div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">
                <button class="timeframe-pill ${state.timeframeMode === 'all' ? 'active' : ''}" data-tf="all">Full</button>
                <button class="timeframe-pill ${state.timeframeMode === 'day' ? 'active' : ''}" data-tf="day">1 Day</button>
                <button class="timeframe-pill ${state.timeframeMode === 'week' ? 'active' : ''}" data-tf="week">1 Week</button>
                <button class="timeframe-pill ${state.timeframeMode === 'month' ? 'active' : ''}" data-tf="month">1 Month</button>
                <button class="timeframe-pill ${state.timeframeMode === 'custom' ? 'active' : ''}" data-tf="custom">Custom</button>
              </div>

              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Inizio</label>
                  <input type="date" class="form-input" id="canvas-start-date" value="${state.startDate}" />
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Fine</label>
                  <input type="date" class="form-input" id="canvas-end-date" value="${state.endDate}" />
                </div>
              </div>
            </section>
          ` : ''}

          <!-- 2. ASSE X -->
          <section class="sidebar-section">
            <div class="sidebar-title">Asse Orizzontale (X)</div>
            <div class="form-group" style="margin-bottom: 0;">
              <select class="form-select" id="select-x">
                <option value="">Seleziona variabile X...</option>
                ${renderColumnOptions(state.selectedX)}
              </select>
            </div>
          </section>

          <!-- 3. TRACE STYLER (PER-TRACCIA: Tipo, Asse Y1-Y4, Colore, Spessore) -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Tracce & Stile Per-Serie</span>
              <span class="cm-badge cm-badge-emerald">${state.traces.length} Attive</span>
            </div>
            
            <!-- Selettore dedicato per scegliere quale colonna Y aggiungere -->
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
              <select class="form-select" id="sel-new-trace-col" style="flex: 1; font-size: 0.8rem; padding: 4px 8px;">
                ${renderAddColumnOptions()}
              </select>
              <button class="btn btn-primary" id="btn-add-trace" style="font-size: 0.78rem; padding: 4px 10px; white-space: nowrap;">
                + Aggiungi Serie
              </button>
            </div>
            
            <div id="traces-list-container">
              ${renderTraceCards()}
            </div>
          </section>

          <!-- 4. ETICHETTE E TITOLI ASSI (Y1, Y2, Y3, Y4) -->
          <section class="sidebar-section">
            <div class="sidebar-title">Etichette Assi Scientifici</div>
            <div class="form-group">
              <label class="form-label">Titolo Y1 (Sinistra)</label>
              <input type="text" class="form-input" id="axis-y1-title" value="${state.y1Title}" placeholder="es. Temperatura [°C]" />
            </div>
            ${state.traces.some(t => t.axis === 'y2') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y2 (Destra 1)</label>
                <input type="text" class="form-input" id="axis-y2-title" value="${state.y2Title}" placeholder="es. Umidità Relativa [%]" />
              </div>
            ` : ''}
            ${state.traces.some(t => t.axis === 'y3') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y3 (Destra 2)</label>
                <input type="text" class="form-input" id="axis-y3-title" value="${state.y3Title}" placeholder="es. CO₂ [ppm]" />
              </div>
            ` : ''}
            ${state.traces.some(t => t.axis === 'y4') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y4 (Destra 3)</label>
                <input type="text" class="form-input" id="axis-y4-title" value="${state.y4Title}" placeholder="es. Potenza Elettrica [kW]" />
              </div>
            ` : ''}
          </section>

          <!-- 5. SMART SCIENTIFIC ANNOTATIONS -->
          <section class="sidebar-section">
            <div class="sidebar-title">Smart Scientific Annotations</div>
            
            <!-- Peak Tracker Configurabile -->
            <div class="form-group">
              <label class="form-label">Peak & Valley Tracker</label>
              <select class="form-select" id="cfg-peak-mode">
                <option value="none" ${state.peakMode === 'none' ? 'selected' : ''}>Disattivato</option>
                <option value="global" ${state.peakMode === 'global' ? 'selected' : ''}>🔴 Max & 🔵 Min Globale (Intervallo Attivo)</option>
                <option value="daily" ${state.peakMode === 'daily' ? 'selected' : ''}>📅 Estremi Giornalieri (Picco Diurno / Min Notturna)</option>
                <option value="weekly" ${state.peakMode === 'weekly' ? 'selected' : ''}>📊 Estremi Settimanali (Max & Min per Settimana)</option>
              </select>
            </div>

            <!-- Comfort / Target Band Personalizzabile -->
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 6px;">
                <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
                <span style="font-weight: 600; color: #000000;">Fascia di Target / Comfort IEQ</span>
              </label>

              <div id="comfort-panel" style="display: ${state.comfortBand ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div class="form-group">
                  <label class="form-label">Stagione / Preset Range</label>
                  <select class="form-select" id="cfg-comfort-season">
                    <option value="winter" ${state.comfortSeason === 'winter' ? 'selected' : ''}>Inverno (20.0 - 22.0 °C)</option>
                    <option value="summer" ${state.comfortSeason === 'summer' ? 'selected' : ''}>Estate (24.0 - 26.0 °C)</option>
                    <option value="custom" ${state.comfortSeason === 'custom' ? 'selected' : ''}>Personalizzato (Custom)</option>
                  </select>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Minimo [Y]</label>
                    <input type="number" step="0.5" class="form-input" id="comfort-min" value="${state.comfortMin}" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Massimo [Y]</label>
                    <input type="number" step="0.5" class="form-input" id="comfort-max" value="${state.comfortMax}" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 6. TIPOGRAFIA SCIENTIFICA (PAPER READY) -->
          <section class="sidebar-section">
            <div class="sidebar-title">Tipografia Journal-Ready</div>
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Font Family</label>
                <select class="form-select" id="cfg-font-family">
                  <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Clean)</option>
                  <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
                  <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
                  <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono (Technical)</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Dimensione</label>
                <input type="number" min="8" max="18" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
              </div>
            </div>
          </section>
        </aside>

        <!-- Canvas Display Area -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">Preset Pubblicazione:</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">Singola Colonna (8.5cm)</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">Doppia Colonna (17cm)</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">Quadrato (12×12cm)</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>Dimensioni: <strong id="dim-badge" style="color: #000000;">${state.widthCm} × ${state.heightCm} cm</strong></span>
              <span class="cm-badge cm-badge-emerald">Vector 600 DPI Ready</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 3: MULTIPLOT GRID STUDIO -->
      <div class="view-panel ${state.currentTab === 'multi' ? 'active' : ''}" id="view-multi">
        <aside class="sidebar">

          <!-- 0. MULTIPLOT SALVATI -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>MultiPlot del Progetto</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMultiPlot || 'MultiPlot_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              <select class="form-select" id="sel-multiplot" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMultiPlotSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-multiplot" style="font-size: 0.76rem; padding: 4px 10px;">
                💾 Salva
              </button>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-multiplot" style="flex: 1; font-size: 0.74rem; padding: 4px 6px;">
                + Salva come Nuovo
              </button>
              <button class="btn btn-secondary" id="btn-delete-multiplot" style="font-size: 0.74rem; padding: 4px 6px; color: var(--rose);">
                ✕ Elimina
              </button>
            </div>
          </section>

          <!-- 1. TOPOLOGIA MATRICE SUBPLOT (1-CLICK) -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Topologia Griglia Scientifica</span>
              <span class="cm-badge cm-badge-sky">Subplots</span>
            </div>

            <div class="topo-grid">
              <button class="topo-btn ${state.mpTopology === '3x1' ? 'active' : ''}" data-topo="3x1">
                <span>☰ Stack 3×1</span>
                <span style="font-size: 0.68rem; opacity: 0.8;">(a)-(c)</span>
              </button>
              <button class="topo-btn ${state.mpTopology === '2x1' ? 'active' : ''}" data-topo="2x1">
                <span>≣ Stack 2×1</span>
                <span style="font-size: 0.68rem; opacity: 0.8;">(a)-(b)</span>
              </button>
              <button class="topo-btn ${state.mpTopology === '2x2' ? 'active' : ''}" data-topo="2x2">
                <span>▦ Matrice 2×2</span>
                <span style="font-size: 0.68rem; opacity: 0.8;">4 Quadranti</span>
              </button>
              <button class="topo-btn ${state.mpTopology === '1x2' ? 'active' : ''}" data-topo="1x2">
                <span>◫ Side 1×2</span>
                <span style="font-size: 0.68rem; opacity: 0.8;">Affiancati</span>
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                <input type="checkbox" id="mp-share-x" ${state.mpShareX ? 'checked' : ''} />
                <span style="font-weight: 600; color: #000000;">Sincronizza Asse X Condiviso (Nascondi label intermedi)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                <input type="checkbox" id="mp-lettering" ${state.mpAutoLettering ? 'checked' : ''} />
                <span style="font-weight: 600; color: #000000;">Lettering Accademico Automatico (a), (b), (c)...</span>
              </label>
            </div>
          </section>

          <!-- 2. CONFIGURAZIONE SINGOLI PANNELLI -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Configurazione Pannelli</span>
              <span class="cm-badge cm-badge-emerald">${getActivePanelCount()} Pannelli</span>
            </div>
            <div id="mp-panels-container">
              ${renderMultiPlotPanelCards()}
            </div>
          </section>
        </aside>

        <!-- MultiPlot Viewport -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">Preset MultiPlot:</span>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'single_stack' ? 'active' : ''}" data-mppreset="single_stack">Colonna Singola (8.5×11.5cm)</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'double_stack' ? 'active' : ''}" data-mppreset="double_stack">Doppia Colonna Stack (17×13.5cm)</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'square_grid' ? 'active' : ''}" data-mppreset="square_grid">Quadrato 2×2 (14×14cm)</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>Dimensioni: <strong style="color: #000000;">${state.mpWidthCm} × ${state.mpHeightCm} cm</strong></span>
              <span class="cm-badge cm-badge-emerald">Multi-Panel Sync</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-multi-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 4: MAPS & GEO-ANALYTICS STUDIO -->
      <div class="view-panel ${state.currentTab === 'maps' ? 'active' : ''}" id="view-maps">
        <aside class="sidebar">

          <!-- 0. MAPPE SALVATE -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>Mappe GIS del Progetto</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMap || 'Mappa_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              <select class="form-select" id="sel-map" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMapSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-map" style="font-size: 0.76rem; padding: 4px 10px;">
                💾 Salva
              </button>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-map" style="flex: 1; font-size: 0.74rem; padding: 4px 6px;">
                + Salva come Nuova
              </button>
              <button class="btn btn-secondary" id="btn-delete-map" style="font-size: 0.74rem; padding: 4px 6px; color: var(--rose);">
                ✕ Elimina
              </button>
            </div>
          </section>

          <!-- 1. TIPO DI MAPPA & BASE MAP PROVIDER -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Modalità Cartografica & Sfondo</span>
              <span class="cm-badge cm-badge-sky">GIS Engine</span>
            </div>

            <div class="map-mode-group">
              <button class="map-mode-btn ${state.mapMode === 'bubble' ? 'active' : ''}" data-mapmode="bubble">
                📍 Bubble Map
              </button>
              <button class="map-mode-btn ${state.mapMode === 'density' ? 'active' : ''}" data-mapmode="density">
                🔥 Heatmap
              </button>
              <button class="map-mode-btn ${state.mapMode === 'track' ? 'active' : ''}" data-mapmode="track">
                〰️ GPS Track
              </button>
            </div>

            <div class="form-group">
              <label class="form-label">Base Map Provider (Tile Layer)</label>
              <select class="form-select" id="map-basemap">
                <option value="carto-positron" ${state.mapBasemap === 'carto-positron' ? 'selected' : ''}>🏙️ CartoDB Positron (Light Paper Standard)</option>
                <option value="esri-satellite" ${state.mapBasemap === 'esri-satellite' ? 'selected' : ''}>🛰️ ESRI World Imagery Satellite</option>
                <option value="open-street-map" ${state.mapBasemap === 'open-street-map' ? 'selected' : ''}>🗺️ OpenStreetMap (Road & Urban)</option>
                <option value="carto-darkmatter" ${state.mapBasemap === 'carto-darkmatter' ? 'selected' : ''}>🌑 CartoDB Dark Matter (High Contrast)</option>
                <option value="opentopomap" ${state.mapBasemap === 'opentopomap' ? 'selected' : ''}>🏔️ OpenTopoMap (Topographic Elevation)</option>
              </select>
            </div>
          </section>

          <!-- 2. COORDINATE E METRICHE SCALARI -->
          <section class="sidebar-section">
            <div class="sidebar-title">Coordinate & Variabili Spaziali</div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Latitudine (Y)</label>
                <select class="form-select" id="map-lat-col">
                  <option value="">Seleziona Lat...</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Longitudine (X)</label>
                <select class="form-select" id="map-lon-col">
                  <option value="">Seleziona Lon...</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Variabile Colore (Z)</label>
                <select class="form-select" id="map-color-col">
                  <option value="">-- Uniforme --</option>
                  ${renderColumnOptions(state.mapColorCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Variabile Raggio (Size)</label>
                <select class="form-select" id="map-size-col">
                  <option value="">-- Fisso --</option>
                  ${renderColumnOptions(state.mapSizeCol)}
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Scala Cromatica Scientifica</label>
              <select class="form-select" id="map-colorscale">
                <option value="Viridis" ${state.mapColorscale === 'Viridis' ? 'selected' : ''}>Viridis (Perceptually Uniform)</option>
                <option value="Plasma" ${state.mapColorscale === 'Plasma' ? 'selected' : ''}>Plasma (Thermal High-Contrast)</option>
                <option value="RdBu" ${state.mapColorscale === 'RdBu' ? 'selected' : ''}>RdBu (Diverging Blue-Red)</option>
                <option value="YlOrRd" ${state.mapColorscale === 'YlOrRd' ? 'selected' : ''}>YlOrRd (Heat & Intensity)</option>
                <option value="Emerald" ${state.mapColorscale === 'Emerald' ? 'selected' : ''}>Emerald (ChartMate Green)</option>
              </select>
            </div>
          </section>

          <!-- 3. CLUSTERIZZAZIONE SPAZIALE & OPERAZIONI MATEMATICHE -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Clusterizzazione & Math Engine</span>
              <span class="cm-badge cm-badge-amber">Geo-Stats</span>
            </div>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="map-cluster-toggle" ${state.mapClusterEnabled ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">Abilita Clusterizzazione Spaziale (Grid Binning)</span>
            </label>

            <div id="map-cluster-panel" style="display: ${state.mapClusterEnabled ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
              <div class="form-group">
                <label class="form-label">Operazione Matematica sul Cluster</label>
                <select class="form-select" id="map-cluster-agg">
                  <option value="mean" ${state.mapClusterAgg === 'mean' ? 'selected' : ''}>μ — Media Aritmetica dei valori nel Cluster</option>
                  <option value="sum" ${state.mapClusterAgg === 'sum' ? 'selected' : ''}>Σ — Somma Cumulata (es. Carico/Energia Totale)</option>
                  <option value="mode" ${state.mapClusterAgg === 'mode' ? 'selected' : ''}>Mo — Moda (Valore Dominante più frequente)</option>
                  <option value="max" ${state.mapClusterAgg === 'max' ? 'selected' : ''}>Max — Valore di Picco Massimo</option>
                  <option value="min" ${state.mapClusterAgg === 'min' ? 'selected' : ''}>Min — Valore Minimo</option>
                  <option value="count" ${state.mapClusterAgg === 'count' ? 'selected' : ''}>N — Conteggio Densità Campionaria</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 4px;">
                <label class="form-label">Raggio Cella Spaziale (Gradi Decimali)</label>
                <select class="form-select" id="map-cluster-grid">
                  <option value="0.0005" ${state.mapClusterGridDeg === 0.0005 ? 'selected' : ''}>0.0005° (~50m - Micro-Edificio)</option>
                  <option value="0.002" ${state.mapClusterGridDeg === 0.002 ? 'selected' : ''}>0.002° (~200m - Isolato / Campus)</option>
                  <option value="0.005" ${state.mapClusterGridDeg === 0.005 ? 'selected' : ''}>0.005° (~500m - Quartiere)</option>
                  <option value="0.02" ${state.mapClusterGridDeg === 0.02 ? 'selected' : ''}>0.02° (~2km - Distretto Urbano)</option>
                  <option value="0.1" ${state.mapClusterGridDeg === 0.1 ? 'selected' : ''}>0.10° (~10km - Scala Provinciale)</option>
                </select>
              </div>

              <div class="cluster-stats-banner" id="map-cluster-banner">
                <span>Cluster Attivi: <strong id="lbl-cluster-count">${state.mapLastClusterCount || '-'}</strong></span>
                <span class="cm-badge cm-badge-emerald" id="lbl-cluster-stat">${state.mapLastSummaryStat || 'Ready'}</span>
              </div>
            </div>
          </section>
        </aside>

        <!-- Maps Viewport -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">Formato Mappa:</span>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'single' ? 'active' : ''}" data-mappreset="single">Singola Colonna (8.5×7.5cm)</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'double' ? 'active' : ''}" data-mappreset="double">Doppia Colonna (17×10.5cm)</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'square' ? 'active' : ''}" data-mappreset="square">Quadrato GIS (12×12cm)</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>Dimensioni: <strong style="color: #000000;">${state.mapWidthCm} × ${state.mapHeightCm} cm</strong></span>
              <span class="cm-badge cm-badge-sky">▲ Nord · Auto-BBox</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-map-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachEventListeners();
  if (state.currentTab === 'canvas') {
    updateChart();
  } else if (state.currentTab === 'multi') {
    updateMultiPlotChart();
  } else if (state.currentTab === 'maps') {
    updateMapChart();
  }
}

function getActivePanelCount(): number {
  if (state.mpTopology === '3x1') return 3;
  if (state.mpTopology === '2x1' || state.mpTopology === '1x2') return 2;
  return 4;
}

function renderColumnOptions(selected: string): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function renderAddColumnOptions(): string {
  if (!state.dataset?.columns || state.dataset.columns.length === 0) {
    return '<option value="">Nessun dataset caricato</option>';
  }
  const cols = state.dataset.columns.filter(c => c !== state.selectedX);
  const displayCols = cols.length > 0 ? cols : state.dataset.columns;
  return displayCols.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderCanvasSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const canvases = project?.canvases || {};
  const keys = Object.keys(canvases);
  if (keys.length === 0) {
    const current = state.activeCanvas || 'Canvas_1';
    return `<option value="${current}" selected>📊 ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeCanvas ? 'selected' : ''}>📊 ${k}</option>`).join('');
}

function renderMultiPlotSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const mps = project?.multiplots || {};
  const keys = Object.keys(mps);
  if (keys.length === 0) {
    const current = state.activeMultiPlot || 'MultiPlot_1';
    return `<option value="${current}" selected>▦ ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeMultiPlot ? 'selected' : ''}>▦ ${k}</option>`).join('');
}

function renderMapSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const maps = project?.maps || {};
  const keys = Object.keys(maps);
  if (keys.length === 0) {
    const current = state.activeMap || 'Mappa_1';
    return `<option value="${current}" selected>🗺️ ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeMap ? 'selected' : ''}>🗺️ ${k}</option>`).join('');
}

function renderMultiPlotPanelCards(): string {
  const count = getActivePanelCount();
  const letters = ['(a)', '(b)', '(c)', '(d)'];
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const savedCanvases = Object.keys(project?.canvases || {});

  let html = '';
  for (let i = 0; i < count; i++) {
    const p = state.mpPanels[i] || {
      y1Col: '',
      y1Type: 'line',
      y1Color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      y2Col: '',
      y2Color: '#0284c7',
      yTitle: `Panel ${letters[i]}`
    };

    html += `
      <div class="mp-panel-card" data-pidx="${i}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="mp-panel-badge">${letters[i]}</span>
            <input type="text" class="form-input inp-mp-title" data-pidx="${i}" value="${p.yTitle}" placeholder="Titolo asse Y..." style="width: 155px; padding: 3px 6px; font-size: 0.78rem; font-weight: 600;" />
          </div>
          ${savedCanvases.length > 0 ? `
            <select class="trace-select sel-mp-from-canvas" data-pidx="${i}" title="Importa serie da un Canvas salvato" style="max-width: 125px;">
              <option value="">📥 Da Canvas...</option>
              ${savedCanvases.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          ` : ''}
        </div>

        <!-- Serie Primaria Y1 -->
        <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.72rem; font-weight: 700; color: #000000; width: 22px;">Y1:</span>
          <select class="trace-select sel-mp-y1" data-pidx="${i}" style="flex: 1;">
            <option value="">-- Seleziona Y1 --</option>
            ${renderColumnOptions(p.y1Col)}
          </select>
          <select class="trace-select sel-mp-type" data-pidx="${i}">
            <option value="line" ${p.y1Type === 'line' ? 'selected' : ''}>📈 Linea</option>
            <option value="bar" ${p.y1Type === 'bar' ? 'selected' : ''}>📊 Barre</option>
            <option value="area" ${p.y1Type === 'area' ? 'selected' : ''}>▲ Area</option>
            <option value="scatter" ${p.y1Type === 'scatter' ? 'selected' : ''}>⚪ Punti</option>
          </select>
          <input type="color" class="trace-color-input inp-mp-c1" data-pidx="${i}" value="${p.y1Color}" />
        </div>

        <!-- Serie Secondaria Opzionale Y2 (Dual Axis nel pannello) -->
        <div style="display: flex; gap: 5px; align-items: center;">
          <span style="font-size: 0.72rem; font-weight: 700; color: var(--sky); width: 22px;">Y2:</span>
          <select class="trace-select sel-mp-y2" data-pidx="${i}" style="flex: 1;">
            <option value="">-- Nessuna (Opzionale) --</option>
            ${renderColumnOptions(p.y2Col)}
          </select>
          <input type="color" class="trace-color-input inp-mp-c2" data-pidx="${i}" value="${p.y2Color}" />
        </div>
      </div>
    `;
  }
  return html;
}

function renderTraceCards(): string {
  if (state.traces.length === 0) {
    return `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 14px; border: 1px dashed var(--border); border-radius: 6px;">
      Nessuna serie attiva.<br>Seleziona una colonna sopra e clicca <strong>+ Aggiungi Serie</strong>.
    </div>`;
  }

  return state.traces.map((trace, idx) => `
    <div class="trace-card" data-idx="${idx}">
      <div class="trace-header">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 8px;">
          <span style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted);">Y:</span>
          <select class="trace-select sel-trace-column" data-idx="${idx}" style="font-weight: 600; flex: 1; font-size: 0.82rem; padding: 3px 6px;" title="Cambia variabile di questa serie">
            ${renderColumnOptions(trace.column)}
          </select>
        </div>
        <button class="btn btn-secondary btn-del-trace" data-idx="${idx}" style="padding: 2px 7px; font-size: 0.7rem; color: var(--rose);" title="Rimuovi serie">
          ✕
        </button>
      </div>
      
      <div class="trace-controls">
        <!-- Asse Target -->
        <select class="trace-select sel-trace-axis" data-idx="${idx}" title="Asse Y">
          <option value="y1" ${trace.axis === 'y1' ? 'selected' : ''}>Y1 (Sinistra)</option>
          <option value="y2" ${trace.axis === 'y2' ? 'selected' : ''}>Y2 (Destra 1)</option>
          <option value="y3" ${trace.axis === 'y3' ? 'selected' : ''}>Y3 (Destra 2)</option>
          <option value="y4" ${trace.axis === 'y4' ? 'selected' : ''}>Y4 (Destra 3)</option>
        </select>

        <!-- Tipologia di grafico per serie -->
        <select class="trace-select sel-trace-type" data-idx="${idx}" title="Tipo di Traccia">
          <option value="line" ${trace.chartType === 'line' ? 'selected' : ''}>📈 Linea</option>
          <option value="scatter" ${trace.chartType === 'scatter' ? 'selected' : ''}>⚪ Scatter</option>
          <option value="bar" ${trace.chartType === 'bar' ? 'selected' : ''}>📊 Barre</option>
          <option value="area" ${trace.chartType === 'area' ? 'selected' : ''}>▲ Area</option>
        </select>

        <!-- Stile Tratteggio -->
        <select class="trace-select sel-trace-dash" data-idx="${idx}" title="Tratteggio Linea">
          <option value="solid" ${trace.lineDash === 'solid' ? 'selected' : ''}>— Continua</option>
          <option value="dash" ${trace.lineDash === 'dash' ? 'selected' : ''}>-- Tratteggiata</option>
          <option value="dot" ${trace.lineDash === 'dot' ? 'selected' : ''}>·· Puntata</option>
        </select>

        <!-- Colore Personalizzato -->
        <input type="color" class="trace-color-input inp-trace-color" data-idx="${idx}" value="${trace.color}" title="Colore Serie" />
      </div>
    </div>
  `).join('');
}

function renderPreviewTable(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 600;">Nessun dataset caricato</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">Trascina un file CSV o Excel nella barra laterale sinistra per avviare l'analisi.</div>
      </div>
    `;
  }

  const thead = `<tr>${state.dataset.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const tbody = state.dataset.rows.slice(0, 50).map(row => {
    return `<tr>${row.map(val => `<td>${val}</td>`).join('')}</tr>`;
  }).join('');

  return `<table class="cm-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function attachEventListeners() {
  // Navigation Tabs
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

  document.getElementById('btn-goto-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
  });

  document.getElementById('btn-goto-maps')?.addEventListener('click', () => {
    state.currentTab = 'maps';
    renderApp();
  });

  // Source Toggle (File vs SQL)
  document.getElementById('btn-src-file')?.addEventListener('click', () => {
    state.sourceType = 'file';
    renderApp();
  });

  document.getElementById('btn-src-sql')?.addEventListener('click', () => {
    state.sourceType = 'sql';
    renderApp();
  });

  // SQL Connection Manager Events
  document.getElementById('sql-host')?.addEventListener('input', (e) => {
    state.sqlConfig.host = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-port')?.addEventListener('input', (e) => {
    state.sqlConfig.port = parseInt((e.target as HTMLInputElement).value, 10) || 3306;
  });
  document.getElementById('sql-db')?.addEventListener('input', (e) => {
    state.sqlConfig.database = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-user')?.addEventListener('input', (e) => {
    state.sqlConfig.user = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-pass')?.addEventListener('input', (e) => {
    state.sqlConfig.password = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-query-input')?.addEventListener('input', (e) => {
    state.sqlQuery = (e.target as HTMLTextAreaElement).value;
  });

  document.getElementById('btn-sql-test')?.addEventListener('click', async () => {
    try {
      const status = await invoke<SqlConnectionStatus>('test_sql_connection', {
        config: state.sqlConfig
      });
      state.sqlStatus = status;
      renderApp();
    } catch (err) {
      state.sqlStatus = {
        connected: false,
        latency_ms: 0,
        tables: [],
        message: `${err}`
      };
      renderApp();
    }
  });

  document.getElementById('sql-table-select')?.addEventListener('change', (e) => {
    const tbl = (e.target as HTMLSelectElement).value;
    if (tbl) {
      state.sqlQuery = `SELECT * FROM \`${tbl}\` LIMIT 10000;`;
      const qEl = document.getElementById('sql-query-input') as HTMLTextAreaElement | null;
      if (qEl) qEl.value = state.sqlQuery;
    }
  });

  document.getElementById('btn-sql-exec')?.addEventListener('click', async () => {
    try {
      const preview = await invoke<DatasetPreview>('execute_sql_query', {
        config: state.sqlConfig,
        query: state.sqlQuery
      });
      state.dataset = preview;
      state.filePath = `mysql://${state.sqlConfig.host}:${state.sqlConfig.port}/${state.sqlConfig.database}`;
      applyDatasetMetadata(preview, true);
      renderApp();
    } catch (err) {
      alert(`Errore esecuzione query SQL: ${err}`);
    }
  });

  // Geospatial Configurator in Tab 1
  document.getElementById('cfg-geo-format')?.addEventListener('change', (e) => {
    state.geoCoordFormat = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('cfg-geo-lat')?.addEventListener('change', (e) => {
    state.geoLatCol = (e.target as HTMLSelectElement).value;
  });
  document.getElementById('cfg-geo-lon')?.addEventListener('change', (e) => {
    state.geoLonCol = (e.target as HTMLSelectElement).value;
  });

  // Dropzone File Loading
  const dropzone = document.getElementById('dropzone-data');
  dropzone?.addEventListener('click', handleFileSelect);

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = (file as any).path || file.name;
      await loadFile(filePath);
    }
  });

  // Delimiter & Decimal Config
  document.getElementById('cfg-separator')?.addEventListener('change', (e) => {
    state.separator = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('cfg-decimal')?.addEventListener('change', (e) => {
    state.decimal = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('btn-reparse')?.addEventListener('click', async () => {
    if (state.filePath && state.sourceType === 'file') {
      await loadFile(state.filePath);
    }
  });

  // Timestamp Checkbox
  document.getElementById('cfg-has-ts')?.addEventListener('change', (e) => {
    state.hasTimestamp = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('ts-config-panel');
    if (panel) panel.style.display = state.hasTimestamp ? 'block' : 'none';
  });

  document.getElementById('cfg-ts-col')?.addEventListener('change', (e) => {
    state.timestampCol = (e.target as HTMLSelectElement).value;
    state.selectedX = state.timestampCol;
  });

  document.getElementById('cfg-ts-format')?.addEventListener('input', (e) => {
    state.timestampFormat = (e.target as HTMLInputElement).value;
  });

  // Canvas: Timeframe
  document.querySelectorAll('.timeframe-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).getAttribute('data-tf') as any;
      if (mode) {
        state.timeframeMode = mode;
        calculateTimeframeDates(mode);
        renderApp();
      }
    });
  });

  document.getElementById('canvas-start-date')?.addEventListener('change', (e) => {
    state.startDate = (e.target as HTMLInputElement).value;
    state.timeframeMode = 'custom';
    updateChart();
  });

  document.getElementById('canvas-end-date')?.addEventListener('change', (e) => {
    state.endDate = (e.target as HTMLInputElement).value;
    state.timeframeMode = 'custom';
    updateChart();
  });

  // Canvas: Select X
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Trace Styler: Add Trace Button with Column Selector
  document.getElementById('btn-add-trace')?.addEventListener('click', () => {
    if (!state.dataset || state.dataset.columns.length === 0) return;
    
    const selEl = document.getElementById('sel-new-trace-col') as HTMLSelectElement | null;
    let chosenCol = selEl?.value;

    if (!chosenCol) {
      const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(t => t.column === c));
      chosenCol = available.length > 0 ? available[0] : state.dataset.columns[1] || state.dataset.columns[0];
    }
    
    const nextColor = DEFAULT_PALETTE[state.traces.length % DEFAULT_PALETTE.length];
    const nextAxis: 'y1' | 'y2' | 'y3' | 'y4' = state.traces.length === 0 ? 'y1' : (state.traces.length === 1 ? 'y2' : (state.traces.length === 2 ? 'y3' : (state.traces.length === 3 ? 'y4' : 'y1')));
    
    state.traces.push({
      column: chosenCol,
      axis: nextAxis,
      chartType: 'line',
      color: nextColor,
      lineWidth: 2.0,
      lineDash: 'solid'
    });

    if (nextAxis === 'y1' && !state.y1Title) state.y1Title = chosenCol;
    if (nextAxis === 'y2' && !state.y2Title) state.y2Title = chosenCol;
    if (nextAxis === 'y3' && !state.y3Title) state.y3Title = chosenCol;
    if (nextAxis === 'y4' && !state.y4Title) state.y4Title = chosenCol;

    renderApp();
  });

  // Trace Styler: Per-trace Column Change Dropdown
  document.querySelectorAll('.sel-trace-column').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      const newCol = (e.target as HTMLSelectElement).value;
      if (state.traces[idx]) {
        state.traces[idx].column = newCol;
        renderApp();
      }
    });
  });

  // Trace Styler: Delete Trace
  document.querySelectorAll('.btn-del-trace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces.splice(idx, 1);
      renderApp();
    });
  });

  // Trace Styler: Per-trace Axis Change
  document.querySelectorAll('.sel-trace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].axis = (e.target as HTMLSelectElement).value as any;
      renderApp();
    });
  });

  // Trace Styler: Per-trace Type Change (Line, Scatter, Bar, Area)
  document.querySelectorAll('.sel-trace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].chartType = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  // Trace Styler: Line Dash
  document.querySelectorAll('.sel-trace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].lineDash = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  // Trace Styler: Color
  document.querySelectorAll('.inp-trace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].color = (e.target as HTMLInputElement).value;
      updateChart();
    });
  });

  // Axis Titles Inputs
  document.getElementById('axis-y1-title')?.addEventListener('input', (e) => {
    state.y1Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y2-title')?.addEventListener('input', (e) => {
    state.y2Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y3-title')?.addEventListener('input', (e) => {
    state.y3Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y4-title')?.addEventListener('input', (e) => {
    state.y4Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  // Typography Config
  document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
    state.fontFamily = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  document.getElementById('cfg-font-size')?.addEventListener('input', (e) => {
    state.fontSize = parseInt((e.target as HTMLInputElement).value, 10) || 11;
    updateChart();
  });

  // Presets (Single Canvas)
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-preset') as any;
      if (p && PRESETS[p as keyof typeof PRESETS]) {
        state.preset = p;
        state.widthCm = PRESETS[p as keyof typeof PRESETS].w;
        state.heightCm = PRESETS[p as keyof typeof PRESETS].h;
        renderApp();
      }
    });
  });

  // Peak Mode Selector (None, Global, Daily, Weekly)
  document.getElementById('cfg-peak-mode')?.addEventListener('change', (e) => {
    state.peakMode = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });

  // Comfort Band Toggle & Season Presets
  document.getElementById('check-comfort')?.addEventListener('change', (e) => {
    state.comfortBand = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('comfort-panel');
    if (panel) panel.style.display = state.comfortBand ? 'block' : 'none';
    updateChart();
  });

  document.getElementById('cfg-comfort-season')?.addEventListener('change', (e) => {
    const season = (e.target as HTMLSelectElement).value;
    state.comfortSeason = season as any;
    if (season === 'winter') {
      state.comfortMin = 20.0;
      state.comfortMax = 22.0;
    } else if (season === 'summer') {
      state.comfortMin = 24.0;
      state.comfortMax = 26.0;
    }
    renderApp();
  });

  document.getElementById('comfort-min')?.addEventListener('input', (e) => {
    state.comfortMin = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.comfortSeason = 'custom';
    updateChart();
  });

  document.getElementById('comfort-max')?.addEventListener('input', (e) => {
    state.comfortMax = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.comfortSeason = 'custom';
    updateChart();
  });

  // MultiPlot Studio Listeners
  document.querySelectorAll('.topo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topo = (e.currentTarget as HTMLElement).getAttribute('data-topo') as any;
      if (topo) {
        state.mpTopology = topo;
        renderApp();
      }
    });
  });

  document.getElementById('mp-share-x')?.addEventListener('change', (e) => {
    state.mpShareX = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });

  document.getElementById('mp-lettering')?.addEventListener('change', (e) => {
    state.mpAutoLettering = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });

  document.querySelectorAll('.inp-mp-title').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].yTitle = (e.target as HTMLInputElement).value;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mp-from-canvas').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      const canvasName = (e.target as HTMLSelectElement).value;
      const proj = state.activeProject ? state.projectsStore[state.activeProject] : null;
      const cfg = proj?.canvases?.[canvasName];
      if (cfg && state.mpPanels[idx]) {
        const y1T = cfg.traces.find(t => t.axis === 'y1') || cfg.traces[0];
        const y2T = cfg.traces.find(t => t.axis === 'y2');
        if (y1T) {
          state.mpPanels[idx].y1Col = y1T.column;
          state.mpPanels[idx].y1Type = y1T.chartType;
          state.mpPanels[idx].y1Color = y1T.color;
        }
        if (y2T) {
          state.mpPanels[idx].y2Col = y2T.column;
          state.mpPanels[idx].y2Color = y2T.color;
        }
        state.mpPanels[idx].yTitle = cfg.y1_title || y1T?.column || `Panel ${idx + 1}`;
        renderApp();
      }
    });
  });

  document.querySelectorAll('.sel-mp-y1').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      const val = (e.target as HTMLSelectElement).value;
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].y1Col = val;
        if (!state.mpPanels[idx].yTitle || state.mpPanels[idx].yTitle.startsWith('Panel')) {
          state.mpPanels[idx].yTitle = val;
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.sel-mp-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].y1Type = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.inp-mp-c1').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].y1Color = (e.target as HTMLInputElement).value;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mp-y2').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].y2Col = (e.target as HTMLSelectElement).value;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.inp-mp-c2').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-pidx') || '0', 10);
      if (state.mpPanels[idx]) {
        state.mpPanels[idx].y2Color = (e.target as HTMLInputElement).value;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.mp-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-mppreset') as keyof typeof MP_PRESETS | null;
      if (p && MP_PRESETS[p]) {
        state.mpPreset = p;
        state.mpWidthCm = MP_PRESETS[p].w;
        state.mpHeightCm = MP_PRESETS[p].h;
        renderApp();
      }
    });
  });

  // MultiPlot Save/Load
  document.getElementById('sel-multiplot')?.addEventListener('change', async (e) => {
    const mpName = (e.target as HTMLSelectElement).value;
    if (mpName && state.activeProject && state.projectsStore[state.activeProject]?.multiplots?.[mpName]) {
      const cfg = state.projectsStore[state.activeProject].multiplots![mpName];
      state.activeMultiPlot = cfg.name;
      state.mpTopology = cfg.topology;
      state.mpShareX = cfg.share_x;
      state.mpAutoLettering = cfg.auto_lettering;
      state.mpPreset = cfg.preset as any;
      state.mpWidthCm = cfg.width_cm;
      state.mpHeightCm = cfg.height_cm;
      state.mpPanels = JSON.parse(JSON.stringify(cfg.panels));
      renderApp();
    }
  });

  document.getElementById('btn-save-multiplot')?.addEventListener('click', async () => {
    await saveMultiPlot(state.activeMultiPlot || 'MultiPlot_1');
  });

  document.getElementById('btn-new-multiplot')?.addEventListener('click', async () => {
    const newName = prompt('Inserisci nome nuovo MultiPlot:', `MultiPlot_${Date.now().toString().slice(-3)}`);
    if (newName && newName.trim()) {
      state.activeMultiPlot = newName.trim();
      await saveMultiPlot(newName.trim());
    }
  });

  document.getElementById('btn-delete-multiplot')?.addEventListener('click', async () => {
    if (!state.activeProject || !state.projectsStore[state.activeProject]?.multiplots) return;
    delete state.projectsStore[state.activeProject].multiplots![state.activeMultiPlot];
    await persistProjectsStore();
    renderApp();
  });

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
    updateMapChart();
  });

  document.getElementById('map-lon-col')?.addEventListener('change', (e) => {
    state.geoLonCol = (e.target as HTMLSelectElement).value;
    updateMapChart();
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

  document.getElementById('map-cluster-toggle')?.addEventListener('change', (e) => {
    state.mapClusterEnabled = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('map-cluster-panel');
    if (panel) panel.style.display = state.mapClusterEnabled ? 'block' : 'none';
    updateMapChart();
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
      state.mapColorCol = cfg.color_col;
      state.mapSizeCol = cfg.size_col;
      state.mapClusterEnabled = cfg.cluster_enabled;
      state.mapClusterAgg = cfg.cluster_agg;
      state.mapClusterGridDeg = cfg.cluster_grid_deg;
      state.mapColorscale = cfg.colorscale;
      state.mapPreset = cfg.preset as any;
      state.mapWidthCm = cfg.width_cm;
      state.mapHeightCm = cfg.height_cm;
      renderApp();
    }
  });

  document.getElementById('btn-save-map')?.addEventListener('click', async () => {
    await saveMapConfig(state.activeMap || 'Mappa_1');
  });

  document.getElementById('btn-new-map')?.addEventListener('click', async () => {
    const newName = prompt('Inserisci nome nuova Mappa:', `Mappa_${Date.now().toString().slice(-3)}`);
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

  // Export 1-Click SVG (Universal for active tab)
  document.getElementById('btn-export')?.addEventListener('click', () => {
    if (state.currentTab === 'multi') {
      Plotly.downloadImage('plotly-multi-chart', {
        format: 'svg',
        width: state.mpWidthCm * 37.795,
        height: state.mpHeightCm * 37.795,
        filename: `ChartMate_MultiPlot_${state.mpTopology}`
      });
    } else if (state.currentTab === 'maps') {
      Plotly.downloadImage('plotly-map-chart', {
        format: 'png',
        width: state.mapWidthCm * 37.795 * 2,
        height: state.mapHeightCm * 37.795 * 2,
        filename: `ChartMate_Map_${state.mapMode}_${state.mapClusterAgg}`
      });
    } else {
      Plotly.downloadImage('plotly-chart', {
        format: 'svg',
        width: state.widthCm * 37.795,
        height: state.heightCm * 37.795,
        filename: `ChartMate_${state.preset}_figure`
      });
    }
  });

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
    const newName = prompt('Inserisci il nome del nuovo Canvas:', `Canvas_${existingCount + 1}`);
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

async function saveMultiPlot(mpName: string) {
  if (!state.activeProject) {
    await saveCurrentProject('Progetto_IEQ');
  }
  if (!state.activeProject) return;
  const proj = state.projectsStore[state.activeProject];
  if (!proj.multiplots) proj.multiplots = {};
  proj.multiplots[mpName] = {
    name: mpName,
    topology: state.mpTopology,
    share_x: state.mpShareX,
    auto_lettering: state.mpAutoLettering,
    preset: state.mpPreset,
    width_cm: state.mpWidthCm,
    height_cm: state.mpHeightCm,
    panels: JSON.parse(JSON.stringify(state.mpPanels))
  };
  await persistProjectsStore();
  renderApp();
}

async function saveMapConfig(mapName: string) {
  if (!state.activeProject) {
    await saveCurrentProject('Progetto_GIS');
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

function serializeCanvasConfig(name: string): CanvasConfig {
  return {
    name,
    selected_x: state.selectedX,
    traces: JSON.parse(JSON.stringify(state.traces)),
    y1_title: state.y1Title,
    y2_title: state.y2Title,
    y3_title: state.y3Title,
    y4_title: state.y4Title,
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

function applyCanvasConfig(cfg: CanvasConfig) {
  state.activeCanvas = cfg.name;
  state.selectedX = cfg.selected_x || '';
  state.traces = cfg.traces ? JSON.parse(JSON.stringify(cfg.traces)) : [];
  state.y1Title = cfg.y1_title || '';
  state.y2Title = cfg.y2_title || '';
  state.y3Title = cfg.y3_title || '';
  state.y4Title = cfg.y4_title || '';
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

async function fetchProjectsStore() {
  try {
    const res = await invoke<ProjectsStore>('load_projects_store');
    state.projectsStore = res || {};
  } catch (err) {
    console.error('Failed to load projects store:', err);
    state.projectsStore = {};
  }
}

async function persistProjectsStore() {
  try {
    await invoke('save_projects_store', { data: state.projectsStore });
  } catch (err) {
    console.error('Failed to save projects store:', err);
    alert(`Errore nel salvataggio dei progetti: ${err}`);
  }
}

async function saveCurrentProject(projectName?: string) {
  let name = (projectName || state.activeProject || '').trim();
  if (!name) {
    const prompted = prompt('Inserisci un nome per il progetto:', 'Nuovo_Progetto_IEQ');
    if (!prompted || !prompted.trim()) return;
    name = prompted.trim();
  }

  state.activeProject = name;

  if (!state.projectsStore[name]) {
    state.projectsStore[name] = {
      name,
      file_path: state.filePath || '',
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
    state.projectsStore[name].file_path = state.filePath || '';
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

  // Save current active canvas into project canvases
  const currentCanvasName = state.activeCanvas || 'Canvas_1';
  state.projectsStore[name].canvases[currentCanvasName] = serializeCanvasConfig(currentCanvasName);
  state.projectsStore[name].active_canvas = currentCanvasName;

  await persistProjectsStore();
  renderApp();
}

async function loadProject(projectName: string) {
  const p = state.projectsStore[projectName];
  if (!p) return;

  state.activeProject = projectName;
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

  // Determine active canvas to load
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
  } else {
    state.filePath = p.file_path || null;
    renderApp();
  }
}

async function deleteProject(projectName: string) {
  if (!confirm(`Sei sicuro di voler eliminare il progetto "${projectName}" e tutti i relativi grafici?`)) {
    return;
  }
  delete state.projectsStore[projectName];
  if (state.activeProject === projectName) {
    state.activeProject = '';
  }
  await persistProjectsStore();
  renderApp();
}

async function saveCanvas(canvasName: string) {
  if (!state.activeProject) {
    const projName = prompt('Per salvare un grafico, crea prima un Progetto. Nome progetto:', 'Progetto_1');
    if (!projName || !projName.trim()) return;
    state.activeProject = projName.trim();
    state.projectsStore[state.activeProject] = {
      name: state.activeProject,
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

async function loadCanvas(canvasName: string) {
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

async function deleteCanvas(canvasName: string) {
  if (!state.activeProject || !state.projectsStore[state.activeProject]) return;
  const proj = state.projectsStore[state.activeProject];
  const keys = Object.keys(proj.canvases);
  if (keys.length <= 1) {
    alert('Non puoi eliminare l\'unico grafico presente nel progetto.');
    return;
  }

  if (!confirm(`Sei sicuro di voler eliminare il canvas "${canvasName}"?`)) return;

  delete proj.canvases[canvasName];
  const remaining = Object.keys(proj.canvases);
  const nextCanvas = remaining[0];
  proj.active_canvas = nextCanvas;
  applyCanvasConfig(proj.canvases[nextCanvas]);
  await persistProjectsStore();
  renderApp();
}

function toISODate(str: string): string {
  if (!str) return '';
  const part = str.trim().split(' ')[0].trim();
  const mISO = part.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (mISO) {
    return `${mISO[1]}-${mISO[2].padStart(2, '0')}-${mISO[3].padStart(2, '0')}`;
  }
  const mEU = part.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mEU) {
    return `${mEU[3]}-${mEU[2].padStart(2, '0')}-${mEU[1].padStart(2, '0')}`;
  }
  return part;
}

function calculateTimeframeDates(mode: string) {
  if (!state.dataset || !state.timestampCol) return;
  const tsIdx = state.dataset.columns.indexOf(state.timestampCol);
  if (tsIdx === -1 || state.dataset.rows.length === 0) return;

  const firstVal = state.dataset.rows[0][tsIdx];
  const lastVal = state.dataset.rows[state.dataset.rows.length - 1][tsIdx];

  const firstDateStr = toISODate(firstVal);
  const lastDateStr = toISODate(lastVal);

  if (mode === 'all') {
    state.startDate = firstDateStr;
    state.endDate = lastDateStr;
  } else if (mode === 'day') {
    state.startDate = firstDateStr;
    state.endDate = firstDateStr;
  } else if (mode === 'week') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 7);
      state.endDate = d.toISOString().split('T')[0];
    } else {
      state.endDate = firstDateStr;
    }
  } else if (mode === 'month') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    if (!isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 1);
      state.endDate = d.toISOString().split('T')[0];
    } else {
      state.endDate = firstDateStr;
    }
  }
}

async function handleFileSelect() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Supported Datasets', extensions: ['parquet', 'pq', 'csv', 'xlsx', 'xls', 'tsv', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (selected) {
      await loadFile(selected as string);
    }
  } catch (err) {
    console.warn('Dialog selection fallback', err);
  }
}

function applyDatasetMetadata(preview: DatasetPreview, resetCanvas: boolean = true) {
  // Auto-detect Lat/Lon columns
  const latCandidate = preview.columns.find(c => /^(lat|latitude|latitudine|y_coord|coord_y)$/i.test(c.trim()));
  const lonCandidate = preview.columns.find(c => /^(lon|lng|long|longitude|longitudine|x_coord|coord_x)$/i.test(c.trim()));
  if (latCandidate && (!state.geoLatCol || resetCanvas)) state.geoLatCol = latCandidate;
  if (lonCandidate && (!state.geoLonCol || resetCanvas)) state.geoLonCol = lonCandidate;

  if (resetCanvas) {
    if (preview.suggested_ts_col) {
      state.timestampCol = preview.suggested_ts_col;
      state.selectedX = preview.suggested_ts_col;
      state.hasTimestamp = true;
      calculateTimeframeDates('all');
    } else if (preview.columns.length > 0) {
      state.hasTimestamp = false;
      state.timestampCol = '';
      state.timeframeMode = 'all';
      state.startDate = '';
      state.endDate = '';
      state.selectedX = preview.columns[0];
    }

    if (preview.suggested_ts_format) {
      state.timestampFormat = preview.suggested_ts_format;
    }

    const nonAxisCols = preview.columns.filter(
      c => c !== state.selectedX && c !== state.geoLatCol && c !== state.geoLonCol
    );

    // Default Single Canvas Traces Setup
    state.traces = [];
    if (nonAxisCols.length > 0) {
      state.traces.push({
        column: nonAxisCols[0],
        axis: 'y1',
        chartType: 'line',
        color: '#000000',
        lineWidth: 2.0,
        lineDash: 'solid'
      });
      state.y1Title = nonAxisCols[0];
      state.mapColorCol = nonAxisCols[0];
    }

    if (nonAxisCols.length > 1) {
      state.traces.push({
        column: nonAxisCols[1],
        axis: 'y2',
        chartType: 'line',
        color: '#0284c7',
        lineWidth: 1.8,
        lineDash: 'dash'
      });
      state.y2Title = nonAxisCols[1];
    }

    // Default MultiPlot Panels Setup
    const letters = ['(a)', '(b)', '(c)', '(d)'];
    for (let i = 0; i < 4; i++) {
      const col = nonAxisCols[i % Math.max(1, nonAxisCols.length)] || '';
      state.mpPanels[i] = {
        y1Col: col,
        y1Type: i === 2 ? 'bar' : 'line',
        y1Color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
        y2Col: '',
        y2Color: '#0284c7',
        yTitle: col || `Panel ${letters[i]}`
      };
    }
  }
}

async function loadFile(path: string, resetCanvas: boolean = true) {
  try {
    state.filePath = path;
    const options: ParseOptions = {
      separator: state.separator === 'auto' ? undefined : state.separator,
      decimal: state.decimal,
      timestamp_col: state.timestampCol || undefined,
      timestamp_format: state.timestampFormat || undefined,
      max_rows: undefined
    };

    const preview = await invoke<DatasetPreview>('read_dataset_sample', { filePath: path, options });
    state.dataset = preview;
    applyDatasetMetadata(preview, resetCanvas);

    renderApp();
  } catch (err) {
    alert(`Errore lettura file locale: ${err}`);
  }
}

function parseNumericValue(rawVal: any): number | null {
  let valStr = String(rawVal ?? '').trim();
  if (valStr === '' || valStr === 'null' || valStr === 'nan' || valStr === 'None') return null;

  if (valStr.includes(',') && valStr.includes('.')) {
    if (valStr.indexOf('.') < valStr.indexOf(',')) {
      valStr = valStr.replace(/\./g, '').replace(',', '.');
    } else {
      valStr = valStr.replace(/,/g, '');
    }
  } else if (valStr.includes(',')) {
    valStr = valStr.replace(',', '.');
  }

  const num = parseFloat(valStr);
  return isNaN(num) ? null : num;
}

function parseGeoCoordinate(rawVal: any, format: 'decimal_degrees' | 'dms'): number | null {
  if (rawVal === null || rawVal === undefined) return null;
  const str = String(rawVal).trim();
  if (!str) return null;

  if (format === 'dms' || /[°'"NSEW]/i.test(str)) {
    const m = str.match(/(-?\d+(?:\.\d+)?)\s*[°d:]?\s*(\d+(?:\.\d+)?)?\s*['m:]?\s*(\d+(?:\.\d+)?)?\s*["s]?\s*([NSEW])?/i);
    if (m) {
      const deg = parseFloat(m[1]) || 0;
      const min = parseFloat(m[2]) || 0;
      const sec = parseFloat(m[3]) || 0;
      const dir = (m[4] || '').toUpperCase();
      let dd = Math.abs(deg) + min / 60.0 + sec / 3600.0;
      if (deg < 0 || dir === 'S' || dir === 'W') dd = -dd;
      return isNaN(dd) ? null : dd;
    }
  }
  return parseNumericValue(str);
}

function updateChart() {
  const chartEl = document.getElementById('plotly-chart');
  if (!chartEl) return;

  const ratio = state.widthCm / state.heightCm;
  let pxW = 850;
  let pxH = Math.round(pxW / ratio);

  if (state.preset === 'square') {
    pxW = 600;
    pxH = 600;
  } else if (state.preset === 'single') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  }

  let xVals: any[] = [];
  let traces: any[] = [];
  const annotations: any[] = [];

  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    
    // Filter rows by Timeframe ONLY if mode is NOT 'all'
    let activeRows = state.dataset.rows;
    if (state.timeframeMode !== 'all' && state.hasTimestamp && state.selectedX === state.timestampCol && (state.startDate || state.endDate)) {
      activeRows = state.dataset.rows.filter(r => {
        const val = toISODate(r[xIdx]);
        if (!val) return true;
        if (state.startDate && val < state.startDate) return false;
        if (state.endDate && val > state.endDate) return false;
        return true;
      });
    }

    xVals = activeRows.map(r => r[xIdx]);

    // Build Traces based on TraceConfig (Individual types: line, bar, area, scatter)
    state.traces.forEach((t) => {
      const yIdx = state.dataset!.columns.indexOf(t.column);
      if (yIdx === -1) return;

      const yVals = activeRows.map(r => parseNumericValue(r[yIdx]));

      // Plotly Trace Configuration
      let pType = 'scatter';
      let pMode: string | undefined = 'lines';
      let pFill: string | undefined = undefined;

      if (t.chartType === 'line') {
        pType = 'scatter';
        pMode = 'lines';
      } else if (t.chartType === 'scatter') {
        pType = 'scatter';
        pMode = 'markers';
      } else if (t.chartType === 'area') {
        pType = 'scatter';
        pMode = 'lines';
        pFill = 'tozeroy';
      } else if (t.chartType === 'bar') {
        pType = 'bar';
        pMode = undefined;
      }

      const traceObj: any = {
        x: xVals,
        y: yVals,
        name: t.column,
        yaxis: t.axis === 'y1' ? 'y' : t.axis,
        type: pType,
        mode: pMode,
        fill: pFill,
        line: { color: t.color, width: t.lineWidth, dash: t.lineDash },
        marker: { size: 5, color: t.color }
      };

      if (t.chartType === 'bar') {
        traceObj.marker = { color: t.color, opacity: 0.85 };
        delete traceObj.mode;
        delete traceObj.line;
      }

      traces.push(traceObj);

      // Peak & Valley Tracker Logic for this trace
      if (state.peakMode !== 'none' && yVals.length > 0 && t.axis === 'y1') {
        calculatePeakAnnotations(xVals, yVals, state.peakMode, annotations, t.axis === 'y1' ? 'y' : t.axis);
      }
    });

    if (traces.length === 0) {
      annotations.push({
        text: 'Nessuna serie attiva.<br>Aggiungi una serie dal pannello "Tracce & Stile Per-Serie".',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: { size: 13, color: '#64748b' }
      });
    }

  } else {
    // Default Demo waveform
    const steps = 30;
    xVals = Array.from({ length: steps }, (_, i) => `2026-09-01 ${String(i % 24).padStart(2, '0')}:00`);
    const yVals = Array.from({ length: steps }, (_, i) => 21.0 + 4.0 * Math.sin(i / 3));
    traces.push({
      x: xVals,
      y: yVals,
      name: 'Indoor Temperature (°C)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#000000', width: 2.2 },
      marker: { size: 5, color: '#000000' }
    });
  }

  // Multi-Axis Verification
  const hasY2 = state.traces.some(t => t.axis === 'y2');
  const hasY3 = state.traces.some(t => t.axis === 'y3');
  const hasY4 = state.traces.some(t => t.axis === 'y4');

  let rightMargin = 30;
  if (hasY4) rightMargin = 150;
  else if (hasY3) rightMargin = 110;
  else if (hasY2) rightMargin = 65;

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 65, r: rightMargin, t: 35, b: 50 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    annotations: annotations,
    xaxis: {
      title: { text: state.selectedX || 'Time / Parameter', font: { size: state.fontSize + 1, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
    },
    yaxis: {
      title: { text: state.y1Title || 'Primary Y1', font: { size: state.fontSize + 1, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: 1.12,
      xanchor: 'center',
      font: { size: state.fontSize - 1, color: '#000000' }
    },
    shapes: []
  };

  // Y2 Axis (Destra 1)
  if (hasY2) {
    layout.yaxis2 = {
      title: { text: state.y2Title || 'Y2 Axis', font: { size: state.fontSize, color: '#0284c7', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      linecolor: '#0284c7',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#0284c7' }
    };
  }

  // Y3 Axis (Destra 2 con Offset)
  if (hasY3) {
    layout.yaxis3 = {
      title: { text: state.y3Title || 'Y3 Axis', font: { size: state.fontSize, color: '#d97706', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      position: 0.93,
      gridcolor: 'transparent',
      linecolor: '#d97706',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#d97706' }
    };
  }

  // Y4 Axis (Destra 3 con Offset Avanzato)
  if (hasY4) {
    layout.yaxis4 = {
      title: { text: state.y4Title || 'Y4 Axis', font: { size: state.fontSize, color: '#7c3aed', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      position: 0.86,
      gridcolor: 'transparent',
      linecolor: '#7c3aed',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#7c3aed' }
    };
  }

  // Comfort Band Shading
  if (state.comfortBand) {
    layout.shapes.push({
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: state.comfortMin,
      y1: state.comfortMax,
      fillcolor: state.comfortSeason === 'winter' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)',
      line: { width: 0 },
      layer: 'below'
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function updateMultiPlotChart() {
  const chartEl = document.getElementById('plotly-multi-chart');
  if (!chartEl) return;

  const ratio = state.mpWidthCm / state.mpHeightCm;
  let pxW = 860;
  let pxH = Math.round(pxW / ratio);
  if (state.mpPreset === 'single_stack') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  } else if (state.mpPreset === 'square_grid') {
    pxW = 680;
    pxH = 680;
  }

  const topo = state.mpTopology;
  const rows = topo === '3x1' ? 3 : (topo === '2x1' || topo === '2x2' ? 2 : 1);
  const cols = topo === '2x2' || topo === '1x2' ? 2 : 1;
  const panelCount = rows * cols;
  const letters = ['(a)', '(b)', '(c)', '(d)'];

  const traces: any[] = [];
  const annotations: any[] = [];
  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 65, r: 55, t: 45, b: 55 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: 1.07,
      xanchor: 'center',
      font: { size: state.fontSize - 1, color: '#000000' }
    },
    annotations
  };

  let xVals: any[] = [];
  let activeRows = state.dataset?.rows || [];
  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    if (xIdx !== -1) {
      xVals = activeRows.map(r => r[xIdx]);
    }
  }
  if (xVals.length === 0) {
    xVals = Array.from({ length: 24 }, (_, i) => `2026-09-01 ${String(i).padStart(2, '0')}:00`);
  }

  const vGap = rows === 3 ? 0.08 : (rows === 2 ? 0.11 : 0);
  const hGap = cols === 2 ? 0.12 : 0;
  const cellH = (1.0 - vGap * (rows - 1)) / rows;
  const cellW = (1.0 - hGap * (cols - 1)) / cols;

  for (let i = 0; i < panelCount; i++) {
    const rIdx = Math.floor(i / cols);
    const cIdx = i % cols;
    const xDom0 = Number((cIdx * (cellW + hGap)).toFixed(4));
    const xDom1 = Number((xDom0 + cellW).toFixed(4));
    const yDom1 = Number((1.0 - rIdx * (cellH + vGap)).toFixed(4));
    const yDom0 = Number(Math.max(0, yDom1 - cellH).toFixed(4));

    const axNum = i === 0 ? '' : String(i + 1);
    const xAxisName = `xaxis${axNum}`;
    const yAxisName = `yaxis${axNum}`;
    const xRef = `x${axNum}`;
    const yRef = `y${axNum}`;

    const pCfg = state.mpPanels[i] || {
      y1Col: '',
      y1Type: 'line',
      y1Color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      y2Col: '',
      y2Color: '#0284c7',
      yTitle: `Panel ${letters[i]}`
    };

    const isBottomRow = rIdx === rows - 1;
    const hideXTicks = state.mpShareX && cols === 1 && !isBottomRow;

    layout[xAxisName] = {
      domain: [xDom0, xDom1],
      anchor: yRef,
      showticklabels: !hideXTicks,
      title: isBottomRow ? { text: state.selectedX || 'Time', font: { size: state.fontSize, color: '#000000', weight: 600 } } : undefined,
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.1,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#000000' }
    };
    if (state.mpShareX && i > 0) {
      layout[xAxisName].matches = 'x';
    }

    layout[yAxisName] = {
      domain: [yDom0, yDom1],
      anchor: xRef,
      title: { text: pCfg.yTitle || pCfg.y1Col || `Panel ${letters[i]}`, font: { size: state.fontSize, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.1,
      showline: true,
      mirror: !pCfg.y2Col,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#000000' }
    };

    // Primary Y1 Trace
    let y1Vals: (number | null)[] = [];
    if (state.dataset && pCfg.y1Col) {
      const yIdx = state.dataset.columns.indexOf(pCfg.y1Col);
      if (yIdx !== -1) {
        y1Vals = activeRows.map(r => parseNumericValue(r[yIdx]));
      }
    } else {
      y1Vals = xVals.map((_, k) => 20 + (i + 1) * 2 * Math.sin((k + i * 3) / 3));
    }

    traces.push({
      x: xVals,
      y: y1Vals,
      name: `${letters[i]} ${pCfg.y1Col || pCfg.yTitle}`,
      xaxis: xRef,
      yaxis: yRef,
      type: pCfg.y1Type === 'bar' ? 'bar' : 'scatter',
      mode: pCfg.y1Type === 'scatter' ? 'markers' : (pCfg.y1Type === 'bar' ? undefined : 'lines'),
      fill: pCfg.y1Type === 'area' ? 'tozeroy' : undefined,
      line: { color: pCfg.y1Color, width: 1.9 },
      marker: { color: pCfg.y1Color, size: 4 }
    });

    // Optional Secondary Y2 Trace in same Panel
    if (state.dataset && pCfg.y2Col) {
      const y2Idx = state.dataset.columns.indexOf(pCfg.y2Col);
      if (y2Idx !== -1) {
        const y2AxisId = i + 10; // yaxis10, yaxis11...
        const y2Ref = `y${y2AxisId}`;
        const y2Vals = activeRows.map(r => parseNumericValue(r[y2Idx]));

        layout[`yaxis${y2AxisId}`] = {
          domain: [yDom0, yDom1],
          anchor: xRef,
          overlaying: yRef,
          side: 'right',
          title: { text: pCfg.y2Col, font: { size: state.fontSize - 1, color: pCfg.y2Color, weight: 600 } },
          gridcolor: 'transparent',
          linecolor: pCfg.y2Color,
          linewidth: 1.1,
          showline: true,
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: pCfg.y2Color }
        };

        traces.push({
          x: xVals,
          y: y2Vals,
          name: `${letters[i]} ${pCfg.y2Col} (Y2)`,
          xaxis: xRef,
          yaxis: y2Ref,
          type: 'scatter',
          mode: 'lines',
          line: { color: pCfg.y2Color, width: 1.6, dash: 'dash' }
        });
      }
    }

    // Academic Auto-Lettering Badge (a), (b), (c), (d)
    if (state.mpAutoLettering) {
      annotations.push({
        text: `<b>${letters[i]}</b>`,
        xref: 'paper',
        yref: 'paper',
        x: xDom0 + 0.015,
        y: yDom1 - 0.02,
        xanchor: 'left',
        yanchor: 'top',
        showarrow: false,
        font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' },
        bgcolor: 'rgba(255,255,255,0.88)',
        borderpad: 2
      });
    }
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function computeMathematicalAggregation(values: number[], rawStrings: string[], agg: string): { val: number; label: string } {
  if (agg === 'count') {
    return { val: rawStrings.length, label: `N = ${rawStrings.length}` };
  }
  if (agg === 'mode') {
    const freq: Record<string, number> = {};
    let bestKey = rawStrings[0] || '0';
    let bestCount = 0;
    for (const s of rawStrings) {
      const k = s.trim();
      if (!k) continue;
      freq[k] = (freq[k] || 0) + 1;
      if (freq[k] > bestCount) {
        bestCount = freq[k];
        bestKey = k;
      }
    }
    const numVal = parseNumericValue(bestKey) ?? bestCount;
    return { val: numVal, label: `Moda: ${bestKey} (${bestCount}x)` };
  }

  if (values.length === 0) return { val: 0, label: 'N/A' };

  if (agg === 'sum') {
    const s = values.reduce((a, b) => a + b, 0);
    return { val: s, label: `Σ = ${s.toFixed(2)}` };
  }
  if (agg === 'max') {
    const m = Math.max(...values);
    return { val: m, label: `Max = ${m.toFixed(2)}` };
  }
  if (agg === 'min') {
    const m = Math.min(...values);
    return { val: m, label: `Min = ${m.toFixed(2)}` };
  }
  // Default: Mean (μ)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { val: mean, label: `μ = ${mean.toFixed(2)}` };
}

function updateMapChart() {
  const chartEl = document.getElementById('plotly-map-chart');
  if (!chartEl) return;

  const ratio = state.mapWidthCm / state.mapHeightCm;
  let pxW = 850;
  let pxH = Math.round(pxW / ratio);
  if (state.mapPreset === 'square') {
    pxW = 620;
    pxH = 620;
  } else if (state.mapPreset === 'single') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  }

  const lats: number[] = [];
  const lons: number[] = [];
  const vals: number[] = [];
  const hoverTexts: string[] = [];

  if (state.dataset && state.geoLatCol && state.geoLonCol) {
    const latIdx = state.dataset.columns.indexOf(state.geoLatCol);
    const lonIdx = state.dataset.columns.indexOf(state.geoLonCol);
    const colIdx = state.mapColorCol ? state.dataset.columns.indexOf(state.mapColorCol) : -1;

    if (latIdx !== -1 && lonIdx !== -1) {
      if (state.mapClusterEnabled) {
        // Spatial Grid Binning & Mathematical Aggregation
        const grid = state.mapClusterGridDeg || 0.005;
        const bins: Record<string, { lats: number[]; lons: number[]; nums: number[]; raws: string[] }> = {};

        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

          const bLat = Math.round(lat / grid) * grid;
          const bLon = Math.round(lon / grid) * grid;
          const key = `${bLat.toFixed(5)}_${bLon.toFixed(5)}`;

          if (!bins[key]) {
            bins[key] = { lats: [], lons: [], nums: [], raws: [] };
          }
          bins[key].lats.push(lat);
          bins[key].lons.push(lon);

          const rawStr = colIdx !== -1 ? String(r[colIdx] ?? '') : '1';
          bins[key].raws.push(rawStr);
          const num = colIdx !== -1 ? parseNumericValue(r[colIdx]) : 1;
          if (num !== null) bins[key].nums.push(num);
        }

        Object.values(bins).forEach(b => {
          const cLat = b.lats.reduce((a, c) => a + c, 0) / b.lats.length;
          const cLon = b.lons.reduce((a, c) => a + c, 0) / b.lons.length;
          const aggRes = computeMathematicalAggregation(b.nums, b.raws, state.mapClusterAgg);

          lats.push(cLat);
          lons.push(cLon);
          vals.push(aggRes.val);
          hoverTexts.push(
            `<b>Cluster (${b.lats.length} pt)</b><br>Lat: ${cLat.toFixed(4)}, Lon: ${cLon.toFixed(4)}<br>${state.mapColorCol || 'Val'}: <b>${aggRes.label}</b>`
          );
        });

        state.mapLastClusterCount = lats.length;
        state.mapLastSummaryStat = `${state.mapClusterAgg.toUpperCase()} (${lats.length} celle)`;
        const cntEl = document.getElementById('lbl-cluster-count');
        const stEl = document.getElementById('lbl-cluster-stat');
        if (cntEl) cntEl.textContent = String(state.mapLastClusterCount);
        if (stEl) stEl.textContent = state.mapLastSummaryStat;
      } else {
        // Raw Unclustered Points
        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

          const num = colIdx !== -1 ? (parseNumericValue(r[colIdx]) ?? 0) : 1;
          lats.push(lat);
          lons.push(lon);
          vals.push(num);
          hoverTexts.push(
            `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}<br>${state.mapColorCol || 'Valore'}: <b>${colIdx !== -1 ? r[colIdx] : num}</b>`
          );
        }
      }
    }
  }

  // Fallback Demo Geo Data (Milan Politecnico / Urban Sensor Network) if no geo columns yet
  if (lats.length === 0) {
    const demoCoords = [
      [45.4781, 9.2270, 21.4],
      [45.4795, 9.2292, 22.8],
      [45.4768, 9.2251, 20.9],
      [45.4810, 9.2315, 24.1],
      [45.4752, 9.2288, 23.2]
    ];
    for (const [la, lo, v] of demoCoords) {
      lats.push(la);
      lons.push(lo);
      vals.push(v);
      hoverTexts.push(`Sensore Demo<br>Lat: ${la}, Lon: ${lo}<br>Valore: <b>${v} °C</b>`);
    }
  }

  // Auto-Fit Bounding Box & Zoom Calculation
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const maxSpan = Math.max(maxLat - minLat, maxLon - minLon, 0.002);
  let zoom = Math.floor(Math.log2(360 / maxSpan)) - 1;
  zoom = Math.max(1, Math.min(16, zoom));

  const traces: any[] = [];
  if (state.mapMode === 'density') {
    traces.push({
      type: 'densitymapbox',
      lat: lats,
      lon: lons,
      z: vals,
      radius: 22,
      colorscale: state.mapColorscale,
      colorbar: {
        title: { text: state.mapColorCol || 'Metric', font: { size: state.fontSize, color: '#000000' } },
        tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
      },
      hoverinfo: 'text',
      text: hoverTexts
    });
  } else if (state.mapMode === 'track') {
    traces.push({
      type: 'scattermapbox',
      mode: 'lines+markers',
      lat: lats,
      lon: lons,
      line: { width: 2.8, color: '#059669' },
      marker: {
        size: 9,
        color: vals,
        colorscale: state.mapColorscale,
        showscale: true,
        colorbar: {
          title: { text: state.mapColorCol || 'Metric', font: { size: state.fontSize, color: '#000000' } },
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'GPS Track'
    });
  } else {
    // Bubble Scatter Map
    traces.push({
      type: 'scattermapbox',
      mode: 'markers',
      lat: lats,
      lon: lons,
      marker: {
        size: state.mapClusterEnabled ? 15 : 11,
        opacity: 0.9,
        color: vals,
        colorscale: state.mapColorscale,
        showscale: true,
        colorbar: {
          title: { text: `${state.mapColorCol || 'Metric'} (${state.mapClusterEnabled ? state.mapClusterAgg.toUpperCase() : 'Raw'})`, font: { size: state.fontSize, color: '#000000' } },
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'Geo Points'
    });
  }

  // Base Map Tile Configuration (Free Vector Styles + Custom Raster Layers for Satellite & Topo)
  const mapboxCfg: any = {
    center: { lat: centerLat, lon: centerLon },
    zoom
  };

  if (state.mapBasemap === 'esri-satellite') {
    mapboxCfg.style = 'white-bg';
    mapboxCfg.layers = [{
      sourcetype: 'raster',
      source: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      below: 'traces'
    }];
  } else if (state.mapBasemap === 'opentopomap') {
    mapboxCfg.style = 'white-bg';
    mapboxCfg.layers = [{
      sourcetype: 'raster',
      source: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
      below: 'traces'
    }];
  } else {
    mapboxCfg.style = state.mapBasemap; // carto-positron, open-street-map, carto-darkmatter
  }

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 15, r: 15, t: 15, b: 15 },
    paper_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    mapbox: mapboxCfg,
    showlegend: false
  };

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function calculatePeakAnnotations(xVals: any[], yVals: (number | null)[], mode: string, annotations: any[], yref: string) {
  if (mode === 'global') {
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxIdx = -1;
    let minIdx = -1;

    for (let i = 0; i < yVals.length; i++) {
      const v = yVals[i];
      if (v !== null && !isNaN(v)) {
        if (v > maxVal) { maxVal = v; maxIdx = i; }
        if (v < minVal) { minVal = v; minIdx = i; }
      }
    }

    if (maxIdx !== -1) {
      annotations.push({
        x: xVals[maxIdx],
        y: maxVal,
        xref: 'x',
        yref: yref,
        text: `🔴 Max: ${maxVal.toFixed(2)}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#e11d48',
        font: { size: 10, color: '#e11d48', family: 'JetBrains Mono, monospace' },
        bgcolor: '#ffffff',
        bordercolor: '#e11d48',
        borderwidth: 1
      });
    }

    if (minIdx !== -1) {
      annotations.push({
        x: xVals[minIdx],
        y: minVal,
        xref: 'x',
        yref: yref,
        text: `🔵 Min: ${minVal.toFixed(2)}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#0284c7',
        font: { size: 10, color: '#0284c7', family: 'JetBrains Mono, monospace' },
        bgcolor: '#ffffff',
        bordercolor: '#0284c7',
        borderwidth: 1
      });
    }
  } else if (mode === 'daily') {
    // Group by Day (YYYY-MM-DD)
    const dayGroups: Record<string, { maxVal: number; maxIdx: number; minVal: number; minIdx: number }> = {};

    for (let i = 0; i < yVals.length; i++) {
      const v = yVals[i];
      if (v === null || isNaN(v)) continue;
      const day = String(xVals[i]).split(' ')[0];
      if (!dayGroups[day]) {
        dayGroups[day] = { maxVal: v, maxIdx: i, minVal: v, minIdx: i };
      } else {
        if (v > dayGroups[day].maxVal) { dayGroups[day].maxVal = v; dayGroups[day].maxIdx = i; }
        if (v < dayGroups[day].minVal) { dayGroups[day].minVal = v; dayGroups[day].minIdx = i; }
      }
    }

    Object.values(dayGroups).forEach(g => {
      annotations.push({
        x: xVals[g.maxIdx],
        y: g.maxVal,
        xref: 'x',
        yref: yref,
        text: `${g.maxVal.toFixed(1)}`,
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#e11d48',
        font: { size: 9, color: '#e11d48', family: 'JetBrains Mono, monospace' }
      });
      annotations.push({
        x: xVals[g.minIdx],
        y: g.minVal,
        xref: 'x',
        yref: yref,
        text: `${g.minVal.toFixed(1)}`,
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#0284c7',
        font: { size: 9, color: '#0284c7', family: 'JetBrains Mono, monospace' }
      });
    });
  }
}

// Boot application with persistent projects store
async function initApp() {
  await fetchProjectsStore();
  renderApp();
}

initApp();
