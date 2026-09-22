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

interface AppState {
  currentTab: 'data' | 'canvas' | 'multi';
  filePath: string | null;
  dataset: DatasetPreview | null;
  
  // Ingestion & Parsing Config
  separator: string; // 'auto', ',', ';', '\t', '|'
  decimal: string;   // '.', ','
  hasTimestamp: boolean;
  timestampCol: string;
  timestampFormat: string;
  
  // Timeframe Filtering (Now active in Canvas Studio)
  timeframeMode: 'all' | 'day' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  
  // Canvas Mapping
  selectedX: string;
  selectedY1: string[];
  selectedY2: string[];
  selectedY3: string[];
  chartType: string;
  preset: 'single' | 'double' | 'square' | 'custom';
  widthCm: number;
  heightCm: number;
  
  // Smart Annotations
  peakTracker: boolean;
  comfortBand: boolean;
  comfortMin: number;
  comfortMax: number;
}

const state: AppState = {
  currentTab: 'data',
  filePath: null,
  dataset: null,
  separator: 'auto',
  decimal: '.',
  hasTimestamp: true,
  timestampCol: '',
  timestampFormat: '%Y-%m-%d %H:%M:%S',
  timeframeMode: 'all',
  startDate: '',
  endDate: '',
  selectedX: '',
  selectedY1: [],
  selectedY2: [],
  selectedY3: [],
  chartType: 'scatter',
  preset: 'double',
  widthCm: 17.0,
  heightCm: 9.5,
  peakTracker: false,
  comfortBand: false,
  comfortMin: 20.0,
  comfortMax: 26.0,
};

const PRESETS = {
  single: { w: 8.5, h: 6.5 },
  double: { w: 17.0, h: 9.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 9.5 }
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
      <!-- VIEW 1: DATA INGESTION ONLY (Clean & Focused) -->
      <div class="view-panel ${state.currentTab === 'data' ? 'active' : ''}" id="view-data">
        <aside class="sidebar">
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Local / SharePoint File</span>
              <span class="cm-badge cm-badge-emerald">Direct I/O</span>
            </div>
            <div class="dropzone" id="dropzone-data">
              <div class="dropzone-icon">📂</div>
              <div style="font-weight: 600; font-size: 0.88rem; color: #000000;">Drag file here</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">or click to browse local path</div>
            </div>
            ${state.filePath ? `
              <div class="file-path-display">${state.filePath}</div>
              <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span>Total Rows: <strong>${state.dataset?.total_rows || 0}</strong></span>
                <span class="cm-badge cm-badge-sky">${state.dataset?.detected_sep || 'Unknown'}</span>
              </div>
            ` : ''}
          </section>

          <!-- Separators & Formatting -->
          <section class="sidebar-section">
            <div class="sidebar-title">Delimiter & Decimals</div>
            
            <div class="form-group">
              <label class="form-label">Column Separator</label>
              <select class="form-select" id="cfg-separator">
                <option value="auto" ${state.separator === 'auto' ? 'selected' : ''}>Auto-Detect</option>
                <option value="," ${state.separator === ',' ? 'selected' : ''}>, (Comma)</option>
                <option value=";" ${state.separator === ';' ? 'selected' : ''}>; (Semicolon - Italian/EU)</option>
                <option value="\t" ${state.separator === '\t' ? 'selected' : ''}>\\t (Tab / TSV)</option>
                <option value="|" ${state.separator === '|' ? 'selected' : ''}>| (Pipe)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Decimal Format</label>
              <select class="form-select" id="cfg-decimal">
                <option value="." ${state.decimal === '.' ? 'selected' : ''}>. (Dot: 12.34)</option>
                <option value="," ${state.decimal === ',' ? 'selected' : ''}>, (Comma: 12,34)</option>
              </select>
            </div>

            <button class="btn btn-secondary" id="btn-reparse" style="width: 100%; margin-top: 6px;">
              Apply & Re-Parse
            </button>
          </section>

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
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
                  Examples: <code>%Y-%m-%d %H:%M:%S</code>, <code>%d/%m/%Y %H:%M</code>
                </div>
              </div>
            </div>

            <button class="btn btn-primary" id="btn-goto-canvas" style="width: 100%; margin-top: 14px;">
              Open in Canvas Studio →
            </button>
          </section>
        </aside>

        <!-- Ingestion Table Preview Body -->
        <main class="data-ingestion-view">
          <div class="data-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 1.1rem; font-weight: 700; color: #000000;">Dataset Schema & Raw Data Preview</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  Showing first 100 rows with detected column headers
                </div>
              </div>
              <div>
                ${state.dataset ? `
                  <span class="cm-badge cm-badge-emerald" style="font-size: 0.8rem; padding: 4px 8px;">
                    ✓ ${state.dataset.columns.length} Columns · ${state.dataset.total_rows} Total Records
                  </span>
                ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">No dataset loaded</span>'}
              </div>
            </div>

            <div class="table-preview-scroll">
              ${renderPreviewTable()}
            </div>
          </div>
        </main>
      </div>

      <!-- VIEW 2: SINGLE CANVAS STUDIO (With Timeframe Selector & Multi-Axis) -->
      <div class="view-panel ${state.currentTab === 'canvas' ? 'active' : ''}" id="view-canvas">
        <aside class="sidebar">
          
          <!-- 1. TIMEFRAME SELECTOR (Inside Canvas as requested) -->
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

          <!-- 2. Variables & Axes -->
          <section class="sidebar-section">
            <div class="sidebar-title">Assi e Mappatura Variabili</div>
            
            <div class="form-group">
              <label class="form-label">Asse X (${state.hasTimestamp ? 'Timestamp' : 'Variabile Continua'})</label>
              <select class="form-select" id="select-x">
                <option value="">Seleziona variabile...</option>
                ${renderColumnOptions(state.selectedX)}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Asse Y1 Primario (Sinistra)</label>
              <select class="form-select" id="select-y1" multiple style="height: 70px;">
                ${renderMultipleColumnOptions(state.selectedY1)}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Asse Y2 Secondario (Destra 1)</label>
              <select class="form-select" id="select-y2" multiple style="height: 55px;">
                ${renderMultipleColumnOptions(state.selectedY2)}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Asse Y3 Terziario (Destra 2 con Offset)</label>
              <select class="form-select" id="select-y3" multiple style="height: 50px;">
                ${renderMultipleColumnOptions(state.selectedY3)}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Tipologia di Grafico Base</label>
              <select class="form-select" id="select-ctype">
                <option value="line" ${state.chartType === 'line' ? 'selected' : ''}>Linea Continua</option>
                <option value="scatter" ${state.chartType === 'scatter' ? 'selected' : ''}>Scatter (Punti)</option>
                <option value="bar" ${state.chartType === 'bar' ? 'selected' : ''}>Barre Verticali</option>
                <option value="area" ${state.chartType === 'area' ? 'selected' : ''}>Area Ombreggiata</option>
                <option value="box" ${state.chartType === 'box' ? 'selected' : ''}>Box Plot</option>
              </select>
            </div>
          </section>

          <!-- 3. Annotazioni Scientifiche -->
          <section class="sidebar-section">
            <div class="sidebar-title">Smart Scientific Annotations</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                <input type="checkbox" id="check-peaks" ${state.peakTracker ? 'checked' : ''} />
                <span style="color: #000000;"><strong>Peak & Valley Tracker</strong> (Max & Min)</span>
              </label>
              
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
                <span style="color: #000000;"><strong>Target / Comfort Band</strong></span>
              </label>

              <div id="comfort-inputs" style="display: ${state.comfortBand ? 'flex' : 'none'}; gap: 6px; margin-top: 4px;">
                <input type="number" class="form-input" id="comfort-min" value="${state.comfortMin}" style="width: 50%; font-size: 0.78rem;" placeholder="Min" />
                <input type="number" class="form-input" id="comfort-max" value="${state.comfortMax}" style="width: 50%; font-size: 0.78rem;" placeholder="Max" />
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
              <span class="cm-badge cm-badge-emerald">300/600 DPI Ready</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachEventListeners();
  if (state.currentTab === 'canvas') {
    updateChart();
  }
}

function renderColumnOptions(selected: string): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function renderMultipleColumnOptions(selectedArr: string[]): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${selectedArr.includes(c) ? 'selected' : ''}>${c}</option>`).join('');
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
  const tbody = state.dataset.rows.map(row => {
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

  document.getElementById('btn-goto-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
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

  // Config: Separator
  document.getElementById('cfg-separator')?.addEventListener('change', (e) => {
    state.separator = (e.target as HTMLSelectElement).value;
  });

  // Config: Decimal
  document.getElementById('cfg-decimal')?.addEventListener('change', (e) => {
    state.decimal = (e.target as HTMLSelectElement).value;
  });

  // Config: Re-Parse
  document.getElementById('btn-reparse')?.addEventListener('click', async () => {
    if (state.filePath) {
      await loadFile(state.filePath);
    }
  });

  // Config: Timestamp Checkbox
  document.getElementById('cfg-has-ts')?.addEventListener('change', (e) => {
    state.hasTimestamp = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('ts-config-panel');
    if (panel) panel.style.display = state.hasTimestamp ? 'block' : 'none';
  });

  // Config: Timestamp Column
  document.getElementById('cfg-ts-col')?.addEventListener('change', (e) => {
    state.timestampCol = (e.target as HTMLSelectElement).value;
    state.selectedX = state.timestampCol;
  });

  // Config: Timestamp Format
  document.getElementById('cfg-ts-format')?.addEventListener('input', (e) => {
    state.timestampFormat = (e.target as HTMLInputElement).value;
  });

  // Canvas Timeframe Pills
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

  // Canvas Date Inputs
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

  // Canvas Studio: Select X
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Select Y1
  document.getElementById('select-y1')?.addEventListener('change', (e) => {
    const opts = Array.from((e.target as HTMLSelectElement).selectedOptions);
    state.selectedY1 = opts.map(o => o.value);
    updateChart();
  });

  // Select Y2
  document.getElementById('select-y2')?.addEventListener('change', (e) => {
    const opts = Array.from((e.target as HTMLSelectElement).selectedOptions);
    state.selectedY2 = opts.map(o => o.value);
    updateChart();
  });

  // Select Y3
  document.getElementById('select-y3')?.addEventListener('change', (e) => {
    const opts = Array.from((e.target as HTMLSelectElement).selectedOptions);
    state.selectedY3 = opts.map(o => o.value);
    updateChart();
  });

  // Chart Type
  document.getElementById('select-ctype')?.addEventListener('change', (e) => {
    state.chartType = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Presets
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

  // Annotations
  document.getElementById('check-peaks')?.addEventListener('change', (e) => {
    state.peakTracker = (e.target as HTMLInputElement).checked;
    updateChart();
  });

  document.getElementById('check-comfort')?.addEventListener('change', (e) => {
    state.comfortBand = (e.target as HTMLInputElement).checked;
    const inputs = document.getElementById('comfort-inputs');
    if (inputs) inputs.style.display = state.comfortBand ? 'flex' : 'none';
    updateChart();
  });

  document.getElementById('comfort-min')?.addEventListener('input', (e) => {
    state.comfortMin = parseFloat((e.target as HTMLInputElement).value) || 0;
    updateChart();
  });

  document.getElementById('comfort-max')?.addEventListener('input', (e) => {
    state.comfortMax = parseFloat((e.target as HTMLInputElement).value) || 0;
    updateChart();
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    Plotly.downloadImage('plotly-chart', {
      format: 'svg',
      width: state.widthCm * 37.795,
      height: state.heightCm * 37.795,
      filename: `ChartMate_${state.preset}_figure`
    });
  });
}

function calculateTimeframeDates(mode: string) {
  if (!state.dataset || !state.timestampCol) return;
  const tsIdx = state.dataset.columns.indexOf(state.timestampCol);
  if (tsIdx === -1 || state.dataset.rows.length === 0) return;

  const firstVal = state.dataset.rows[0][tsIdx];
  const lastVal = state.dataset.rows[state.dataset.rows.length - 1][tsIdx];

  const firstDateStr = firstVal.split(' ')[0].replace(/\//g, '-');
  const lastDateStr = lastVal.split(' ')[0].replace(/\//g, '-');

  if (mode === 'all') {
    state.startDate = firstDateStr;
    state.endDate = lastDateStr;
  } else if (mode === 'day') {
    state.startDate = firstDateStr;
    state.endDate = firstDateStr;
  } else if (mode === 'week') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    d.setDate(d.getDate() + 7);
    state.endDate = d.toISOString().split('T')[0];
  } else if (mode === 'month') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    d.setMonth(d.getMonth() + 1);
    state.endDate = d.toISOString().split('T')[0];
  }
}

async function handleFileSelect() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Supported Datasets', extensions: ['csv', 'xlsx', 'xls', 'tsv', 'txt'] },
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

async function loadFile(path: string) {
  try {
    state.filePath = path;
    const options: ParseOptions = {
      separator: state.separator === 'auto' ? undefined : state.separator,
      decimal: state.decimal,
      timestamp_col: state.timestampCol || undefined,
      timestamp_format: state.timestampFormat || undefined,
      max_rows: 100
    };

    const preview = await invoke<DatasetPreview>('read_dataset_sample', { filePath: path, options });
    state.dataset = preview;

    // Automatic Metadata Assignment
    if (preview.suggested_ts_col) {
      state.timestampCol = preview.suggested_ts_col;
      state.selectedX = preview.suggested_ts_col;
      state.hasTimestamp = true;
    } else if (preview.columns.length > 0) {
      state.selectedX = preview.columns[0];
    }

    if (preview.suggested_ts_format) {
      state.timestampFormat = preview.suggested_ts_format;
    }

    // Assign initial Y1 trace
    if (preview.columns.length > 1 && state.selectedY1.length === 0) {
      state.selectedY1 = [preview.columns[1]];
    }

    // Default timeframe
    calculateTimeframeDates('all');

    renderApp();
  } catch (err) {
    alert(`Errore lettura file locale: ${err}`);
  }
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

  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    
    // Filter rows by Timeframe if Timestamp is active and dates are set
    let activeRows = state.dataset.rows;
    if (state.hasTimestamp && state.selectedX === state.timestampCol && (state.startDate || state.endDate)) {
      activeRows = state.dataset.rows.filter(r => {
        const val = r[xIdx]?.split(' ')[0]?.replace(/\//g, '-');
        if (!val) return true;
        if (state.startDate && val < state.startDate) return false;
        if (state.endDate && val > state.endDate) return false;
        return true;
      });
    }

    xVals = activeRows.map(r => r[xIdx]);

    const palette = ['#000000', '#059669', '#0284c7', '#d97706', '#7c3aed'];

    // Primary Y1 Traces
    state.selectedY1.forEach((col, idx) => {
      const yIdx = state.dataset!.columns.indexOf(col);
      const yVals = activeRows.map(r => {
        let val = r[yIdx];
        if (state.decimal === ',') val = val?.replace(',', '.');
        return parseFloat(val) || null;
      });

      traces.push({
        x: xVals,
        y: yVals,
        name: col,
        type: state.chartType === 'area' ? 'scatter' : state.chartType,
        fill: state.chartType === 'area' ? 'tozeroy' : undefined,
        mode: state.chartType === 'line' || state.chartType === 'area' ? 'lines' : 'markers',
        line: { color: palette[idx % palette.length], width: 2.0 },
        marker: { size: 5, color: palette[idx % palette.length] }
      });
    });

    // Secondary Y2 Traces
    state.selectedY2.forEach((col) => {
      const yIdx = state.dataset!.columns.indexOf(col);
      const yVals = activeRows.map(r => {
        let val = r[yIdx];
        if (state.decimal === ',') val = val?.replace(',', '.');
        return parseFloat(val) || null;
      });

      traces.push({
        x: xVals,
        y: yVals,
        name: `${col} (Y2)`,
        yaxis: 'y2',
        type: state.chartType === 'area' ? 'scatter' : state.chartType,
        mode: 'lines',
        line: { color: '#0284c7', width: 2, dash: 'dash' }
      });
    });

    // Tertiary Y3 Traces
    state.selectedY3.forEach((col) => {
      const yIdx = state.dataset!.columns.indexOf(col);
      const yVals = activeRows.map(r => {
        let val = r[yIdx];
        if (state.decimal === ',') val = val?.replace(',', '.');
        return parseFloat(val) || null;
      });

      traces.push({
        x: xVals,
        y: yVals,
        name: `${col} (Y3)`,
        yaxis: 'y3',
        type: state.chartType === 'area' ? 'scatter' : state.chartType,
        mode: 'lines',
        line: { color: '#d97706', width: 1.8, dash: 'dot' }
      });
    });
  } else {
    // Demo Waveform
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

  // Academic Journal-Ready Layout (Clean Black High-Contrast Standard)
  const hasY2 = state.selectedY2.length > 0;
  const hasY3 = state.selectedY3.length > 0;

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { 
      l: 65, 
      r: hasY3 ? 110 : (hasY2 ? 65 : 30), 
      t: 35, 
      b: 50 
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: 'Outfit, Arial, sans-serif', size: 11, color: '#000000' },
    xaxis: {
      title: { text: state.selectedX || 'Time / Parameter', font: { size: 12, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#000000' }
    },
    yaxis: {
      title: { text: state.selectedY1.join(', ') || 'Primary Y1', font: { size: 12, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#000000' }
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: 1.12,
      xanchor: 'center',
      font: { size: 10, color: '#000000' }
    },
    shapes: []
  };

  // Secondary Y2
  if (hasY2) {
    layout.yaxis2 = {
      title: { text: state.selectedY2.join(', '), font: { size: 11, color: '#0284c7', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      linecolor: '#0284c7',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#0284c7' }
    };
  }

  // Tertiary Y3 with Offset
  if (hasY3) {
    layout.yaxis3 = {
      title: { text: state.selectedY3.join(', '), font: { size: 11, color: '#d97706', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      position: 0.93,
      gridcolor: 'transparent',
      linecolor: '#d97706',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#d97706' }
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
      fillcolor: 'rgba(5, 150, 105, 0.12)',
      line: { width: 0 },
      layer: 'below'
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

// Boot application
renderApp();
