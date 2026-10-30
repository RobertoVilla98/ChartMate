import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { I18N, type Lang } from './i18n';
import {
  type CarpetPlotState,
  type ThermalComfortState,
  type ComfortKpiSummary,
  type DurationCurveState,
  type DurationKpiSummary,
  type CalibrationState,
  type CalibrationMetrics,
  type EditorialSuiteState,
  buildCarpetPlotFigure,
  buildThermalComfortFigure,
  buildDurationCurveFigure,
  buildCalibrationFigure,
  computeVariableStats,
  generatePublicationTableCode,
  buildCompositePlateFigure,
  fmtDec
} from './scientific_modules';

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

export interface TraceConfig {
  column: string;
  axis: 'y1' | 'y2' | 'y3' | 'y4';
  chartType: 'line' | 'scatter' | 'bar' | 'area';
  color: string;
  lineWidth: number;
  lineDash: 'solid' | 'dash' | 'dot';
}

export interface AxisScaleConfig {
  title: string;
  min?: number | null;
  max?: number | null;
  decimals: 'auto' | '0' | '1' | '2' | '3';
  majorStep?: number | null;
  minorStep?: number | null;
}

export interface GridFrameConfig {
  frameMode: 'open_l' | 'box' | 'ticks' | 'none';
  tickDir: 'outside' | 'inside' | 'none';
  showXGrid: boolean;
  showYGrid: boolean;
  showMinorGrid: boolean;
  showZeroLine: boolean;
  majorGridColor: string;
  minorGridColor: string;
}

interface CanvasConfig {
  name: string;
  selected_x: string;
  x_title?: string;
  traces: TraceConfig[];
  y1_title: string;
  y2_title: string;
  y3_title: string;
  y4_title: string;
  axis_scales?: Record<'y1' | 'y2' | 'y3' | 'y4', AxisScaleConfig>;
  grid_frame?: GridFrameConfig;
  legend_pos?: 'top' | 'right' | 'bottom' | 'inside' | 'none';
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

export interface MultiPlotPanelConfig {
  // Full multi-trace support per panel (backward compatible with legacy y1Col/y2Col)
  traces: TraceConfig[];
  yTitle: string;
  y2Title?: string;
  y1Min?: number | null;
  y1Max?: number | null;
  y1Decimals?: 'auto' | '0' | '1' | '2' | '3';
  y1MajorStep?: number | null;
  y1MinorStep?: number | null;
  // Legacy fields for backward compatibility when loading older projects.json
  y1Col?: string;
  y1Type?: 'line' | 'scatter' | 'bar' | 'area';
  y1Color?: string;
  y2Col?: string;
  y2Color?: string;
}

interface MultiPlotConfig {
  name: string;
  topology: '3x1' | '2x1' | '2x2' | '1x2' | 'custom';
  custom_rows?: number;
  custom_cols?: number;
  share_x: boolean;
  share_y?: boolean;
  auto_lettering: boolean;
  letter_pos?: 'outside_top' | 'outside_side' | 'inside';
  legend_mode?: 'per_panel' | 'global_top' | 'global_bottom' | 'none';
  macro_x_label?: string;
  macro_y_label?: string;
  grid_frame?: GridFrameConfig;
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
  decimals?: 'auto' | '0' | '1' | '2' | '3';
  cluster_enabled: boolean;
  cluster_grid_deg: number;
  cluster_agg: 'mean' | 'sum' | 'mode' | 'max' | 'min' | 'count';
  preset: 'single' | 'double' | 'square' | 'custom';
  width_cm: number;
  height_cm: number;
}

interface ProjectConfig {
  name: string;
  lang?: Lang;
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
  lang: Lang;
  currentTab: 'data' | 'canvas' | 'multi' | 'maps' | 'physics' | 'editorial';
  canvasSubTab: 'traces' | 'axes' | 'grid' | 'style';
  mpSubTab: 'layout' | 'panels' | 'axes' | 'style';
  sourceType: 'file' | 'sql';
  filePath: string | null;
  dataset: DatasetPreview | null;
  rawDatasetBackup: DatasetPreview | null;
  resampleInterval: '1m' | '5m' | '15m' | '30m' | '1h' | '1d';
  resampleAgg: 'mean' | 'median' | 'max' | 'min' | 'p95' | 'p5' | 'sum';
  isResampled: boolean;

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

  // Single Canvas Mapping & Axes
  selectedX: string;
  xTitle: string;
  traces: TraceConfig[];
  preset: 'single' | 'double' | 'square' | 'custom';
  widthCm: number;
  heightCm: number;

  // Axis Titles & Per-Axis Scale / Decimals / Grid Steps
  y1Title: string;
  y2Title: string;
  y3Title: string;
  y4Title: string;
  axisScales: Record<'y1' | 'y2' | 'y3' | 'y4', AxisScaleConfig>;

  // Chart Frame, Borders & Gridlines
  gridFrame: GridFrameConfig;
  legendPos: 'top' | 'right' | 'bottom' | 'inside' | 'none';

  // Global Studio Typography
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
  mpTopology: '3x1' | '2x1' | '2x2' | '1x2' | 'custom';
  mpCustomRows: number;
  mpCustomCols: number;
  mpActivePanelIdx: number;
  mpShareX: boolean;
  mpShareY: boolean;
  mpAutoLettering: boolean;
  mpLetterPos: 'outside_top' | 'outside_side' | 'inside';
  mpLegendMode: 'per_panel' | 'global_top' | 'global_bottom' | 'none';
  mpMacroX: string;
  mpMacroY: string;
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
  mapDecimals: 'auto' | '0' | '1' | '2' | '3';
  mapClusterEnabled: boolean;
  mapClusterGridDeg: number;
  mapClusterAgg: 'mean' | 'sum' | 'mode' | 'max' | 'min' | 'count';
  mapPreset: 'single' | 'double' | 'square' | 'custom';
  mapWidthCm: number;
  mapHeightCm: number;
  mapLastClusterCount: number;
  mapValidGpsCount: number;
  mapLastSummaryStat: string;

  // Tab 5: Building Physics & IEQ State (Tracks 1, 2, 3, 5)
  physicsMode: 'carpet' | 'comfort' | 'duration' | 'calib';
  carpetState: CarpetPlotState;
  comfortState: ThermalComfortState;
  comfortKpi: ComfortKpiSummary;
  durationState: DurationCurveState;
  durationKpi: DurationKpiSummary;
  calibState: CalibrationState;
  calibMetrics: CalibrationMetrics;

  // Tab 6: Editorial & LaTeX Suite State (Track 6)
  editorialState: EditorialSuiteState;
}

const DEFAULT_PALETTE = ['#000000', '#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48'];

function createDefaultPanels(count: number = 25): MultiPlotPanelConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    traces: [
      {
        column: '',
        axis: 'y1',
        chartType: i === 2 ? 'bar' : 'line',
        color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
        lineWidth: 1.9,
        lineDash: 'solid'
      }
    ],
    yTitle: `Panel (${String.fromCharCode(97 + i)})`,
    y2Title: '',
    y1Min: null,
    y1Max: null,
    y1Decimals: 'auto',
    y1MajorStep: null,
    y1MinorStep: null
  }));
}

const state: AppState = {
  lang: 'en', // English by default as requested
  currentTab: 'data',
  canvasSubTab: 'traces',
  mpSubTab: 'layout',
  sourceType: 'file',
  filePath: null,
  dataset: null,
  rawDatasetBackup: null,
  resampleInterval: '1h',
  resampleAgg: 'mean',
  isResampled: false,
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
  activeMap: 'Map_1',
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
  xTitle: '',
  traces: [],
  preset: 'double',
  widthCm: 17.0,
  heightCm: 9.5,
  y1Title: '',
  y2Title: '',
  y3Title: '',
  y4Title: '',
  axisScales: {
    y1: { title: '', min: null, max: null, decimals: 'auto', majorStep: null, minorStep: null },
    y2: { title: '', min: null, max: null, decimals: 'auto', majorStep: null, minorStep: null },
    y3: { title: '', min: null, max: null, decimals: 'auto', majorStep: null, minorStep: null },
    y4: { title: '', min: null, max: null, decimals: 'auto', majorStep: null, minorStep: null }
  },
  gridFrame: {
    frameMode: 'open_l',
    tickDir: 'outside',
    showXGrid: true,
    showYGrid: true,
    showMinorGrid: false,
    showZeroLine: false,
    majorGridColor: '#cbd5e1',
    minorGridColor: '#f1f5f9'
  },
  legendPos: 'top',
  fontFamily: 'Outfit, sans-serif',
  fontSize: 11,
  peakMode: 'none',
  comfortBand: false,
  comfortSeason: 'winter',
  comfortMin: 20.0,
  comfortMax: 22.0,
  comfortColor: 'rgba(5, 150, 105, 0.12)',
  mpTopology: '3x1',
  mpCustomRows: 2,
  mpCustomCols: 2,
  mpActivePanelIdx: 0,
  mpShareX: true,
  mpShareY: false,
  mpAutoLettering: true,
  mpLetterPos: 'outside_top',
  mpLegendMode: 'per_panel',
  mpMacroX: '',
  mpMacroY: '',
  mpPreset: 'double_stack',
  mpWidthCm: 17.0,
  mpHeightCm: 13.5,
  mpPanels: createDefaultPanels(25),
  mapMode: 'bubble',
  mapBasemap: 'carto-positron',
  mapColorCol: '',
  mapSizeCol: '',
  mapColorscale: 'Viridis',
  mapDecimals: '1',
  mapClusterEnabled: false,
  mapClusterGridDeg: 0.002,
  mapClusterAgg: 'mean',
  mapPreset: 'double',
  mapWidthCm: 17.0,
  mapHeightCm: 10.5,
  mapLastClusterCount: 0,
  mapValidGpsCount: 0,
  mapLastSummaryStat: '',
  physicsMode: 'carpet',
  carpetState: {
    variableCol: 'indoor_temp',
    aggMethod: 'mean',
    colorscale: 'Thermal',
    showContours: false,
    contourStep: 1.0,
    dayFilter: 'all',
    zMin: null,
    zMax: null,
    decimals: '1'
  },
  comfortState: {
    normMode: 'en16798',
    indoorTempCol: 'indoor_temp',
    outdoorTempCol: 'outdoor_temp',
    rhCol: 'rh',
    computeRunningMean: true,
    alpha: 0.8
  },
  comfortKpi: {
    totalHours: 0,
    cat1Hours: 0,
    cat1Pct: 0,
    cat2Hours: 0,
    cat2Pct: 0,
    cat3Hours: 0,
    cat3Pct: 0,
    overheatHours: 0,
    overheatPct: 0,
    undercoolHours: 0,
    undercoolPct: 0
  },
  durationState: {
    variableCol: 'indoor_temp',
    compareCol: 'sim_indoor_temp',
    xMode: 'hours',
    dtHours: 1.0,
    threshold1: 25.0,
    threshold2: 26.0,
    shadeExceedance: true,
    decimals: '1'
  },
  durationKpi: {
    totalHours: 0,
    exc1Hours: 0,
    exc1Pct: 0,
    exc2Hours: 0,
    exc2Pct: 0,
    exposureIntegral: 0,
    peakVal: 0,
    p95Val: 0,
    medianVal: 0,
    meanVal: 0
  },
  calibState: {
    measuredCol: 'indoor_temp',
    simulatedCol: 'sim_indoor_temp',
    viewMode: 'series',
    standard: 'hourly',
    showBoxOnChart: true,
    decimals: '2'
  },
  calibMetrics: {
    n: 0,
    meanMeasured: 0,
    meanSimulated: 0,
    nmbePct: 0,
    cvRmsePct: 0,
    rmse: 0,
    mae: 0,
    rSquared: 0,
    hourlyPass: true,
    monthlyPass: true
  },
  editorialState: {
    caption: 'Descriptive statistics, hygrothermal performance, and IEQ threshold exceedance summary.',
    latexLabel: 'tab:ieq_summary',
    outputFormat: 'latex',
    decimals: '2',
    dtHours: 1.0,
    variables: [],
    plateWidthPreset: 'double_170mm',
    plateDpi: 600,
    plateGrid: '2x2',
    plateSlots: ['indoor_temp', 'rh', 'co2_ppm', 'power_kw']
  }
};

function t(key: string): string {
  return I18N[state.lang]?.[key] || I18N.en[key] || key;
}

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

function getMultiPlotDimensions(): { rows: number; cols: number; count: number } {
  if (state.mpTopology === '3x1') return { rows: 3, cols: 1, count: 3 };
  if (state.mpTopology === '2x1') return { rows: 2, cols: 1, count: 2 };
  if (state.mpTopology === '2x2') return { rows: 2, cols: 2, count: 4 };
  if (state.mpTopology === '1x2') return { rows: 1, cols: 2, count: 2 };
  const r = Math.max(1, Math.min(5, state.mpCustomRows || 2));
  const c = Math.max(1, Math.min(5, state.mpCustomCols || 2));
  return { rows: r, cols: c, count: r * c };
}

function getPanelLetter(idx: number): string {
  return `(${String.fromCharCode(97 + idx)})`;
}

function ensurePanelNormalized(idx: number): MultiPlotPanelConfig {
  while (state.mpPanels.length <= idx) {
    state.mpPanels.push({
      traces: [{ column: '', axis: 'y1', chartType: 'line', color: DEFAULT_PALETTE[state.mpPanels.length % DEFAULT_PALETTE.length], lineWidth: 1.9, lineDash: 'solid' }],
      yTitle: `Panel ${getPanelLetter(state.mpPanels.length)}`,
      y2Title: '',
      y1Min: null,
      y1Max: null,
      y1Decimals: 'auto',
      y1MajorStep: null,
      y1MinorStep: null
    });
  }
  const p = state.mpPanels[idx];
  if (!p.traces || !Array.isArray(p.traces)) {
    p.traces = [];
    if (p.y1Col) {
      p.traces.push({
        column: p.y1Col,
        axis: 'y1',
        chartType: p.y1Type || 'line',
        color: p.y1Color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
        lineWidth: 1.9,
        lineDash: 'solid'
      });
    }
    if (p.y2Col) {
      p.traces.push({
        column: p.y2Col,
        axis: 'y2',
        chartType: 'line',
        color: p.y2Color || '#0284c7',
        lineWidth: 1.7,
        lineDash: 'dash'
      });
    }
  }
  return p;
}

function renderApp() {
  const mpDims = getMultiPlotDimensions();
  if (state.mpActivePanelIdx >= mpDims.count) {
    state.mpActivePanelIdx = 0;
  }

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
        <button class="nav-btn ${state.currentTab === 'data' ? 'active' : ''}" id="tab-nav-data">${t('nav_tab1')}</button>
        <button class="nav-btn ${state.currentTab === 'canvas' ? 'active' : ''}" id="tab-nav-canvas">${t('nav_tab2')}</button>
        <button class="nav-btn ${state.currentTab === 'multi' ? 'active' : ''}" id="tab-nav-multi">${t('nav_tab3')}</button>
        <button class="nav-btn ${state.currentTab === 'maps' ? 'active' : ''}" id="tab-nav-maps">${t('nav_tab4')}</button>
        <button class="nav-btn ${state.currentTab === 'physics' ? 'active' : ''}" id="tab-nav-physics">${t('nav_tab5')}</button>
        <button class="nav-btn ${state.currentTab === 'editorial' ? 'active' : ''}" id="tab-nav-editorial">${t('nav_tab6')}</button>
      </nav>
      <div style="display: flex; align-items: center;">
        <!-- Language Toggle (EN Default | IT) -->
        <div class="lang-switch" title="Switch Interface Language (English / Italiano)">
          <button class="lang-btn ${state.lang === 'en' ? 'active' : ''}" id="btn-lang-en">EN</button>
          <button class="lang-btn ${state.lang === 'it' ? 'active' : ''}" id="btn-lang-it">IT</button>
        </div>
        <button class="btn btn-primary" id="btn-export">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          ${state.currentTab === 'maps' ? t('btn_export_png') : t('btn_export_svg')}
        </button>
      </div>
    </header>

    <div class="main-container">
      <!-- VIEW 1: DATA INGESTION -->
      <div class="view-panel ${state.currentTab === 'data' ? 'active' : ''}" id="view-data">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('proj_title')}</span>
              ${state.activeProject ? `
                <span class="cm-badge cm-badge-emerald">${t('proj_active')}: ${state.activeProject}</span>
              ` : `
                <span class="cm-badge cm-badge-sky">${t('proj_new_badge')}</span>
              `}
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">${t('proj_load_label')}</label>
              <select class="form-select" id="sel-load-project" style="font-size: 0.8rem;">
                <option value="">${t('proj_select_placeholder')}</option>
                ${Object.keys(state.projectsStore).map(p => `
                  <option value="${p}" ${p === state.activeProject ? 'selected' : ''}>
                    📁 ${p} (${Object.keys(state.projectsStore[p].canvases || {}).length} ${t('proj_charts_count')})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">${t('proj_name_label')}</label>
              <input type="text" class="form-input" id="inp-project-name" value="${state.activeProject}" placeholder="${t('proj_name_placeholder')}" style="font-size: 0.82rem;" />
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary" id="btn-save-project" style="flex: 1; font-size: 0.76rem; padding: 5px 8px;">
                ${t('btn_save_proj')}
              </button>
              ${state.activeProject ? `
                <button class="btn btn-secondary" id="btn-new-project" style="font-size: 0.76rem; padding: 5px 8px;">
                  ${t('btn_new_proj')}
                </button>
                <button class="btn btn-secondary" id="btn-delete-project" style="font-size: 0.76rem; padding: 5px 8px; color: var(--rose);">
                  ${t('btn_del_proj')}
                </button>
              ` : ''}
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('src_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.sourceType === 'sql' ? 'MySQL DB' : 'Direct I/O'}</span>
            </div>

            <div class="source-toggle-group">
              <button class="source-toggle-btn ${state.sourceType === 'file' ? 'active' : ''}" id="btn-src-file">
                ${t('src_file_btn')}
              </button>
              <button class="source-toggle-btn ${state.sourceType === 'sql' ? 'active' : ''}" id="btn-src-sql">
                ${t('src_sql_btn')}
              </button>
            </div>

            ${state.sourceType === 'file' ? `
              <div class="dropzone" id="dropzone-data">
                <div class="dropzone-icon">📂</div>
                <div style="font-weight: 600; font-size: 0.88rem; color: #000000;">${t('dropzone_main')}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">${t('dropzone_sub')}</div>
              </div>
              ${state.filePath ? `
                <div class="file-path-display">${state.filePath}</div>
                <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 0.75rem;">
                  <span>${t('total_rows')}: <strong>${state.dataset?.total_rows || 0}</strong></span>
                  <span class="cm-badge cm-badge-sky">${state.dataset?.detected_sep || 'Auto'}</span>
                </div>
              ` : ''}
            ` : `
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div class="form-row">
                  <div class="form-group" style="flex: 2;">
                    <label class="form-label">${t('sql_host')}</label>
                    <input type="text" class="form-input" id="sql-host" value="${state.sqlConfig.host}" placeholder="localhost" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_port')}</label>
                    <input type="number" class="form-input" id="sql-port" value="${state.sqlConfig.port}" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_db')}</label>
                    <input type="text" class="form-input" id="sql-db" value="${state.sqlConfig.database}" placeholder="building_db" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_user')}</label>
                    <input type="text" class="form-input" id="sql-user" value="${state.sqlConfig.user}" placeholder="root" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">${t('sql_pass')}</label>
                  <input type="password" class="form-input" id="sql-pass" value="${state.sqlConfig.password || ''}" placeholder="••••••••" />
                </div>

                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                  <button class="btn btn-secondary" id="btn-sql-test" style="flex: 1; font-size: 0.76rem;">
                    ${t('btn_sql_test')}
                  </button>
                  ${state.sqlStatus ? `
                    <span class="cm-badge ${state.sqlStatus.connected ? 'cm-badge-emerald' : 'cm-badge-rose'}">
                      ${state.sqlStatus.connected ? `✓ ${state.sqlStatus.latency_ms}ms` : '✕ Error'}
                    </span>
                  ` : ''}
                </div>

                ${state.sqlStatus?.tables && state.sqlStatus.tables.length > 0 ? `
                  <div class="form-group">
                    <label class="form-label">${t('sql_tables_label')}</label>
                    <select class="form-select" id="sql-table-select">
                      <option value="">${t('sql_tables_placeholder')}</option>
                      ${state.sqlStatus.tables.map(tbl => `<option value="${tbl}">📋 ${tbl}</option>`).join('')}
                    </select>
                  </div>
                ` : ''}

                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label">${t('sql_query_label')}</label>
                  <textarea class="sql-editor" id="sql-query-input">${state.sqlQuery}</textarea>
                </div>

                <button class="btn btn-primary" id="btn-sql-exec" style="width: 100%; font-size: 0.78rem;">
                  ${t('btn_sql_exec')}
                </button>
              </div>
            `}
          </section>

          ${state.sourceType === 'file' ? `
            <section class="sidebar-section">
              <div class="sidebar-title">${t('delim_title')}</div>
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('sep_label')}</label>
                  <select class="form-select" id="cfg-separator">
                    <option value="auto" ${state.separator === 'auto' ? 'selected' : ''}>${t('sep_auto')}</option>
                    <option value="," ${state.separator === ',' ? 'selected' : ''}>${t('sep_comma')}</option>
                    <option value=";" ${state.separator === ';' ? 'selected' : ''}>${t('sep_semi')}</option>
                    <option value="\t" ${state.separator === '\t' ? 'selected' : ''}>${t('sep_tab')}</option>
                    <option value="|" ${state.separator === '|' ? 'selected' : ''}>${t('sep_pipe')}</option>
                  </select>
                </div>

                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('dec_label')}</label>
                  <select class="form-select" id="cfg-decimal">
                    <option value="." ${state.decimal === '.' ? 'selected' : ''}>${t('dec_dot')}</option>
                    <option value="," ${state.decimal === ',' ? 'selected' : ''}>${t('dec_comma')}</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-secondary" id="btn-reparse" style="width: 100%; margin-top: 2px;">
                ${t('btn_reparse')}
              </button>
            </section>
          ` : ''}

          <section class="sidebar-section">
            <div class="sidebar-title">${t('ts_title')}</div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="cfg-has-ts" ${state.hasTimestamp ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">${t('ts_has_col')}</span>
            </label>

            <div id="ts-config-panel" style="display: ${state.hasTimestamp ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label">${t('ts_col_label')}</label>
                <select class="form-select" id="cfg-ts-col">
                  <option value="">${t('ts_col_placeholder')}</option>
                  ${renderColumnOptions(state.timestampCol)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">${t('ts_fmt_label')}</label>
                <input type="text" class="form-input" id="cfg-ts-format" value="${state.timestampFormat}" placeholder="%Y-%m-%d %H:%M:%S" />
              </div>
            </div>
          </section>

          <!-- TRACK 4: RUST HIGH-SPEED RESAMPLING & SMOOTHING ENGINE -->
          <section class="sidebar-section" style="background: #f0fdf4; border-left: 3px solid var(--primary);">
            <div class="sidebar-title">
              <span>${t('resample_title')}</span>
              <span class="cm-badge ${state.isResampled ? 'cm-badge-amber' : 'cm-badge-emerald'}">
                ${state.isResampled ? `${t('resample_active_badge')} (${state.resampleInterval})` : t('resample_raw_badge')}
              </span>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('resample_interval_label')}</label>
                <select class="form-select" id="sel-resample-interval">
                  <option value="1m" ${state.resampleInterval === '1m' ? 'selected' : ''}>1 min (1m)</option>
                  <option value="5m" ${state.resampleInterval === '5m' ? 'selected' : ''}>5 min (5m)</option>
                  <option value="15m" ${state.resampleInterval === '15m' ? 'selected' : ''}>15 min (15m)</option>
                  <option value="30m" ${state.resampleInterval === '30m' ? 'selected' : ''}>30 min (30m)</option>
                  <option value="1h" ${state.resampleInterval === '1h' ? 'selected' : ''}>1 hour (1h)</option>
                  <option value="1d" ${state.resampleInterval === '1d' ? 'selected' : ''}>1 day (24h)</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1.3;">
                <label class="form-label">${t('resample_agg_label')}</label>
                <select class="form-select" id="sel-resample-agg">
                  <option value="mean" ${state.resampleAgg === 'mean' ? 'selected' : ''}>${t('resample_agg_mean')}</option>
                  <option value="median" ${state.resampleAgg === 'median' ? 'selected' : ''}>${t('resample_agg_median')}</option>
                  <option value="max" ${state.resampleAgg === 'max' ? 'selected' : ''}>${t('resample_agg_max')}</option>
                  <option value="min" ${state.resampleAgg === 'min' ? 'selected' : ''}>${t('resample_agg_min')}</option>
                  <option value="p95" ${state.resampleAgg === 'p95' ? 'selected' : ''}>${t('resample_agg_p95')}</option>
                  <option value="p5" ${state.resampleAgg === 'p5' ? 'selected' : ''}>${t('resample_agg_p5')}</option>
                  <option value="sum" ${state.resampleAgg === 'sum' ? 'selected' : ''}>${t('resample_agg_sum')}</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary" id="btn-resample-apply" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_resample_apply')}
              </button>
              ${state.isResampled ? `
                <button class="btn btn-secondary" id="btn-resample-reset" style="font-size: 0.75rem;">
                  ${t('btn_resample_reset')}
                </button>
              ` : ''}
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('geo_title')}</span>
              <span class="cm-badge cm-badge-sky">GIS Ready</span>
            </div>
            <div class="form-group">
              <label class="form-label">${t('geo_fmt_label')}</label>
              <select class="form-select" id="cfg-geo-format">
                <option value="decimal_degrees" ${state.geoCoordFormat === 'decimal_degrees' ? 'selected' : ''}>${t('geo_fmt_dd')}</option>
                <option value="dms" ${state.geoCoordFormat === 'dms' ? 'selected' : ''}>${t('geo_fmt_dms')}</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('geo_lat_label')}</label>
                <select class="form-select" id="cfg-geo-lat">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('geo_lon_label')}</label>
                <select class="form-select" id="cfg-geo-lon">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-primary" id="btn-goto-canvas" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_goto_canvas')}
              </button>
              <button class="btn btn-secondary" id="btn-goto-maps" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_goto_maps')}
              </button>
            </div>
          </section>
        </aside>

        <main class="data-ingestion-view">
          <div class="data-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 1.1rem; font-weight: 700; color: #000000;">${t('preview_title')}</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  ${t('preview_sub')}
                </div>
              </div>
              <div>
                ${state.dataset ? `
                  <span class="cm-badge cm-badge-emerald" style="font-size: 0.8rem; padding: 4px 8px;">
                    ✓ ${state.dataset.columns.length} ${t('preview_cols')} · ${state.dataset.total_rows} ${t('preview_rows')}
                  </span>
                ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">${t('no_dataset_title')}</span>`}
              </div>
            </div>
            <div class="table-preview-scroll">
              ${renderPreviewTable()}
            </div>
          </div>
        </main>
      </div>

      <!-- VIEW 2: SINGLE CANVAS STUDIO (WITH PROGRESSIVE SUB-TABS) -->
      <div class="view-panel ${state.currentTab === 'canvas' ? 'active' : ''}" id="view-canvas">
        <aside class="sidebar">
          <!-- Saved Canvases Header -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div class="sidebar-title">
              <span>${t('canvas_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeCanvas || 'Canvas_1'}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-canvas" style="flex: 1; font-size: 0.8rem; font-weight: 600; padding: 4px 8px;">
                ${renderCanvasSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-canvas" style="font-size: 0.75rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-canvas" style="flex: 1; font-size: 0.73rem; padding: 3px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-canvas" style="font-size: 0.73rem; padding: 3px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>
          </section>

          <!-- Progressive Step-by-Step Sub-Tabs Bar -->
          <div class="subtab-bar">
            <button class="subtab-btn ${state.canvasSubTab === 'traces' ? 'active' : ''}" data-csub="traces">${t('sub_traces')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'axes' ? 'active' : ''}" data-csub="axes">${t('sub_axes')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'grid' ? 'active' : ''}" data-csub="grid">${t('sub_grid')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'style' ? 'active' : ''}" data-csub="style">${t('sub_style')}</button>
          </div>

          ${renderSingleCanvasSubTabContent()}
        </aside>

        <!-- Single Canvas Display Area -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">${t('preset_single')}</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">${t('preset_double')}</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem;">
              <span>${t('dim_label')}</span>
              <input type="number" step="0.5" min="5" max="40" id="inp-canvas-w" value="${state.widthCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" title="Width (cm)" />
              <span>×</span>
              <input type="number" step="0.5" min="4" max="40" id="inp-canvas-h" value="${state.heightCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" title="Height (cm)" />
              <span>cm</span>
              <span class="cm-badge cm-badge-emerald">Vector 600 DPI</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 3: MULTIPLOT GRID STUDIO (WITH PROGRESSIVE SUB-TABS & PARALLEL CANVASES) -->
      <div class="view-panel ${state.currentTab === 'multi' ? 'active' : ''}" id="view-multi">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div class="sidebar-title">
              <span>${t('mp_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMultiPlot || 'MultiPlot_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-multiplot" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMultiPlotSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-multiplot" style="font-size: 0.75rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-multiplot" style="flex: 1; font-size: 0.73rem; padding: 3px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-multiplot" style="font-size: 0.73rem; padding: 3px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>
          </section>

          <!-- MultiPlot Step-by-Step Sub-Tabs Bar -->
          <div class="subtab-bar">
            <button class="subtab-btn ${state.mpSubTab === 'layout' ? 'active' : ''}" data-mpsub="layout">${t('sub_mp_layout')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'panels' ? 'active' : ''}" data-mpsub="panels">${t('sub_mp_panels')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'axes' ? 'active' : ''}" data-mpsub="axes">${t('sub_mp_axes')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'style' ? 'active' : ''}" data-mpsub="style">${t('sub_mp_style')}</button>
          </div>

          ${renderMultiPlotSubTabContent()}
        </aside>

        <!-- MultiPlot Viewport -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'single_stack' ? 'active' : ''}" data-mppreset="single_stack">${t('preset_single')}</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'double_stack' ? 'active' : ''}" data-mppreset="double_stack">${t('preset_double')}</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'square_grid' ? 'active' : ''}" data-mppreset="square_grid">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem;">
              <span>${t('dim_label')}</span>
              <input type="number" step="0.5" min="6" max="50" id="inp-mp-w" value="${state.mpWidthCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" />
              <span>×</span>
              <input type="number" step="0.5" min="6" max="50" id="inp-mp-h" value="${state.mpHeightCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" />
              <span>cm</span>
              <span class="cm-badge cm-badge-emerald">${mpDims.rows}×${mpDims.cols} Grid</span>
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
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('map_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMap || 'Map_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-map" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMapSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-map" style="font-size: 0.76rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              <button class="btn btn-secondary" id="btn-new-map" style="flex: 1; font-size: 0.74rem; padding: 4px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-map" style="font-size: 0.74rem; padding: 4px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>

            <!-- Direct Dataset Loader & Status inside Tab 4 -->
            <button class="btn btn-secondary" id="btn-map-load-file" style="width: 100%; font-size: 0.76rem; border-style: dashed;">
              ${t('map_load_data_btn')}
            </button>
            ${state.dataset ? `
              <div style="margin-top: 6px; font-size: 0.72rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${state.filePath || 'Dataset'}</span>
                <span class="cm-badge ${state.geoLatCol && state.geoLonCol ? 'cm-badge-emerald' : 'cm-badge-amber'}">
                  ${state.geoLatCol && state.geoLonCol ? `✓ GPS (${state.geoLatCol}, ${state.geoLonCol})` : '⚠ Select Lat/Lon'}
                </span>
              </div>
            ` : ''}
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('map_mode_title')}</span>
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

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">${t('map_basemap_label')}</label>
              <select class="form-select" id="map-basemap">
                <option value="carto-positron" ${state.mapBasemap === 'carto-positron' ? 'selected' : ''}>🏙️ CartoDB Positron (Light Paper)</option>
                <option value="esri-satellite" ${state.mapBasemap === 'esri-satellite' ? 'selected' : ''}>🛰️ ESRI World Imagery Satellite</option>
                <option value="open-street-map" ${state.mapBasemap === 'open-street-map' ? 'selected' : ''}>🗺️ OpenStreetMap (Road & Urban)</option>
                <option value="carto-darkmatter" ${state.mapBasemap === 'carto-darkmatter' ? 'selected' : ''}>🌑 CartoDB Dark Matter</option>
                <option value="opentopomap" ${state.mapBasemap === 'opentopomap' ? 'selected' : ''}>🏔️ OpenTopoMap (Topographic)</option>
              </select>
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">${t('map_coords_title')}</div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_lat_label')}</label>
                <select class="form-select" id="map-lat-col">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_lon_label')}</label>
                <select class="form-select" id="map-lon-col">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_color_label')}</label>
                <select class="form-select" id="map-color-col">
                  <option value="">${t('map_uniform_opt')}</option>
                  ${renderColumnOptions(state.mapColorCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_size_label')}</label>
                <select class="form-select" id="map-size-col">
                  <option value="">${t('map_fixed_opt')}</option>
                  ${renderColumnOptions(state.mapSizeCol)}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 2; margin-bottom: 0;">
                <label class="form-label">${t('map_colorscale_label')}</label>
                <select class="form-select" id="map-colorscale">
                  <option value="Viridis" ${state.mapColorscale === 'Viridis' ? 'selected' : ''}>Viridis</option>
                  <option value="Plasma" ${state.mapColorscale === 'Plasma' ? 'selected' : ''}>Plasma</option>
                  <option value="RdBu" ${state.mapColorscale === 'RdBu' ? 'selected' : ''}>RdBu (Blue-Red)</option>
                  <option value="YlOrRd" ${state.mapColorscale === 'YlOrRd' ? 'selected' : ''}>YlOrRd (Heat)</option>
                  <option value="Emerald" ${state.mapColorscale === 'Emerald' ? 'selected' : ''}>Emerald</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label class="form-label">${t('map_decimals_label')}</label>
                <select class="form-select" id="map-decimals">
                  <option value="auto" ${state.mapDecimals === 'auto' ? 'selected' : ''}>${t('dec_auto')}</option>
                  <option value="0" ${state.mapDecimals === '0' ? 'selected' : ''}>0</option>
                  <option value="1" ${state.mapDecimals === '1' ? 'selected' : ''}>1</option>
                  <option value="2" ${state.mapDecimals === '2' ? 'selected' : ''}>2</option>
                  <option value="3" ${state.mapDecimals === '3' ? 'selected' : ''}>3</option>
                </select>
              </div>
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('map_cluster_title')}</span>
              <span class="cm-badge cm-badge-amber">Geo-Stats</span>
            </div>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="map-cluster-toggle" ${state.mapClusterEnabled ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">${t('map_cluster_enable')}</span>
            </label>

            <div id="map-cluster-panel" style="display: ${state.mapClusterEnabled ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
              <div class="form-group">
                <label class="form-label">${t('map_cluster_op_label')}</label>
                <select class="form-select" id="map-cluster-agg">
                  <option value="mean" ${state.mapClusterAgg === 'mean' ? 'selected' : ''}>${t('map_op_mean')}</option>
                  <option value="sum" ${state.mapClusterAgg === 'sum' ? 'selected' : ''}>${t('map_op_sum')}</option>
                  <option value="mode" ${state.mapClusterAgg === 'mode' ? 'selected' : ''}>${t('map_op_mode')}</option>
                  <option value="max" ${state.mapClusterAgg === 'max' ? 'selected' : ''}>${t('map_op_max')}</option>
                  <option value="min" ${state.mapClusterAgg === 'min' ? 'selected' : ''}>${t('map_op_min')}</option>
                  <option value="count" ${state.mapClusterAgg === 'count' ? 'selected' : ''}>${t('map_op_count')}</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 4px;">
                <label class="form-label">${t('map_grid_label')}</label>
                <select class="form-select" id="map-cluster-grid">
                  <option value="0.0005" ${state.mapClusterGridDeg === 0.0005 ? 'selected' : ''}>0.0005° (~50m - Building)</option>
                  <option value="0.002" ${state.mapClusterGridDeg === 0.002 ? 'selected' : ''}>0.002° (~200m - Block / Campus)</option>
                  <option value="0.005" ${state.mapClusterGridDeg === 0.005 ? 'selected' : ''}>0.005° (~500m - Neighborhood)</option>
                  <option value="0.02" ${state.mapClusterGridDeg === 0.02 ? 'selected' : ''}>0.02° (~2km - Urban District)</option>
                  <option value="0.1" ${state.mapClusterGridDeg === 0.1 ? 'selected' : ''}>0.10° (~10km - Regional)</option>
                </select>
              </div>
            </div>

            <div class="cluster-stats-banner" id="map-cluster-banner">
              <span>${state.mapClusterEnabled ? t('map_active_clusters') : t('map_valid_pts')} <strong id="lbl-cluster-count">${state.mapClusterEnabled ? state.mapLastClusterCount : state.mapValidGpsCount}</strong></span>
              <span class="cm-badge cm-badge-emerald" id="lbl-cluster-stat">${state.mapLastSummaryStat || 'Ready'}</span>
            </div>
          </section>
        </aside>

        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'single' ? 'active' : ''}" data-mappreset="single">${t('preset_single')}</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'double' ? 'active' : ''}" data-mappreset="double">${t('preset_double')}</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'square' ? 'active' : ''}" data-mappreset="square">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>${t('dim_label')} <strong style="color: #000000;">${state.mapWidthCm} × ${state.mapHeightCm} cm</strong></span>
              <span class="cm-badge cm-badge-sky">▲ North · Auto-BBox</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-map-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 5: BUILDING PHYSICS & IEQ STUDIO (TRACKS 1, 2, 3, 5) -->
      <div class="view-panel ${state.currentTab === 'physics' ? 'active' : ''}" id="view-physics">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('phys_mode_title')}</span>
              <span class="cm-badge cm-badge-emerald">EN / ASHRAE</span>
            </div>
            <div class="physics-mode-grid">
              <button class="physics-mode-btn ${state.physicsMode === 'carpet' ? 'active' : ''}" data-physmode="carpet">
                <span>${t('phys_mode_carpet')}</span>
                <span class="cm-badge cm-badge-sky">Track 1</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'comfort' ? 'active' : ''}" data-physmode="comfort">
                <span>${t('phys_mode_comfort')}</span>
                <span class="cm-badge cm-badge-emerald">Track 2</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'duration' ? 'active' : ''}" data-physmode="duration">
                <span>${t('phys_mode_duration')}</span>
                <span class="cm-badge cm-badge-amber">Track 3</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'calib' ? 'active' : ''}" data-physmode="calib">
                <span>${t('phys_mode_calib')}</span>
                <span class="cm-badge cm-badge-sky">Track 5</span>
              </button>
            </div>
          </section>

          ${renderPhysicsSidebarContent()}
        </aside>

        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">${t('preset_single')}</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">${t('preset_double')}</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">${t('preset_square')}</button>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.78rem;">
              <span>${t('dim_label')} <strong>${state.widthCm} × ${state.heightCm} cm</strong></span>
              <span class="cm-badge cm-badge-emerald">600 DPI Journal Ready</span>
            </div>
          </div>

          <div class="physics-kpi-bar" id="physics-kpi-banner">
            ${renderPhysicsKpiBar()}
          </div>

          <div class="chart-viewport">
            <div id="plotly-physics-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 6: EDITORIAL & LATEX SUITE (TRACK 6) -->
      <div class="view-panel ${state.currentTab === 'editorial' ? 'active' : ''}" id="view-editorial">
        ${renderEditorialView()}
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
  } else if (state.currentTab === 'physics') {
    updatePhysicsChart();
  } else if (state.currentTab === 'editorial') {
    updateEditorialSuite();
  }
}

function renderSingleCanvasSubTabContent(): string {
  if (state.canvasSubTab === 'traces') {
    return `
      ${state.hasTimestamp ? `
        <section class="sidebar-section">
          <div class="sidebar-title">
            <span>${t('tf_title')}</span>
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
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('tf_start')}</label>
              <input type="date" class="form-input" id="canvas-start-date" value="${state.startDate}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('tf_end')}</label>
              <input type="date" class="form-input" id="canvas-end-date" value="${state.endDate}" />
            </div>
          </div>
        </section>
      ` : ''}

      <section class="sidebar-section">
        <div class="sidebar-title">${t('x_axis_title')}</div>
        <div class="form-group" style="margin-bottom: 0;">
          <select class="form-select" id="select-x">
            <option value="">${t('x_axis_placeholder')}</option>
            ${renderColumnOptions(state.selectedX)}
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('traces_title')}</span>
          <span class="cm-badge cm-badge-emerald">${state.traces.length} ${t('active_badge')}</span>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
          <select class="form-select" id="sel-new-trace-col" style="flex: 1; font-size: 0.8rem; padding: 4px 8px;">
            ${renderAddColumnOptions()}
          </select>
          <button class="btn btn-primary" id="btn-add-trace" style="font-size: 0.78rem; padding: 4px 10px; white-space: nowrap;">
            ${t('btn_add_series')}
          </button>
        </div>
        <div id="traces-list-container">
          ${renderTraceCards()}
        </div>
      </section>
    `;
  }

  if (state.canvasSubTab === 'axes') {
    const activeAxes: ('y1' | 'y2' | 'y3' | 'y4')[] = ['y1'];
    if (state.traces.some(tr => tr.axis === 'y2')) activeAxes.push('y2');
    if (state.traces.some(tr => tr.axis === 'y3')) activeAxes.push('y3');
    if (state.traces.some(tr => tr.axis === 'y4')) activeAxes.push('y4');

    const axisLabels: Record<string, string> = {
      y1: t('axis_left_y1'),
      y2: t('axis_right_y2'),
      y3: t('axis_right_y3'),
      y4: t('axis_right_y4')
    };

    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('axis_config_title')}</div>
        ${activeAxes.map(ax => {
          const cfg = state.axisScales[ax];
          const curTitle = ax === 'y1' ? state.y1Title : (ax === 'y2' ? state.y2Title : (ax === 'y3' ? state.y3Title : state.y4Title));
          return `
            <div class="axis-cfg-card">
              <div class="axis-cfg-header">
                <span>${axisLabels[ax]}</span>
                <span class="cm-badge cm-badge-sky">${ax.toUpperCase()}</span>
              </div>
              <div class="form-group">
                <label class="form-label">${t('axis_title_label')}</label>
                <input type="text" class="form-input inp-axis-title" data-ax="${ax}" value="${curTitle}" placeholder="e.g. Temperature [°C]" />
              </div>
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('axis_min_label')}</label>
                  <input type="number" step="any" class="form-input inp-axis-min" data-ax="${ax}" value="${cfg.min ?? ''}" placeholder="${t('axis_auto_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('axis_max_label')}</label>
                  <input type="number" step="any" class="form-input inp-axis-max" data-ax="${ax}" value="${cfg.max ?? ''}" placeholder="${t('axis_auto_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1.2;">
                  <label class="form-label">${t('axis_decimals_label')}</label>
                  <select class="form-select sel-axis-dec" data-ax="${ax}">
                    <option value="auto" ${cfg.decimals === 'auto' ? 'selected' : ''}>${t('dec_auto')}</option>
                    <option value="0" ${cfg.decimals === '0' ? 'selected' : ''}>${t('dec_0')}</option>
                    <option value="1" ${cfg.decimals === '1' ? 'selected' : ''}>${t('dec_1')}</option>
                    <option value="2" ${cfg.decimals === '2' ? 'selected' : ''}>${t('dec_2')}</option>
                    <option value="3" ${cfg.decimals === '3' ? 'selected' : ''}>${t('dec_3')}</option>
                  </select>
                </div>
              </div>
              <div class="form-row" style="margin-bottom: 0;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label class="form-label">${t('major_dtick_label')}</label>
                  <input type="number" step="any" min="0" class="form-input inp-axis-major" data-ax="${ax}" value="${cfg.majorStep ?? ''}" placeholder="${t('grid_step_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label class="form-label">${t('minor_dtick_label')}</label>
                  <input type="number" step="any" min="0" class="form-input inp-axis-minor" data-ax="${ax}" value="${cfg.minorStep ?? ''}" placeholder="${t('minor_step_placeholder')}" />
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('x_decimals_title')}</div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('x_custom_title')}</label>
          <input type="text" class="form-input" id="axis-x-title" value="${state.xTitle}" placeholder="${state.selectedX || 'Time'}" />
        </div>
      </section>
    `;
  }

  if (state.canvasSubTab === 'grid') {
    const gf = state.gridFrame;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('frame_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('frame_mode_label')}</label>
          <select class="form-select" id="cfg-frame-mode">
            <option value="open_l" ${gf.frameMode === 'open_l' ? 'selected' : ''}>${t('frame_open_l')}</option>
            <option value="box" ${gf.frameMode === 'box' ? 'selected' : ''}>${t('frame_box')}</option>
            <option value="ticks" ${gf.frameMode === 'ticks' ? 'selected' : ''}>${t('frame_ticks')}</option>
            <option value="none" ${gf.frameMode === 'none' ? 'selected' : ''}>${t('frame_none')}</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('ticks_dir_label')}</label>
          <select class="form-select" id="cfg-tick-dir">
            <option value="outside" ${gf.tickDir === 'outside' ? 'selected' : ''}>${t('ticks_outside')}</option>
            <option value="inside" ${gf.tickDir === 'inside' ? 'selected' : ''}>${t('ticks_inside')}</option>
            <option value="none" ${gf.tickDir === 'none' ? 'selected' : ''}>${t('ticks_none')}</option>
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('grid_title')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-x-grid" ${gf.showXGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_x_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-y-grid" ${gf.showYGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_y_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-minor-grid" ${gf.showMinorGrid ? 'checked' : ''} />
            <span style="font-weight: 600; color: var(--primary);">${t('show_minor_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-zero-line" ${gf.showZeroLine ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_zeroline')}</span>
          </label>
        </div>

        <div class="form-row" style="margin-bottom: 0;">
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">${t('major_grid_color')}</label>
            <input type="color" class="form-input" id="inp-major-grid-color" value="${gf.majorGridColor}" style="height: 30px; padding: 2px;" />
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">${t('minor_grid_color')}</label>
            <input type="color" class="form-input" id="inp-minor-grid-color" value="${gf.minorGridColor}" style="height: 30px; padding: 2px;" />
          </div>
        </div>
      </section>
    `;
  }

  // Sub-Tab 4: Typography, Legend & Smart Annotations
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('typo_title')}</div>
      <div class="form-row">
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
          <label class="form-label">${t('font_family_label')}</label>
          <select class="form-select" id="cfg-font-family">
            <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Scientific)</option>
            <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
            <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
            <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
          <label class="form-label">${t('font_size_label')}</label>
          <input type="number" min="8" max="20" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
        </div>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('legend_title')}</div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">${t('legend_pos_label')}</label>
        <select class="form-select" id="cfg-legend-pos">
          <option value="top" ${state.legendPos === 'top' ? 'selected' : ''}>${t('leg_top')}</option>
          <option value="right" ${state.legendPos === 'right' ? 'selected' : ''}>${t('leg_right')}</option>
          <option value="bottom" ${state.legendPos === 'bottom' ? 'selected' : ''}>${t('leg_bottom')}</option>
          <option value="inside" ${state.legendPos === 'inside' ? 'selected' : ''}>${t('leg_inside')}</option>
          <option value="none" ${state.legendPos === 'none' ? 'selected' : ''}>${t('leg_none')}</option>
        </select>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('annot_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('peak_label')}</label>
        <select class="form-select" id="cfg-peak-mode">
          <option value="none" ${state.peakMode === 'none' ? 'selected' : ''}>${t('peak_none')}</option>
          <option value="global" ${state.peakMode === 'global' ? 'selected' : ''}>${t('peak_global')}</option>
          <option value="daily" ${state.peakMode === 'daily' ? 'selected' : ''}>${t('peak_daily')}</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 6px;">
          <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
          <span style="font-weight: 600; color: #000000;">${t('comfort_toggle')}</span>
        </label>

        <div id="comfort-panel" style="display: ${state.comfortBand ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
          <div class="form-group">
            <label class="form-label">${t('comfort_season_label')}</label>
            <select class="form-select" id="cfg-comfort-season">
              <option value="winter" ${state.comfortSeason === 'winter' ? 'selected' : ''}>${t('season_winter')}</option>
              <option value="summer" ${state.comfortSeason === 'summer' ? 'selected' : ''}>${t('season_summer')}</option>
              <option value="custom" ${state.comfortSeason === 'custom' ? 'selected' : ''}>${t('season_custom')}</option>
            </select>
          </div>
          <div class="form-row" style="margin-bottom: 0;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('comfort_min_label')}</label>
              <input type="number" step="0.5" class="form-input" id="comfort-min" value="${state.comfortMin}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('comfort_max_label')}</label>
              <input type="number" step="0.5" class="form-input" id="comfort-max" value="${state.comfortMax}" />
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMultiPlotSubTabContent(): string {
  const dims = getMultiPlotDimensions();

  if (state.mpSubTab === 'layout') {
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('mp_topo_title')}</span>
          <span class="cm-badge cm-badge-sky">${dims.rows}×${dims.cols} (${dims.count})</span>
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
            <span>▦ Grid 2×2</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">4 Cells</span>
          </button>
          <button class="topo-btn ${state.mpTopology === '1x2' ? 'active' : ''}" data-topo="1x2">
            <span>◫ Side 1×2</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">2 Cells</span>
          </button>
        </div>

        <button class="topo-btn ${state.mpTopology === 'custom' ? 'active' : ''}" data-topo="custom" style="width: 100%; margin-bottom: 10px;">
          <span>⊞ ${t('mp_custom_rc')} (1×1 ... 5×5)</span>
          <span class="cm-badge cm-badge-emerald">${state.mpCustomRows}×${state.mpCustomCols}</span>
        </button>

        ${state.mpTopology === 'custom' ? `
          <div class="form-row" style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 10px;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('mp_rows_label')} [1-5]</label>
              <input type="number" min="1" max="5" class="form-input" id="mp-custom-rows" value="${state.mpCustomRows}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('mp_cols_label')} [1-5]</label>
              <input type="number" min="1" max="5" class="form-input" id="mp-custom-cols" value="${state.mpCustomCols}" />
            </div>
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-share-x" ${state.mpShareX ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_share_x')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-share-y" ${state.mpShareY ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_share_y')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-lettering" ${state.mpAutoLettering ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_lettering')}</span>
          </label>
        </div>

        <div class="form-group" style="margin-top: 10px; margin-bottom: 0;">
          <label class="form-label">${t('mp_letter_pos_label')}</label>
          <select class="form-select" id="mp-letter-pos">
            <option value="outside_top" ${state.mpLetterPos === 'outside_top' ? 'selected' : ''}>${t('mp_pos_outside_top')}</option>
            <option value="outside_side" ${state.mpLetterPos === 'outside_side' ? 'selected' : ''}>${t('mp_pos_outside_side')}</option>
            <option value="inside" ${state.mpLetterPos === 'inside' ? 'selected' : ''}>${t('mp_pos_inside')}</option>
          </select>
        </div>
      </section>
    `;
  }

  if (state.mpSubTab === 'panels') {
    const pIdx = state.mpActivePanelIdx;
    const panel = ensurePanelNormalized(pIdx);
    const letter = getPanelLetter(pIdx);
    const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
    const savedCanvases = Object.keys(project?.canvases || {});

    return `
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('mp_select_panel_label')}</span>
          <span class="cm-badge cm-badge-emerald">${letter}</span>
        </div>

        <!-- Cell Selector Pills (a), (b), (c)... -->
        <div class="mp-cell-selector">
          ${Array.from({ length: dims.count }, (_, i) => `
            <button class="mp-cell-pill ${i === pIdx ? 'active' : ''}" data-mpcell="${i}">
              ${getPanelLetter(i)}
            </button>
          `).join('')}
        </div>

        ${savedCanvases.length > 0 ? `
          <div class="form-group">
            <label class="form-label">${t('mp_import_canvas_label')}</label>
            <select class="form-select" id="mp-import-canvas">
              <option value="">${t('mp_import_placeholder')}</option>
              ${savedCanvases.map(c => `<option value="${c}">📊 ${c}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <!-- Active Panel Titles & Scale -->
        <div class="axis-cfg-card">
          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('mp_panel_title_label')}</label>
              <input type="text" class="form-input" id="mp-active-y1-title" value="${panel.yTitle || ''}" placeholder="Y1 Title" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('mp_panel_y2_title_label')}</label>
              <input type="text" class="form-input" id="mp-active-y2-title" value="${panel.y2Title || ''}" placeholder="Optional Y2" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('axis_min_label')}</label>
              <input type="number" step="any" class="form-input" id="mp-active-min" value="${panel.y1Min ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('axis_max_label')}</label>
              <input type="number" step="any" class="form-input" id="mp-active-max" value="${panel.y1Max ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1.1;">
              <label class="form-label">${t('axis_decimals_label')}</label>
              <select class="form-select" id="mp-active-dec">
                <option value="auto" ${(panel.y1Decimals || 'auto') === 'auto' ? 'selected' : ''}>Auto</option>
                <option value="0" ${panel.y1Decimals === '0' ? 'selected' : ''}>0 (Int)</option>
                <option value="1" ${panel.y1Decimals === '1' ? 'selected' : ''}>1 (0.0)</option>
                <option value="2" ${panel.y1Decimals === '2' ? 'selected' : ''}>2 (0.00)</option>
                <option value="3" ${panel.y1Decimals === '3' ? 'selected' : ''}>3 (0.000)</option>
              </select>
            </div>
          </div>

          <div class="form-row" style="margin-bottom: 6px;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('major_dtick_label')}</label>
              <input type="number" step="any" min="0" class="form-input" id="mp-active-major" value="${panel.y1MajorStep ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('minor_dtick_label')}</label>
              <input type="number" step="any" min="0" class="form-input" id="mp-active-minor" value="${panel.y1MinorStep ?? ''}" placeholder="Auto" />
            </div>
          </div>

          <button class="btn btn-secondary" id="btn-mp-sync-all-scales" style="width: 100%; font-size: 0.72rem; padding: 4px;">
            ⚡ ${t('mp_apply_all_scales')}
          </button>
        </div>

        <!-- Full Multi-Trace Manager for the Selected Panel -->
        <div class="sidebar-title" style="margin-top: 8px;">
          <span>${letter} — ${t('traces_title')}</span>
          <span class="cm-badge cm-badge-emerald">${panel.traces.length}</span>
        </div>

        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <select class="form-select" id="sel-mp-new-trace-col" style="flex: 1; font-size: 0.78rem; padding: 4px 8px;">
            ${renderColumnOptions('')}
          </select>
          <button class="btn btn-primary" id="btn-mp-add-trace" style="font-size: 0.75rem; padding: 4px 10px; white-space: nowrap;">
            ${t('btn_add_series')}
          </button>
        </div>

        <div>
          ${panel.traces.map((tr, tIdx) => `
            <div class="trace-card" data-mptidx="${tIdx}">
              <div class="trace-header">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 6px;">
                  <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">Y:</span>
                  <select class="trace-select sel-mptrace-col" data-mptidx="${tIdx}" style="font-weight: 600; flex: 1;">
                    <option value="">-- Select --</option>
                    ${renderColumnOptions(tr.column)}
                  </select>
                </div>
                <button class="btn btn-secondary btn-del-mptrace" data-mptidx="${tIdx}" style="padding: 2px 6px; font-size: 0.68rem; color: var(--rose);">✕</button>
              </div>
              <div class="trace-controls">
                <select class="trace-select sel-mptrace-axis" data-mptidx="${tIdx}">
                  <option value="y1" ${tr.axis === 'y1' ? 'selected' : ''}>Y1 (L)</option>
                  <option value="y2" ${tr.axis === 'y2' ? 'selected' : ''}>Y2 (R)</option>
                </select>
                <select class="trace-select sel-mptrace-type" data-mptidx="${tIdx}">
                  <option value="line" ${tr.chartType === 'line' ? 'selected' : ''}>${t('type_line')}</option>
                  <option value="scatter" ${tr.chartType === 'scatter' ? 'selected' : ''}>${t('type_scatter')}</option>
                  <option value="bar" ${tr.chartType === 'bar' ? 'selected' : ''}>${t('type_bar')}</option>
                  <option value="area" ${tr.chartType === 'area' ? 'selected' : ''}>${t('type_area')}</option>
                </select>
                <select class="trace-select sel-mptrace-dash" data-mptidx="${tIdx}">
                  <option value="solid" ${tr.lineDash === 'solid' ? 'selected' : ''}>—</option>
                  <option value="dash" ${tr.lineDash === 'dash' ? 'selected' : ''}>--</option>
                  <option value="dot" ${tr.lineDash === 'dot' ? 'selected' : ''}>··</option>
                </select>
                <input type="color" class="trace-color-input inp-mptrace-color" data-mptidx="${tIdx}" value="${tr.color}" />
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (state.mpSubTab === 'axes') {
    const gf = state.gridFrame;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('frame_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('frame_mode_label')}</label>
          <select class="form-select" id="cfg-frame-mode">
            <option value="open_l" ${gf.frameMode === 'open_l' ? 'selected' : ''}>${t('frame_open_l')}</option>
            <option value="box" ${gf.frameMode === 'box' ? 'selected' : ''}>${t('frame_box')}</option>
            <option value="ticks" ${gf.frameMode === 'ticks' ? 'selected' : ''}>${t('frame_ticks')}</option>
            <option value="none" ${gf.frameMode === 'none' ? 'selected' : ''}>${t('frame_none')}</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('ticks_dir_label')}</label>
          <select class="form-select" id="cfg-tick-dir">
            <option value="outside" ${gf.tickDir === 'outside' ? 'selected' : ''}>${t('ticks_outside')}</option>
            <option value="inside" ${gf.tickDir === 'inside' ? 'selected' : ''}>${t('ticks_inside')}</option>
            <option value="none" ${gf.tickDir === 'none' ? 'selected' : ''}>${t('ticks_none')}</option>
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('grid_title')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-x-grid" ${gf.showXGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_x_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-y-grid" ${gf.showYGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_y_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-minor-grid" ${gf.showMinorGrid ? 'checked' : ''} />
            <span style="font-weight: 600; color: var(--primary);">${t('show_minor_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-zero-line" ${gf.showZeroLine ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_zeroline')}</span>
          </label>
        </div>
      </section>
    `;
  }

  // MultiPlot Sub-Tab 4: Legend Mode, Outer Macro-Axes & Global Typography
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('mp_legend_mode_label')}</div>
      <div class="form-group" style="margin-bottom: 0;">
        <select class="form-select" id="mp-legend-mode">
          <option value="per_panel" ${state.mpLegendMode === 'per_panel' ? 'selected' : ''}>${t('mp_leg_per_panel')}</option>
          <option value="global_top" ${state.mpLegendMode === 'global_top' ? 'selected' : ''}>${t('mp_leg_global_top')}</option>
          <option value="global_bottom" ${state.mpLegendMode === 'global_bottom' ? 'selected' : ''}>${t('mp_leg_global_bottom')}</option>
          <option value="none" ${state.mpLegendMode === 'none' ? 'selected' : ''}>${t('mp_leg_none')}</option>
        </select>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('mp_macro_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('mp_macro_x_label')}</label>
        <input type="text" class="form-input" id="mp-macro-x" value="${state.mpMacroX}" placeholder="${t('mp_macro_x_placeholder')}" />
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">${t('mp_macro_y_label')}</label>
        <input type="text" class="form-input" id="mp-macro-y" value="${state.mpMacroY}" placeholder="${t('mp_macro_y_placeholder')}" />
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('typo_title')}</div>
      <div class="form-row">
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
          <label class="form-label">${t('font_family_label')}</label>
          <select class="form-select" id="cfg-font-family">
            <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Scientific)</option>
            <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
            <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
            <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
          <label class="form-label">${t('font_size_label')}</label>
          <input type="number" min="8" max="20" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
        </div>
      </div>
    </section>
  `;
}

function renderColumnOptions(selected: string): string {
  if (!state.dataset) return '';
  return state.dataset.columns
    .map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`)
    .join('');
}

function renderAddColumnOptions(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `<option value="">-- Load Dataset --</option>`;
  }
  const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(tr => tr.column === c));
  const defaultCol = available.length > 0 ? available[0] : (state.dataset.columns[1] || state.dataset.columns[0]);

  return state.dataset.columns
    .map(c => `<option value="${c}" ${c === defaultCol ? 'selected' : ''}>${c}</option>`)
    .join('');
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
    const current = state.activeMap || 'Map_1';
    return `<option value="${current}" selected>🗺️ ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeMap ? 'selected' : ''}>🗺️ ${k}</option>`).join('');
}

function renderTraceCards(): string {
  if (state.traces.length === 0) {
    return `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 14px; border: 1px dashed var(--border); border-radius: 6px;">
      ${t('no_traces_msg')}
    </div>`;
  }

  return state.traces.map((trace, idx) => `
    <div class="trace-card" data-idx="${idx}">
      <div class="trace-header">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 8px;">
          <span style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted);">Y:</span>
          <select class="trace-select sel-trace-column" data-idx="${idx}" style="font-weight: 600; flex: 1; font-size: 0.82rem; padding: 3px 6px;">
            ${renderColumnOptions(trace.column)}
          </select>
        </div>
        <button class="btn btn-secondary btn-del-trace" data-idx="${idx}" style="padding: 2px 7px; font-size: 0.7rem; color: var(--rose);">
          ✕
        </button>
      </div>
      
      <div class="trace-controls">
        <select class="trace-select sel-trace-axis" data-idx="${idx}">
          <option value="y1" ${trace.axis === 'y1' ? 'selected' : ''}>${t('axis_left_y1')}</option>
          <option value="y2" ${trace.axis === 'y2' ? 'selected' : ''}>${t('axis_right_y2')}</option>
          <option value="y3" ${trace.axis === 'y3' ? 'selected' : ''}>${t('axis_right_y3')}</option>
          <option value="y4" ${trace.axis === 'y4' ? 'selected' : ''}>${t('axis_right_y4')}</option>
        </select>

        <select class="trace-select sel-trace-type" data-idx="${idx}">
          <option value="line" ${trace.chartType === 'line' ? 'selected' : ''}>${t('type_line')}</option>
          <option value="scatter" ${trace.chartType === 'scatter' ? 'selected' : ''}>${t('type_scatter')}</option>
          <option value="bar" ${trace.chartType === 'bar' ? 'selected' : ''}>${t('type_bar')}</option>
          <option value="area" ${trace.chartType === 'area' ? 'selected' : ''}>${t('type_area')}</option>
        </select>

        <select class="trace-select sel-trace-dash" data-idx="${idx}">
          <option value="solid" ${trace.lineDash === 'solid' ? 'selected' : ''}>${t('dash_solid')}</option>
          <option value="dash" ${trace.lineDash === 'dash' ? 'selected' : ''}>${t('dash_dash')}</option>
          <option value="dot" ${trace.lineDash === 'dot' ? 'selected' : ''}>${t('dash_dot')}</option>
        </select>

        <input type="color" class="trace-color-input inp-trace-color" data-idx="${idx}" value="${trace.color}" />
      </div>
    </div>
  `).join('');
}

function renderPreviewTable(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 600;">${t('no_dataset_title')}</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">${t('no_dataset_sub')}</div>
      </div>
    `;
  }

  const thead = `<tr>${state.dataset.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const tbody = state.dataset.rows.slice(0, 50).map(row => {
    return `<tr>${row.map(val => `<td>${val}</td>`).join('')}</tr>`;
  }).join('');

  return `<table class="cm-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function renderPhysicsSidebarContent(): string {
  if (state.physicsMode === 'carpet') {
    const c = state.carpetState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('carpet_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('carpet_var_label')}</label>
          <select class="form-select" id="phys-carpet-var">
            ${renderColumnOptions(c.variableCol)}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_agg_label')}</label>
            <select class="form-select" id="phys-carpet-agg">
              <option value="mean" ${c.aggMethod === 'mean' ? 'selected' : ''}>${t('carpet_agg_mean')}</option>
              <option value="max" ${c.aggMethod === 'max' ? 'selected' : ''}>${t('carpet_agg_max')}</option>
              <option value="min" ${c.aggMethod === 'min' ? 'selected' : ''}>${t('carpet_agg_min')}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_colorscale_label')}</label>
            <select class="form-select" id="phys-carpet-cscale">
              <option value="Thermal" ${c.colorscale === 'Thermal' ? 'selected' : ''}>Thermal (Blue–Red)</option>
              <option value="Viridis" ${c.colorscale === 'Viridis' ? 'selected' : ''}>Viridis</option>
              <option value="Plasma" ${c.colorscale === 'Plasma' ? 'selected' : ''}>Plasma</option>
              <option value="Turbo" ${c.colorscale === 'Turbo' ? 'selected' : ''}>Turbo</option>
              <option value="RdBu" ${c.colorscale === 'RdBu' ? 'selected' : ''}>RdBu (Diverging)</option>
              <option value="Emerald" ${c.colorscale === 'Emerald' ? 'selected' : ''}>Emerald</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('carpet_filter_label')}</label>
          <select class="form-select" id="phys-carpet-filter">
            <option value="all" ${c.dayFilter === 'all' ? 'selected' : ''}>${t('carpet_filter_all')}</option>
            <option value="weekdays" ${c.dayFilter === 'weekdays' ? 'selected' : ''}>${t('carpet_filter_weekdays')}</option>
            <option value="weekends" ${c.dayFilter === 'weekends' ? 'selected' : ''}>${t('carpet_filter_weekends')}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_zmin_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-carpet-zmin" value="${c.zMin ?? ''}" placeholder="Auto" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_zmax_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-carpet-zmax" value="${c.zMax ?? ''}" placeholder="Auto" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('axis_decimals_label')}</label>
            <select class="form-select" id="phys-carpet-dec">
              <option value="auto" ${c.decimals === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="0" ${c.decimals === '0' ? 'selected' : ''}>0</option>
              <option value="1" ${c.decimals === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${c.decimals === '2' ? 'selected' : ''}>2</option>
              <option value="3" ${c.decimals === '3' ? 'selected' : ''}>3</option>
            </select>
          </div>
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer; margin-bottom: 8px;">
          <input type="checkbox" id="phys-carpet-contours" ${c.showContours ? 'checked' : ''} />
          <span style="font-weight: 600;">${t('carpet_contours_toggle')}</span>
        </label>
        ${c.showContours ? `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('carpet_contour_step_label')}</label>
            <input type="number" step="any" min="0.1" class="form-input" id="phys-carpet-cstep" value="${c.contourStep ?? ''}" placeholder="e.g. 1.0" />
          </div>
        ` : ''}
      </section>
    `;
  }

  if (state.physicsMode === 'comfort') {
    const c = state.comfortState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('comfort_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('comfort_norm_label')}</label>
          <select class="form-select" id="phys-comfort-norm">
            <option value="en16798" ${c.normMode === 'en16798' ? 'selected' : ''}>${t('comfort_norm_en16798')}</option>
            <option value="ashrae55" ${c.normMode === 'ashrae55' ? 'selected' : ''}>${t('comfort_norm_ashrae55')}</option>
            <option value="psychro" ${c.normMode === 'psychro' ? 'selected' : ''}>${t('comfort_norm_psychro')}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('comfort_in_temp_label')}</label>
          <select class="form-select" id="phys-comfort-intemp">
            ${renderColumnOptions(c.indoorTempCol)}
          </select>
        </div>
        ${c.normMode === 'psychro' ? `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('comfort_rh_label')}</label>
            <select class="form-select" id="phys-comfort-rh">
              ${renderColumnOptions(c.rhCol)}
            </select>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label">${t('comfort_out_temp_label')}</label>
            <select class="form-select" id="phys-comfort-outtemp">
              ${renderColumnOptions(c.outdoorTempCol)}
            </select>
          </div>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="phys-comfort-trm" ${c.computeRunningMean ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('comfort_calc_trm_toggle')}</span>
          </label>
        `}
      </section>
    `;
  }

  if (state.physicsMode === 'duration') {
    const d = state.durationState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('dur_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('dur_var_label')}</label>
          <select class="form-select" id="phys-dur-var">
            ${renderColumnOptions(d.variableCol)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('dur_compare_var_label')}</label>
          <select class="form-select" id="phys-dur-cmp">
            <option value="">${t('none_option')}</option>
            ${renderColumnOptions(d.compareCol)}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1.5;">
            <label class="form-label">${t('dur_x_mode_label')}</label>
            <select class="form-select" id="phys-dur-xmode">
              <option value="hours" ${d.xMode === 'hours' ? 'selected' : ''}>${t('dur_x_hours')}</option>
              <option value="pct" ${d.xMode === 'pct' ? 'selected' : ''}>${t('dur_x_pct')}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_dt_label')}</label>
            <input type="number" step="0.05" min="0.01" class="form-input" id="phys-dur-dt" value="${d.dtHours}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_thresh1_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-dur-t1" value="${d.threshold1 ?? ''}" placeholder="e.g. 26.0" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_thresh2_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-dur-t2" value="${d.threshold2 ?? ''}" placeholder="e.g. 28.0" />
          </div>
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
          <input type="checkbox" id="phys-dur-shade" ${d.shadeExceedance ? 'checked' : ''} />
          <span style="font-weight: 600;">${t('dur_shade_toggle')}</span>
        </label>
      </section>
    `;
  }

  // Calibration Mode (Track 5)
  const cal = state.calibState;
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('cal_config_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('cal_measured_label')}</label>
        <select class="form-select" id="phys-cal-meas">
          ${renderColumnOptions(cal.measuredCol)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_simulated_label')}</label>
        <select class="form-select" id="phys-cal-sim">
          ${renderColumnOptions(cal.simulatedCol)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_view_label')}</label>
        <select class="form-select" id="phys-cal-view">
          <option value="series" ${cal.viewMode === 'series' ? 'selected' : ''}>${t('cal_view_series')}</option>
          <option value="parity" ${cal.viewMode === 'parity' ? 'selected' : ''}>${t('cal_view_parity')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_criteria_label')}</label>
        <select class="form-select" id="phys-cal-std">
          <option value="hourly" ${cal.standard === 'hourly' ? 'selected' : ''}>${t('cal_crit_hourly')}</option>
          <option value="monthly" ${cal.standard === 'monthly' ? 'selected' : ''}>${t('cal_crit_monthly')}</option>
        </select>
      </div>
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" id="phys-cal-box" ${cal.showBoxOnChart ? 'checked' : ''} />
        <span style="font-weight: 600;">${t('cal_show_on_chart')}</span>
      </label>
    </section>
  `;
}

function renderPhysicsKpiBar(): string {
  if (state.physicsMode === 'carpet') {
    const c = state.carpetState;
    return `
      <span class="physics-kpi-chip">📊 Variable: <strong>${c.variableCol || '—'}</strong></span>
      <span class="physics-kpi-chip">🧮 Bin Method: <strong>${c.aggMethod.toUpperCase()}</strong></span>
      <span class="physics-kpi-chip">📅 Schedule Filter: <strong>${c.dayFilter.toUpperCase()}</strong></span>
      <span class="physics-kpi-chip">🎨 Palette: <strong>${c.colorscale}</strong></span>
    `;
  }
  if (state.physicsMode === 'comfort') {
    const k = state.comfortKpi;
    return `
      <span class="physics-kpi-chip">${t('comfort_kpi_total')} <strong>${k.totalHours} h</strong></span>
      <span class="physics-kpi-chip" style="border-color: var(--primary);">${t('comfort_kpi_cat1')} <strong style="color: var(--primary);">${k.cat1Hours} h (${k.cat1Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('comfort_kpi_cat2')} <strong>${k.cat2Hours} h (${k.cat2Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip" style="border-color: var(--rose);">${t('comfort_kpi_overheat')} <strong style="color: var(--rose);">${k.overheatHours} h (${k.overheatPct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('comfort_kpi_undercool')} <strong>${k.undercoolHours} h (${k.undercoolPct.toFixed(1)}%)</strong></span>
    `;
  }
  if (state.physicsMode === 'duration') {
    const k = state.durationKpi;
    return `
      <span class="physics-kpi-chip">${t('dur_kpi_exc1')} <strong style="color: #b45309;">${k.exc1Hours.toFixed(1)} h (${k.exc1Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_exc2')} <strong style="color: var(--rose);">${k.exc2Hours.toFixed(1)} h (${k.exc2Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_integral')} <strong style="color: var(--primary);">${k.exposureIntegral.toFixed(1)} unit·h</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_peak')} <strong>${k.peakVal.toFixed(1)} / ${k.p95Val.toFixed(1)} / ${k.medianVal.toFixed(1)}</strong></span>
    `;
  }
  const m = state.calibMetrics;
  const isPass = state.calibState.standard === 'monthly' ? m.monthlyPass : m.hourlyPass;
  return `
    <span class="cm-badge ${isPass ? 'cm-badge-emerald' : 'cm-badge-rose'}" style="font-size: 0.78rem; padding: 5px 10px;">
      ${isPass ? t('cal_badge_pass') : t('cal_badge_fail')}
    </span>
    <span class="physics-kpi-chip">NMBE: <strong>${m.nmbePct >= 0 ? '+' : ''}${m.nmbePct.toFixed(2)}%</strong></span>
    <span class="physics-kpi-chip">CV(RMSE): <strong>${m.cvRmsePct.toFixed(2)}%</strong></span>
    <span class="physics-kpi-chip">R²: <strong>${m.rSquared.toFixed(4)}</strong></span>
    <span class="physics-kpi-chip">RMSE / MAE: <strong>${m.rmse.toFixed(2)} / ${m.mae.toFixed(2)}</strong></span>
  `;
}

function renderEditorialView(): string {
  const ed = state.editorialState;
  const cols = state.dataset?.columns || [];
  const rows = state.dataset?.rows || [];
  const statRows = computeVariableStats(cols, rows, ed);
  const generatedCode = generatePublicationTableCode(statRows, ed);

  return `
    <aside class="sidebar">
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('ed_tables_title')}</span>
          <span class="cm-badge cm-badge-emerald">LaTeX / MD</span>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_format_label')}</label>
          <select class="form-select" id="ed-output-fmt">
            <option value="latex" ${ed.outputFormat === 'latex' ? 'selected' : ''}>${t('ed_fmt_latex')}</option>
            <option value="markdown" ${ed.outputFormat === 'markdown' ? 'selected' : ''}>${t('ed_fmt_md')}</option>
            <option value="tsv" ${ed.outputFormat === 'tsv' ? 'selected' : ''}>${t('ed_fmt_tsv')}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_caption_label')}</label>
          <input type="text" class="form-input" id="ed-caption" value="${ed.caption}" />
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1.4;">
            <label class="form-label">${t('ed_label_id')}</label>
            <input type="text" class="form-input" id="ed-label-id" value="${ed.latexLabel}" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('axis_decimals_label')}</label>
            <select class="form-select" id="ed-decimals">
              <option value="0" ${ed.decimals === '0' ? 'selected' : ''}>0</option>
              <option value="1" ${ed.decimals === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${ed.decimals === '2' ? 'selected' : ''}>2</option>
              <option value="3" ${ed.decimals === '3' ? 'selected' : ''}>3</option>
            </select>
          </div>
        </div>
        <div style="font-size: 0.74rem; font-weight: 700; margin-bottom: 6px; color: #000000;">
          Variables, Units & Thresholds:
        </div>
        <div>
          ${ed.variables.map((v, idx) => `
            <div class="editorial-var-row">
              <input type="checkbox" class="ed-var-chk" data-vidx="${idx}" ${v.selected ? 'checked' : ''} />
              <span style="font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.column}">${v.column}</span>
              <input type="text" class="form-input ed-var-unit" data-vidx="${idx}" value="${v.unit}" placeholder="Unit" style="padding: 3px 6px; font-size: 0.74rem;" />
              <input type="number" step="any" class="form-input ed-var-thresh" data-vidx="${idx}" value="${v.threshold ?? ''}" placeholder="Thresh" style="padding: 3px 6px; font-size: 0.74rem;" />
            </div>
          `).join('')}
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('ed_plate_title')}</span>
          <span class="cm-badge cm-badge-sky">600 DPI</span>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_plate_preset_label')}</label>
          <select class="form-select" id="ed-plate-preset">
            <option value="single_85mm" ${ed.plateWidthPreset === 'single_85mm' ? 'selected' : ''}>${t('ed_plate_1col')}</option>
            <option value="half_120mm" ${ed.plateWidthPreset === 'half_120mm' ? 'selected' : ''}>${t('ed_plate_15col')}</option>
            <option value="double_170mm" ${ed.plateWidthPreset === 'double_170mm' ? 'selected' : ''}>${t('ed_plate_2col')}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('ed_plate_grid_label')}</label>
            <select class="form-select" id="ed-plate-grid">
              <option value="2x2" ${ed.plateGrid === '2x2' ? 'selected' : ''}>2×2 Matrix (4 Panels)</option>
              <option value="2x1" ${ed.plateGrid === '2x1' ? 'selected' : ''}>2×1 Vertical (2 Panels)</option>
              <option value="1x2" ${ed.plateGrid === '1x2' ? 'selected' : ''}>1×2 Side-by-Side (2 Panels)</option>
              <option value="3x1" ${ed.plateGrid === '3x1' ? 'selected' : ''}>3×1 Stack (3 Panels)</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('ed_plate_dpi_label')}</label>
            <select class="form-select" id="ed-plate-dpi">
              <option value="300" ${ed.plateDpi === 300 ? 'selected' : ''}>300 DPI</option>
              <option value="600" ${ed.plateDpi === 600 ? 'selected' : ''}>600 DPI</option>
            </select>
          </div>
        </div>
        ${[0, 1, 2, 3].map(sIdx => `
          <div class="form-group" style="margin-bottom: 6px;">
            <label class="form-label">Slot (${String.fromCharCode(97 + sIdx)}) Series</label>
            <select class="form-select ed-plate-slot" data-sidx="${sIdx}">
              ${renderColumnOptions(ed.plateSlots[sIdx] || '')}
            </select>
          </div>
        `).join('')}
      </section>
    </aside>

    <main class="data-ingestion-view" style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Card 1: Statistical Summary Table & LaTeX / Markdown Exporter -->
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 1.05rem; font-weight: 700; color: #000000;">${t('ed_tables_title')}</h2>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${t('ed_tables_sub')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-ed-copy-code" style="font-size: 0.78rem;">
              ${t('ed_btn_copy')}
            </button>
            <button class="btn btn-secondary" id="btn-ed-download-code" style="font-size: 0.78rem;">
              ${t('ed_btn_download')}
            </button>
          </div>
        </div>

        <div class="table-preview-scroll" style="max-height: 210px; margin-bottom: 12px;">
          <table class="cm-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Unit</th>
                <th>N</th>
                <th>Mean</th>
                <th>Std</th>
                <th>Min</th>
                <th>P5</th>
                <th>Median (P50)</th>
                <th>P95</th>
                <th>Max</th>
                <th>Exceedance</th>
              </tr>
            </thead>
            <tbody>
              ${statRows.map(r => `
                <tr>
                  <td><strong>${r.variable}</strong></td>
                  <td>${r.unit}</td>
                  <td>${r.n}</td>
                  <td>${fmtDec(r.mean, ed.decimals)}</td>
                  <td>${fmtDec(r.std, ed.decimals)}</td>
                  <td>${fmtDec(r.min, ed.decimals)}</td>
                  <td>${fmtDec(r.p5, ed.decimals)}</td>
                  <td><strong>${fmtDec(r.median, ed.decimals)}</strong></td>
                  <td>${fmtDec(r.p95, ed.decimals)}</td>
                  <td>${fmtDec(r.max, ed.decimals)}</td>
                  <td>${r.threshold !== null ? `${r.excHours.toFixed(1)} h (>${r.threshold}, ${r.excPct.toFixed(1)}%)` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <textarea class="editorial-code-box" id="ed-code-output" readonly>${generatedCode}</textarea>
      </div>

      <!-- Card 2: Composite Figure Plate Compiler -->
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 1.05rem; font-weight: 700; color: #000000;">${t('ed_plate_title')}</h2>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${t('ed_plate_sub')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-ed-plate-svg" style="font-size: 0.78rem;">
              ${t('ed_plate_btn_svg')}
            </button>
            <button class="btn btn-secondary" id="btn-ed-plate-png" style="font-size: 0.78rem;">
              ${t('ed_plate_btn_png')}
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: center; background: #f8fafc; padding: 14px; border: 1px solid var(--border); border-radius: 8px; overflow: auto;">
          <div id="plotly-plate-chart" class="plot-wrapper"></div>
        </div>
      </div>
    </main>
  `;
}

function updatePhysicsChart() {
  const chartEl = document.getElementById('plotly-physics-chart');
  if (!chartEl || !state.dataset || state.dataset.columns.length === 0) return;

  const pxW = Math.round(state.widthCm * 37.795 * 1.15);
  const pxH = Math.round(state.heightCm * 37.795 * 1.15);
  const cols = state.dataset.columns;
  const rows = state.dataset.rows;
  const tsCol = state.timestampCol || cols[0] || '';

  if (state.physicsMode === 'carpet') {
    const { traces, layout } = buildCarpetPlotFigure(
      cols, rows, tsCol, state.carpetState, state.fontFamily, state.fontSize, pxW, pxH
    );
    Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
  } else if (state.physicsMode === 'comfort') {
    const { traces, layout, kpi } = buildThermalComfortFigure(
      cols, rows, state.comfortState, state.fontFamily, state.fontSize, pxW, pxH
    );
    state.comfortKpi = kpi;
    Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
  } else if (state.physicsMode === 'duration') {
    const { traces, layout, kpi } = buildDurationCurveFigure(
      cols, rows, state.durationState, state.fontFamily, state.fontSize, pxW, pxH
    );
    state.durationKpi = kpi;
    Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
  } else {
    const { traces, layout, metrics } = buildCalibrationFigure(
      cols, rows, tsCol, state.calibState, state.fontFamily, state.fontSize, pxW, pxH
    );
    state.calibMetrics = metrics;
    Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
  }

  const banner = document.getElementById('physics-kpi-banner');
  if (banner) {
    banner.innerHTML = renderPhysicsKpiBar();
  }
}

function updateEditorialSuite() {
  const plateEl = document.getElementById('plotly-plate-chart');
  if (!plateEl || !state.dataset || state.dataset.columns.length === 0) return;

  const { traces, layout } = buildCompositePlateFigure(
    state.dataset.columns,
    state.dataset.rows,
    state.timestampCol || state.dataset.columns[0] || '',
    state.editorialState,
    state.fontFamily,
    state.fontSize,
    state.gridFrame
  );
  Plotly.newPlot(plateEl, traces, layout, { responsive: true, displayModeBar: false });
}

function attachEventListeners() {
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
      state.sqlStatus = { connected: false, latency_ms: 0, tables: [], message: `${err}` };
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
      alert(`SQL Query Error: ${err}`);
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

  // Dropzone File Loading (Tab 1 + Direct File Load in Tab 4)
  const dropzone = document.getElementById('dropzone-data');
  dropzone?.addEventListener('click', handleFileSelect);
  document.getElementById('btn-map-load-file')?.addEventListener('click', handleFileSelect);

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

  // Canvas: Select X & Custom X Title
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });
  document.getElementById('axis-x-title')?.addEventListener('input', (e) => {
    state.xTitle = (e.target as HTMLInputElement).value;
    updateChart();
  });

  // Trace Styler: Add Trace
  document.getElementById('btn-add-trace')?.addEventListener('click', () => {
    if (!state.dataset || state.dataset.columns.length === 0) return;
    const selEl = document.getElementById('sel-new-trace-col') as HTMLSelectElement | null;
    let chosenCol = selEl?.value;
    if (!chosenCol) {
      const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(tr => tr.column === c));
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

  // Trace Styler Controls
  document.querySelectorAll('.sel-trace-column').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      if (state.traces[idx]) {
        state.traces[idx].column = (e.target as HTMLSelectElement).value;
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-trace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces.splice(idx, 1);
      renderApp();
    });
  });

  document.querySelectorAll('.sel-trace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].axis = (e.target as HTMLSelectElement).value as any;
      renderApp();
    });
  });

  document.querySelectorAll('.sel-trace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].chartType = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.sel-trace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].lineDash = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-trace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].color = (e.target as HTMLInputElement).value;
      updateChart();
    });
  });

  // Sub-Tab 2: Per-Axis Scale, Range, Decimals & Grid Step Listeners
  document.querySelectorAll('.inp-axis-title').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const val = (e.target as HTMLInputElement).value;
      if (ax === 'y1') state.y1Title = val;
      else if (ax === 'y2') state.y2Title = val;
      else if (ax === 'y3') state.y3Title = val;
      else if (ax === 'y4') state.y4Title = val;
      state.axisScales[ax].title = val;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-min').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      state.axisScales[ax].min = raw === '' ? null : parseFloat(raw);
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-max').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      state.axisScales[ax].max = raw === '' ? null : parseFloat(raw);
      updateChart();
    });
  });

  document.querySelectorAll('.sel-axis-dec').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      state.axisScales[ax].decimals = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-major').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      const num = parseFloat(raw);
      state.axisScales[ax].majorStep = (!isNaN(num) && num > 0) ? num : null;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-minor').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      const num = parseFloat(raw);
      state.axisScales[ax].minorStep = (!isNaN(num) && num > 0) ? num : null;
      if (state.axisScales[ax].minorStep) {
        state.gridFrame.showMinorGrid = true;
      }
      updateChart();
    });
  });

  // Sub-Tab 3: Frame Mode, Ticks & Gridline Toggles (Shared by Single Canvas & MultiPlot)
  const refreshActiveChart = () => {
    if (state.currentTab === 'multi') updateMultiPlotChart();
    else if (state.currentTab === 'maps') updateMapChart();
    else updateChart();
  };

  document.getElementById('cfg-frame-mode')?.addEventListener('change', (e) => {
    state.gridFrame.frameMode = (e.target as HTMLSelectElement).value as any;
    refreshActiveChart();
  });
  document.getElementById('cfg-tick-dir')?.addEventListener('change', (e) => {
    state.gridFrame.tickDir = (e.target as HTMLSelectElement).value as any;
    refreshActiveChart();
  });
  document.getElementById('chk-x-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showXGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-y-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showYGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-minor-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showMinorGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-zero-line')?.addEventListener('change', (e) => {
    state.gridFrame.showZeroLine = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('inp-major-grid-color')?.addEventListener('input', (e) => {
    state.gridFrame.majorGridColor = (e.target as HTMLInputElement).value;
    refreshActiveChart();
  });
  document.getElementById('inp-minor-grid-color')?.addEventListener('input', (e) => {
    state.gridFrame.minorGridColor = (e.target as HTMLInputElement).value;
    refreshActiveChart();
  });

  // Sub-Tab 4: Global Typography, Legend & Annotations
  document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
    state.fontFamily = (e.target as HTMLSelectElement).value;
    refreshActiveChart();
  });
  document.getElementById('cfg-font-size')?.addEventListener('input', (e) => {
    state.fontSize = parseInt((e.target as HTMLInputElement).value, 10) || 11;
    refreshActiveChart();
  });
  document.getElementById('cfg-legend-pos')?.addEventListener('change', (e) => {
    state.legendPos = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });

  // Single Canvas Presets & Custom Dimensions
  document.querySelectorAll('.preset-btn:not(.mp-preset-btn):not(.map-preset-btn)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-preset') as keyof typeof PRESETS | null;
      if (p && PRESETS[p]) {
        state.preset = p;
        state.widthCm = PRESETS[p].w;
        state.heightCm = PRESETS[p].h;
        renderApp();
      }
    });
  });

  document.getElementById('inp-canvas-w')?.addEventListener('change', (e) => {
    state.widthCm = parseFloat((e.target as HTMLInputElement).value) || 17.0;
    state.preset = 'custom';
    updateChart();
  });
  document.getElementById('inp-canvas-h')?.addEventListener('change', (e) => {
    state.heightCm = parseFloat((e.target as HTMLInputElement).value) || 9.5;
    state.preset = 'custom';
    updateChart();
  });

  // Peak & Comfort Band Listeners
  document.getElementById('cfg-peak-mode')?.addEventListener('change', (e) => {
    state.peakMode = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });
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

  document.getElementById('mp-custom-rows')?.addEventListener('change', (e) => {
    state.mpCustomRows = Math.max(1, Math.min(5, parseInt((e.target as HTMLInputElement).value, 10) || 2));
    renderApp();
  });
  document.getElementById('mp-custom-cols')?.addEventListener('change', (e) => {
    state.mpCustomCols = Math.max(1, Math.min(5, parseInt((e.target as HTMLInputElement).value, 10) || 2));
    renderApp();
  });

  document.getElementById('mp-share-x')?.addEventListener('change', (e) => {
    state.mpShareX = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-share-y')?.addEventListener('change', (e) => {
    state.mpShareY = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-lettering')?.addEventListener('change', (e) => {
    state.mpAutoLettering = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-letter-pos')?.addEventListener('change', (e) => {
    state.mpLetterPos = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-legend-mode')?.addEventListener('change', (e) => {
    state.mpLegendMode = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-macro-x')?.addEventListener('input', (e) => {
    state.mpMacroX = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-macro-y')?.addEventListener('input', (e) => {
    state.mpMacroY = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });

  // MultiPlot Active Cell Selector Pills
  document.querySelectorAll('[data-mpcell]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-mpcell') || '0', 10);
      state.mpActivePanelIdx = idx;
      renderApp();
    });
  });

  // MultiPlot Import Full Canvas into Active Panel
  document.getElementById('mp-import-canvas')?.addEventListener('change', (e) => {
    const canvasName = (e.target as HTMLSelectElement).value;
    const proj = state.activeProject ? state.projectsStore[state.activeProject] : null;
    const cfg = proj?.canvases?.[canvasName];
    if (cfg) {
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      p.traces = JSON.parse(JSON.stringify(cfg.traces || []));
      p.yTitle = cfg.y1_title || p.traces[0]?.column || `Panel ${getPanelLetter(state.mpActivePanelIdx)}`;
      p.y2Title = cfg.y2_title || '';
      if (cfg.axis_scales?.y1) {
        p.y1Min = cfg.axis_scales.y1.min;
        p.y1Max = cfg.axis_scales.y1.max;
        p.y1Decimals = cfg.axis_scales.y1.decimals || 'auto';
        p.y1MajorStep = cfg.axis_scales.y1.majorStep;
        p.y1MinorStep = cfg.axis_scales.y1.minorStep;
      }
      renderApp();
    }
  });

  // Active Panel Title, Range, Decimals & Grid Step
  document.getElementById('mp-active-y1-title')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.yTitle = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-y2-title')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.y2Title = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-min')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    p.y1Min = raw === '' ? null : parseFloat(raw);
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-max')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    p.y1Max = raw === '' ? null : parseFloat(raw);
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-dec')?.addEventListener('change', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.y1Decimals = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-major')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    const num = parseFloat(raw);
    p.y1MajorStep = (!isNaN(num) && num > 0) ? num : null;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-minor')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    const num = parseFloat(raw);
    p.y1MinorStep = (!isNaN(num) && num > 0) ? num : null;
    if (p.y1MinorStep) state.gridFrame.showMinorGrid = true;
    updateMultiPlotChart();
  });

  document.getElementById('btn-mp-sync-all-scales')?.addEventListener('click', () => {
    const src = ensurePanelNormalized(state.mpActivePanelIdx);
    const dims = getMultiPlotDimensions();
    for (let i = 0; i < dims.count; i++) {
      const dst = ensurePanelNormalized(i);
      dst.y1Min = src.y1Min;
      dst.y1Max = src.y1Max;
      dst.y1Decimals = src.y1Decimals;
      dst.y1MajorStep = src.y1MajorStep;
      dst.y1MinorStep = src.y1MinorStep;
    }
    updateMultiPlotChart();
  });

  // Active Panel Multi-Trace Controls
  document.getElementById('btn-mp-add-trace')?.addEventListener('click', () => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const selEl = document.getElementById('sel-mp-new-trace-col') as HTMLSelectElement | null;
    const col = selEl?.value || state.dataset?.columns[1] || state.dataset?.columns[0] || '';
    const nextColor = DEFAULT_PALETTE[p.traces.length % DEFAULT_PALETTE.length];
    p.traces.push({
      column: col,
      axis: p.traces.length === 0 ? 'y1' : 'y2',
      chartType: 'line',
      color: nextColor,
      lineWidth: 1.9,
      lineDash: p.traces.length === 0 ? 'solid' : 'dash'
    });
    if (p.traces.length === 1 && (!p.yTitle || p.yTitle.startsWith('Panel'))) {
      p.yTitle = col;
    }
    renderApp();
  });

  document.querySelectorAll('.sel-mptrace-col').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].column = (e.target as HTMLSelectElement).value;
        if (tIdx === 0 && (!p.yTitle || p.yTitle.startsWith('Panel'))) {
          p.yTitle = p.traces[tIdx].column;
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-mptrace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      p.traces.splice(tIdx, 1);
      renderApp();
    });
  });

  document.querySelectorAll('.sel-mptrace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].axis = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mptrace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].chartType = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mptrace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].lineDash = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.inp-mptrace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].color = (e.target as HTMLInputElement).value;
        updateMultiPlotChart();
      }
    });
  });

  // MultiPlot Presets & Custom Dimensions
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

  document.getElementById('inp-mp-w')?.addEventListener('change', (e) => {
    state.mpWidthCm = parseFloat((e.target as HTMLInputElement).value) || 17.0;
    state.mpPreset = 'custom';
    updateMultiPlotChart();
  });
  document.getElementById('inp-mp-h')?.addEventListener('change', (e) => {
    state.mpHeightCm = parseFloat((e.target as HTMLInputElement).value) || 13.5;
    state.mpPreset = 'custom';
    updateMultiPlotChart();
  });

  // MultiPlot Save/Load
  document.getElementById('sel-multiplot')?.addEventListener('change', async (e) => {
    const mpName = (e.target as HTMLSelectElement).value;
    if (mpName && state.activeProject && state.projectsStore[state.activeProject]?.multiplots?.[mpName]) {
      const cfg = state.projectsStore[state.activeProject].multiplots![mpName];
      state.activeMultiPlot = cfg.name;
      state.mpTopology = cfg.topology;
      state.mpCustomRows = cfg.custom_rows || 2;
      state.mpCustomCols = cfg.custom_cols || 2;
      state.mpShareX = cfg.share_x;
      state.mpShareY = !!cfg.share_y;
      state.mpAutoLettering = cfg.auto_lettering;
      state.mpLetterPos = cfg.letter_pos || 'outside_top';
      state.mpLegendMode = cfg.legend_mode || 'per_panel';
      state.mpMacroX = cfg.macro_x_label || '';
      state.mpMacroY = cfg.macro_y_label || '';
      if (cfg.grid_frame) state.gridFrame = { ...cfg.grid_frame };
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
    const newName = prompt('Enter new MultiPlot name:', `MultiPlot_${Date.now().toString().slice(-3)}`);
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

  // Universal Export Button
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
    } else if (state.currentTab === 'physics') {
      Plotly.downloadImage('plotly-physics-chart', {
        format: 'svg',
        width: state.widthCm * 37.795,
        height: state.heightCm * 37.795,
        filename: `ChartMate_Physics_${state.physicsMode}`
      });
    } else if (state.currentTab === 'editorial') {
      Plotly.downloadImage('plotly-plate-chart', {
        format: 'svg',
        width: 17.0 * 37.795,
        height: 14.0 * 37.795,
        filename: `ChartMate_Journal_Plate_${state.editorialState.plateWidthPreset}`
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

  // Track 4: Rust Resampling & Smoothing Listeners
  document.getElementById('sel-resample-interval')?.addEventListener('change', (e) => {
    state.resampleInterval = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('sel-resample-agg')?.addEventListener('change', (e) => {
    state.resampleAgg = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('btn-resample-apply')?.addEventListener('click', async () => {
    const srcData = state.rawDatasetBackup || state.dataset;
    if (!srcData || srcData.columns.length === 0) return;
    try {
      const tsCol = state.timestampCol || srcData.columns[0];
      const resampled = await invoke<DatasetPreview>('resample_in_memory', {
        columns: srcData.columns,
        rows: srcData.rows,
        timestampCol: tsCol,
        interval: state.resampleInterval,
        aggMethod: state.resampleAgg
      });
      if (!state.rawDatasetBackup) {
        state.rawDatasetBackup = JSON.parse(JSON.stringify(srcData));
      }
      state.dataset = resampled;
      state.isResampled = true;
      renderApp();
    } catch (err) {
      alert(`Resampling error: ${err}`);
    }
  });
  document.getElementById('btn-resample-reset')?.addEventListener('click', () => {
    if (state.rawDatasetBackup) {
      state.dataset = JSON.parse(JSON.stringify(state.rawDatasetBackup));
      state.isResampled = false;
      renderApp();
    }
  });

  // Tab 5: Building Physics Mode Switcher
  document.querySelectorAll('[data-physmode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = (e.currentTarget as HTMLElement).getAttribute('data-physmode') as any;
      if (m) {
        state.physicsMode = m;
        renderApp();
      }
    });
  });

  // Track 1: Carpet Plot Listeners
  document.getElementById('phys-carpet-var')?.addEventListener('change', (e) => {
    state.carpetState.variableCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-agg')?.addEventListener('change', (e) => {
    state.carpetState.aggMethod = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-cscale')?.addEventListener('change', (e) => {
    state.carpetState.colorscale = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-filter')?.addEventListener('change', (e) => {
    state.carpetState.dayFilter = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-zmin')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.carpetState.zMin = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-zmax')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.carpetState.zMax = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-dec')?.addEventListener('change', (e) => {
    state.carpetState.decimals = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-contours')?.addEventListener('change', (e) => {
    state.carpetState.showContours = (e.target as HTMLInputElement).checked;
    renderApp();
  });
  document.getElementById('phys-carpet-cstep')?.addEventListener('input', (e) => {
    const num = parseFloat((e.target as HTMLInputElement).value);
    state.carpetState.contourStep = (!isNaN(num) && num > 0) ? num : null;
    updatePhysicsChart();
  });

  // Track 2: Thermal Comfort Listeners
  document.getElementById('phys-comfort-norm')?.addEventListener('change', (e) => {
    state.comfortState.normMode = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.getElementById('phys-comfort-intemp')?.addEventListener('change', (e) => {
    state.comfortState.indoorTempCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-outtemp')?.addEventListener('change', (e) => {
    state.comfortState.outdoorTempCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-rh')?.addEventListener('change', (e) => {
    state.comfortState.rhCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-trm')?.addEventListener('change', (e) => {
    state.comfortState.computeRunningMean = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });

  // Track 3: Duration Curve & Exceedance Listeners
  document.getElementById('phys-dur-var')?.addEventListener('change', (e) => {
    state.durationState.variableCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-cmp')?.addEventListener('change', (e) => {
    state.durationState.compareCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-xmode')?.addEventListener('change', (e) => {
    state.durationState.xMode = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-dt')?.addEventListener('input', (e) => {
    state.durationState.dtHours = parseFloat((e.target as HTMLInputElement).value) || 1.0;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-t1')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.durationState.threshold1 = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-t2')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.durationState.threshold2 = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-shade')?.addEventListener('change', (e) => {
    state.durationState.shadeExceedance = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });

  // Track 5: ASHRAE Guideline 14 Calibration Listeners
  document.getElementById('phys-cal-meas')?.addEventListener('change', (e) => {
    state.calibState.measuredCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-sim')?.addEventListener('change', (e) => {
    state.calibState.simulatedCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-view')?.addEventListener('change', (e) => {
    state.calibState.viewMode = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-std')?.addEventListener('change', (e) => {
    state.calibState.standard = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-box')?.addEventListener('change', (e) => {
    state.calibState.showBoxOnChart = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });

  // Track 6: Editorial & LaTeX Suite Listeners
  document.getElementById('ed-output-fmt')?.addEventListener('change', (e) => {
    state.editorialState.outputFormat = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.getElementById('ed-caption')?.addEventListener('input', (e) => {
    state.editorialState.caption = (e.target as HTMLInputElement).value;
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox && state.dataset) {
      const sr = computeVariableStats(state.dataset.columns, state.dataset.rows, state.editorialState);
      codeBox.value = generatePublicationTableCode(sr, state.editorialState);
    }
  });
  document.getElementById('ed-label-id')?.addEventListener('input', (e) => {
    state.editorialState.latexLabel = (e.target as HTMLInputElement).value;
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox && state.dataset) {
      const sr = computeVariableStats(state.dataset.columns, state.dataset.rows, state.editorialState);
      codeBox.value = generatePublicationTableCode(sr, state.editorialState);
    }
  });
  document.getElementById('ed-decimals')?.addEventListener('change', (e) => {
    state.editorialState.decimals = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.querySelectorAll('.ed-var-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        state.editorialState.variables[idx].selected = (e.target as HTMLInputElement).checked;
        renderApp();
      }
    });
  });
  document.querySelectorAll('.ed-var-unit').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        state.editorialState.variables[idx].unit = (e.target as HTMLInputElement).value;
        renderApp();
      }
    });
  });
  document.querySelectorAll('.ed-var-thresh').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        const raw = (e.target as HTMLInputElement).value.trim();
        state.editorialState.variables[idx].threshold = raw === '' ? null : parseFloat(raw);
        renderApp();
      }
    });
  });

  document.getElementById('btn-ed-copy-code')?.addEventListener('click', () => {
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox) {
      navigator.clipboard.writeText(codeBox.value);
      const btn = document.getElementById('btn-ed-copy-code');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      }
    }
  });

  document.getElementById('btn-ed-download-code')?.addEventListener('click', () => {
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (!codeBox) return;
    const ext = state.editorialState.outputFormat === 'latex' ? 'tex' : (state.editorialState.outputFormat === 'markdown' ? 'md' : 'tsv');
    const blob = new Blob([codeBox.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChartMate_Statistical_Table.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('ed-plate-preset')?.addEventListener('change', (e) => {
    state.editorialState.plateWidthPreset = (e.target as HTMLSelectElement).value as any;
    updateEditorialSuite();
  });
  document.getElementById('ed-plate-grid')?.addEventListener('change', (e) => {
    state.editorialState.plateGrid = (e.target as HTMLSelectElement).value as any;
    updateEditorialSuite();
  });
  document.getElementById('ed-plate-dpi')?.addEventListener('change', (e) => {
    state.editorialState.plateDpi = (parseInt((e.target as HTMLSelectElement).value, 10) === 300 ? 300 : 600);
  });
  document.querySelectorAll('.ed-plate-slot').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const sIdx = parseInt((e.target as HTMLElement).getAttribute('data-sidx') || '0', 10);
      state.editorialState.plateSlots[sIdx] = (e.target as HTMLSelectElement).value;
      updateEditorialSuite();
    });
  });

  document.getElementById('btn-ed-plate-svg')?.addEventListener('click', () => {
    const mm = state.editorialState.plateWidthPreset === 'single_85mm' ? 85 : (state.editorialState.plateWidthPreset === 'half_120mm' ? 120 : 170);
    Plotly.downloadImage('plotly-plate-chart', {
      format: 'svg',
      width: Math.round(mm * 3.7795 * 1.5),
      height: Math.round(mm * 0.85 * 3.7795 * 1.5),
      filename: `ChartMate_Composite_Plate_${mm}mm`
    });
  });

  document.getElementById('btn-ed-plate-png')?.addEventListener('click', () => {
    const mm = state.editorialState.plateWidthPreset === 'single_85mm' ? 85 : (state.editorialState.plateWidthPreset === 'half_120mm' ? 120 : 170);
    const scaleFactor = state.editorialState.plateDpi === 600 ? 4 : 2;
    Plotly.downloadImage('plotly-plate-chart', {
      format: 'png',
      width: Math.round(mm * 3.7795 * scaleFactor),
      height: Math.round(mm * 0.85 * 3.7795 * scaleFactor),
      filename: `ChartMate_Composite_Plate_${mm}mm_${state.editorialState.plateDpi}DPI`
    });
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

async function saveMultiPlot(mpName: string) {
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

async function saveMapConfig(mapName: string) {
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

function serializeCanvasConfig(name: string): CanvasConfig {
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

function applyCanvasConfig(cfg: CanvasConfig) {
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
    alert(`Error saving projects store: ${err}`);
  }
}

async function saveCurrentProject(projectName?: string) {
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

async function saveCanvas(canvasName: string) {
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
  // Always auto-detect Lat/Lon columns if missing or if resetCanvas is true
  const latCandidate = preview.columns.find(c => /(^lat|latitude|latitudine|y_coord|coord_y|gps_lat)/i.test(c.trim()));
  const lonCandidate = preview.columns.find(c => /(^lon|^lng|^long|longitude|longitudine|x_coord|coord_x|gps_lon)/i.test(c.trim()));
  if (latCandidate && (!state.geoLatCol || resetCanvas || !preview.columns.includes(state.geoLatCol))) {
    state.geoLatCol = latCandidate;
  }
  if (lonCandidate && (!state.geoLonCol || resetCanvas || !preview.columns.includes(state.geoLonCol))) {
    state.geoLonCol = lonCandidate;
  }

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

    // Initialize MultiPlot Panels with full multi-trace array
    for (let i = 0; i < 25; i++) {
      const col = nonAxisCols[i % Math.max(1, nonAxisCols.length)] || '';
      state.mpPanels[i] = {
        traces: [
          {
            column: col,
            axis: 'y1',
            chartType: i === 2 ? 'bar' : 'line',
            color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
            lineWidth: 1.9,
            lineDash: 'solid'
          }
        ],
        yTitle: col || `Panel ${getPanelLetter(i)}`,
        y2Title: '',
        y1Min: null,
        y1Max: null,
        y1Decimals: 'auto',
        y1MajorStep: null,
        y1MinorStep: null
      };
    }

    // Initialize Building Physics & Editorial Suite defaults from dataset columns
    const cols = preview.columns;
    const findCol = (regex: RegExp, fallbackIdx: number = 0) =>
      cols.find(c => regex.test(c)) || nonAxisCols[fallbackIdx] || cols[0] || '';

    state.carpetState.variableCol = findCol(/(indoor_temp|temp|t_op|t_in|co2|power)/i, 0);
    state.comfortState.indoorTempCol = findCol(/(indoor_temp|t_in|t_op|temp)/i, 0);
    state.comfortState.outdoorTempCol = findCol(/(outdoor_temp|t_out|t_ext|trm)/i, 1);
    state.comfortState.rhCol = findCol(/(^rh|humidity|umid)/i, 2);

    state.durationState.variableCol = findCol(/(indoor_temp|co2|power|temp)/i, 0);
    state.durationState.compareCol = cols.find(c => /(sim_indoor_temp|sim_power|outdoor_temp)/i.test(c)) || '';

    state.calibState.measuredCol = findCol(/(^indoor_temp|^power_kw|measured)/i, 0);
    state.calibState.simulatedCol = findCol(/(sim_indoor_temp|sim_power|simulated|pred)/i, 1);

    // Populate Editorial Table Variables
    state.editorialState.variables = nonAxisCols
      .filter(c => !/(zone|name|id|label)/i.test(c))
      .map(c => {
        const cl = c.toLowerCase();
        let unit = '-';
        let threshold: number | null = null;
        if (cl.includes('temp')) {
          unit = '°C';
          threshold = cl.includes('out') ? null : 26.0;
        } else if (cl.includes('rh') || cl.includes('hum')) {
          unit = '%';
          threshold = 70.0;
        } else if (cl.includes('co2')) {
          unit = 'ppm';
          threshold = 1000;
        } else if (cl.includes('power') || cl.includes('kw')) {
          unit = 'kW';
          threshold = 6.0;
        }
        return {
          column: c,
          selected: true,
          unit,
          threshold
        };
      });

    state.editorialState.plateSlots = [
      nonAxisCols[0] || '',
      nonAxisCols[1] || nonAxisCols[0] || '',
      nonAxisCols[2] || nonAxisCols[0] || '',
      nonAxisCols[3] || nonAxisCols[0] || ''
    ];
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
    state.rawDatasetBackup = JSON.parse(JSON.stringify(preview));
    state.isResampled = false;
    applyDatasetMetadata(preview, resetCanvas);

    renderApp();
  } catch (err) {
    alert(`Error reading local file: ${err}`);
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

function getTickFormat(decimals?: 'auto' | '0' | '1' | '2' | '3'): string | undefined {
  if (!decimals || decimals === 'auto') return undefined;
  return `.${decimals}f`;
}

function formatNumberWithDecimals(val: number, decimals?: 'auto' | '0' | '1' | '2' | '3'): string {
  if (!decimals || decimals === 'auto') {
    return Number.isInteger(val) ? String(val) : val.toFixed(2);
  }
  return val.toFixed(parseInt(decimals, 10));
}

function buildAxisStyle(
  titleText: string,
  color: string,
  scaleCfg: AxisScaleConfig | undefined,
  isXAxis: boolean = false
): any {
  const gf = state.gridFrame;
  const showLine = gf.frameMode !== 'none';
  const mirrorVal: any = gf.frameMode === 'box' ? true : (gf.frameMode === 'ticks' ? 'ticks' : false);
  const ticksVal = gf.tickDir === 'none' ? '' : gf.tickDir;

  const axObj: any = {
    title: { text: titleText, font: { size: state.fontSize + 1, color, weight: 600 } },
    showgrid: isXAxis ? gf.showXGrid : gf.showYGrid,
    gridcolor: gf.majorGridColor || '#cbd5e1',
    gridwidth: 1.0,
    zeroline: gf.showZeroLine,
    zerolinecolor: '#94a3b8',
    zerolinewidth: 1.1,
    showline: showLine,
    linecolor: color,
    linewidth: 1.2,
    mirror: mirrorVal,
    ticks: ticksVal,
    ticklen: gf.tickDir === 'none' ? 0 : 4,
    tickcolor: color,
    tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color }
  };

  if (!isXAxis && scaleCfg) {
    const tf = getTickFormat(scaleCfg.decimals);
    if (tf) axObj.tickformat = tf;

    if (scaleCfg.min !== null && scaleCfg.min !== undefined && !isNaN(scaleCfg.min) &&
        scaleCfg.max !== null && scaleCfg.max !== undefined && !isNaN(scaleCfg.max)) {
      axObj.range = [scaleCfg.min, scaleCfg.max];
      axObj.autorange = false;
    }

    if (scaleCfg.majorStep && scaleCfg.majorStep > 0) {
      axObj.dtick = scaleCfg.majorStep;
    }

    if (gf.showMinorGrid || (scaleCfg.minorStep && scaleCfg.minorStep > 0)) {
      axObj.minor = {
        showgrid: true,
        gridcolor: gf.minorGridColor || '#f1f5f9',
        gridwidth: 0.6,
        dtick: (scaleCfg.minorStep && scaleCfg.minorStep > 0) ? scaleCfg.minorStep : undefined
      };
    }
  }

  return axObj;
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

    state.traces.forEach((tr) => {
      const yIdx = state.dataset!.columns.indexOf(tr.column);
      if (yIdx === -1) return;

      const yVals = activeRows.map(r => parseNumericValue(r[yIdx]));
      const decCfg = state.axisScales[tr.axis]?.decimals || 'auto';
      const hoverFmt = decCfg === 'auto' ? '' : `:.${decCfg}f`;

      let pType = 'scatter';
      let pMode: string | undefined = 'lines';
      let pFill: string | undefined = undefined;

      if (tr.chartType === 'line') {
        pType = 'scatter';
        pMode = 'lines';
      } else if (tr.chartType === 'scatter') {
        pType = 'scatter';
        pMode = 'markers';
      } else if (tr.chartType === 'area') {
        pType = 'scatter';
        pMode = 'lines';
        pFill = 'tozeroy';
      } else if (tr.chartType === 'bar') {
        pType = 'bar';
        pMode = undefined;
      }

      const traceObj: any = {
        x: xVals,
        y: yVals,
        name: tr.column,
        yaxis: tr.axis === 'y1' ? 'y' : tr.axis,
        type: pType,
        mode: pMode,
        fill: pFill,
        line: { color: tr.color, width: tr.lineWidth, dash: tr.lineDash },
        marker: { size: 5, color: tr.color },
        hovertemplate: `%{x}<br><b>${tr.column}</b>: %{y${hoverFmt}}<extra></extra>`
      };

      if (tr.chartType === 'bar') {
        traceObj.marker = { color: tr.color, opacity: 0.85 };
        delete traceObj.mode;
        delete traceObj.line;
      }

      traces.push(traceObj);

      if (state.peakMode !== 'none' && yVals.length > 0 && tr.axis === 'y1') {
        calculatePeakAnnotations(xVals, yVals, state.peakMode, annotations, 'y', decCfg);
      }
    });

    if (traces.length === 0) {
      annotations.push({
        text: t('no_traces_msg'),
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: { size: 13, color: '#64748b' }
      });
    }
  } else {
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

  const hasY2 = state.traces.some(tr => tr.axis === 'y2');
  const hasY3 = state.traces.some(tr => tr.axis === 'y3');
  const hasY4 = state.traces.some(tr => tr.axis === 'y4');

  let rightMargin = state.legendPos === 'right' ? 140 : 35;
  if (hasY4) rightMargin = Math.max(rightMargin, 155);
  else if (hasY3) rightMargin = Math.max(rightMargin, 115);
  else if (hasY2) rightMargin = Math.max(rightMargin, 70);

  let legendObj: any = {
    orientation: 'h',
    x: 0.5,
    y: 1.12,
    xanchor: 'center',
    font: { size: state.fontSize - 1, color: '#000000' }
  };
  if (state.legendPos === 'right') {
    legendObj = { orientation: 'v', x: 1.03, y: 1, xanchor: 'left', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.legendPos === 'bottom') {
    legendObj = { orientation: 'h', x: 0.5, y: -0.22, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.legendPos === 'inside') {
    legendObj = { orientation: 'v', x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top', bgcolor: 'rgba(255,255,255,0.85)', bordercolor: '#cbd5e1', borderwidth: 1, font: { size: state.fontSize - 1, color: '#000000' } };
  }

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 65, r: rightMargin, t: state.legendPos === 'top' ? 42 : 25, b: state.legendPos === 'bottom' ? 75 : 52 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    showlegend: state.legendPos !== 'none',
    legend: legendObj,
    annotations,
    xaxis: buildAxisStyle(state.xTitle || state.selectedX || 'Time / Parameter', '#000000', undefined, true),
    yaxis: buildAxisStyle(state.y1Title || 'Primary Y1', '#000000', state.axisScales.y1, false),
    shapes: []
  };

  if (hasY2) {
    layout.yaxis2 = {
      ...buildAxisStyle(state.y2Title || 'Y2 Axis', '#0284c7', state.axisScales.y2, false),
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      mirror: false
    };
  }

  if (hasY3) {
    layout.yaxis3 = {
      ...buildAxisStyle(state.y3Title || 'Y3 Axis', '#d97706', state.axisScales.y3, false),
      overlaying: 'y',
      side: 'right',
      position: 0.93,
      showgrid: false,
      mirror: false
    };
  }

  if (hasY4) {
    layout.yaxis4 = {
      ...buildAxisStyle(state.y4Title || 'Y4 Axis', '#7c3aed', state.axisScales.y4, false),
      overlaying: 'y',
      side: 'right',
      position: 0.86,
      showgrid: false,
      mirror: false
    };
  }

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
    pxW = 700;
    pxH = 700;
  }

  const { rows, cols, count: panelCount } = getMultiPlotDimensions();

  const traces: any[] = [];
  const annotations: any[] = [];
  const topMargin = state.mpMacroX ? 65 : 48;
  const leftMargin = state.mpMacroY ? 85 : 65;

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: leftMargin, r: 55, t: topMargin, b: state.mpLegendMode === 'global_bottom' ? 75 : 55 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    showlegend: state.mpLegendMode !== 'none',
    annotations
  };

  if (state.mpLegendMode === 'global_top') {
    layout.legend = { orientation: 'h', x: 0.5, y: 1.07, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.mpLegendMode === 'global_bottom') {
    layout.legend = { orientation: 'h', x: 0.5, y: -0.15, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  }

  let xVals: any[] = [];
  const activeRows = state.dataset?.rows || [];
  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    if (xIdx !== -1) {
      xVals = activeRows.map(r => r[xIdx]);
    }
  }
  if (xVals.length === 0) {
    xVals = Array.from({ length: 24 }, (_, i) => `2026-09-01 ${String(i).padStart(2, '0')}:00`);
  }

  const vGap = rows >= 4 ? 0.06 : (rows === 3 ? 0.08 : (rows === 2 ? 0.12 : 0));
  const hGap = cols >= 4 ? 0.06 : (cols === 3 ? 0.08 : (cols === 2 ? 0.11 : 0));
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
    const letter = getPanelLetter(i);

    const pCfg = ensurePanelNormalized(i);
    const isBottomRow = rIdx === rows - 1;
    const hideXTicks = state.mpShareX && !isBottomRow;

    const pScale: AxisScaleConfig = {
      title: pCfg.yTitle || pCfg.traces[0]?.column || `Panel ${letter}`,
      min: pCfg.y1Min,
      max: pCfg.y1Max,
      decimals: pCfg.y1Decimals || 'auto',
      majorStep: pCfg.y1MajorStep,
      minorStep: pCfg.y1MinorStep
    };

    layout[xAxisName] = {
      ...buildAxisStyle(isBottomRow ? (state.xTitle || state.selectedX || 'Time') : '', '#000000', undefined, true),
      domain: [xDom0, xDom1],
      anchor: yRef,
      showticklabels: !hideXTicks
    };
    if (state.mpShareX && i > 0) {
      layout[xAxisName].matches = 'x';
    }

    const hasPanelY2 = pCfg.traces.some(tr => tr.axis === 'y2');
    layout[yAxisName] = {
      ...buildAxisStyle(pScale.title, '#000000', pScale, false),
      domain: [yDom0, yDom1],
      anchor: xRef
    };
    if (hasPanelY2) {
      layout[yAxisName].mirror = false;
    }
    if (state.mpShareY && cIdx > 0) {
      const rowFirstAx = rIdx * cols === 0 ? 'y' : `y${rIdx * cols + 1}`;
      layout[yAxisName].matches = rowFirstAx;
    }

    // Per-Panel Individual Legend placement (legend, legend2, legend3...)
    const legName = i === 0 ? 'legend' : `legend${i + 1}`;
    if (state.mpLegendMode === 'per_panel') {
      layout[legName] = {
        x: xDom1,
        y: yDom1 + 0.005,
        xanchor: 'right',
        yanchor: 'bottom',
        orientation: 'h',
        bgcolor: 'rgba(255,255,255,0.75)',
        font: { family: state.fontFamily, size: Math.max(8, state.fontSize - 2), color: '#000000' }
      };
    }

    // Secondary Y2 Axis in this Panel if any trace uses y2
    const y2AxisId = i + 30;
    const y2Ref = `y${y2AxisId}`;
    if (hasPanelY2) {
      const y2Trace = pCfg.traces.find(tr => tr.axis === 'y2');
      const y2Color = y2Trace?.color || '#0284c7';
      layout[`yaxis${y2AxisId}`] = {
        ...buildAxisStyle(pCfg.y2Title || y2Trace?.column || 'Y2', y2Color, undefined, false),
        domain: [yDom0, yDom1],
        anchor: xRef,
        overlaying: yRef,
        side: 'right',
        showgrid: false,
        mirror: false
      };
    }

    // Render all traces in this panel
    if (pCfg.traces.length > 0 && state.dataset) {
      pCfg.traces.forEach((tr) => {
        const yIdx = state.dataset!.columns.indexOf(tr.column);
        const yVals = yIdx !== -1
          ? activeRows.map(r => parseNumericValue(r[yIdx]))
          : xVals.map((_, k) => 20 + (i + 1) * 2 * Math.sin((k + i * 3) / 3));

        const decCfg = pCfg.y1Decimals || 'auto';
        const hoverFmt = decCfg === 'auto' ? '' : `:.${decCfg}f`;

        traces.push({
          x: xVals,
          y: yVals,
          name: state.mpLegendMode === 'per_panel' ? (tr.column || `Series`) : `${letter} ${tr.column || pCfg.yTitle}`,
          xaxis: xRef,
          yaxis: tr.axis === 'y2' ? y2Ref : yRef,
          legend: state.mpLegendMode === 'per_panel' ? legName : 'legend',
          type: tr.chartType === 'bar' ? 'bar' : 'scatter',
          mode: tr.chartType === 'scatter' ? 'markers' : (tr.chartType === 'bar' ? undefined : 'lines'),
          fill: tr.chartType === 'area' ? 'tozeroy' : undefined,
          line: { color: tr.color, width: tr.lineWidth || 1.8, dash: tr.lineDash || 'solid' },
          marker: { color: tr.color, size: 4 },
          hovertemplate: `%{x}<br><b>${tr.column || letter}</b>: %{y${hoverFmt}}<extra></extra>`
        });
      });
    } else {
      // Demo fallback trace for empty panel
      const demoY = xVals.map((_, k) => 20 + (i + 1) * 2 * Math.sin((k + i * 3) / 3));
      traces.push({
        x: xVals,
        y: demoY,
        name: `${letter} Demo`,
        xaxis: xRef,
        yaxis: yRef,
        legend: state.mpLegendMode === 'per_panel' ? legName : 'legend',
        type: 'scatter',
        mode: 'lines',
        line: { color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], width: 1.8 }
      });
    }

    // External Academic Lettering (a), (b), (c)...
    if (state.mpAutoLettering) {
      let lx = xDom0;
      let ly = yDom1 + 0.008;
      let xAnc: 'left' | 'right' = 'left';
      let yAnc: 'bottom' | 'top' = 'bottom';

      if (state.mpLetterPos === 'outside_side') {
        lx = Math.max(0, xDom0 - 0.02);
        ly = yDom1;
        xAnc = 'right';
        yAnc = 'top';
      } else if (state.mpLetterPos === 'inside') {
        lx = xDom0 + 0.012;
        ly = yDom1 - 0.018;
        xAnc = 'left';
        yAnc = 'top';
      }

      annotations.push({
        text: `<b>${letter}</b>`,
        xref: 'paper',
        yref: 'paper',
        x: lx,
        y: ly,
        xanchor: xAnc,
        yanchor: yAnc,
        showarrow: false,
        font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
      });
    }
  }

  // Outer Matrix Macro-Axes (Super-Labels for parametric R×C matrices)
  if (state.mpMacroX) {
    annotations.push({
      text: `<b>${state.mpMacroX}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: 0.5,
      y: 1.06,
      xanchor: 'center',
      yanchor: 'bottom',
      showarrow: false,
      font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
    });
  }

  if (state.mpMacroY) {
    annotations.push({
      text: `<b>${state.mpMacroY}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: -0.09,
      y: 0.5,
      xanchor: 'center',
      yanchor: 'middle',
      textangle: -90,
      showarrow: false,
      font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function computeMathematicalAggregation(
  values: number[],
  rawStrings: string[],
  agg: string,
  decimals: 'auto' | '0' | '1' | '2' | '3'
): { val: number; label: string } {
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
    return { val: numVal, label: `Mo: ${bestKey} (${bestCount}×)` };
  }

  if (values.length === 0) return { val: 0, label: 'N/A' };

  if (agg === 'sum') {
    const s = values.reduce((a, b) => a + b, 0);
    return { val: s, label: `Σ = ${formatNumberWithDecimals(s, decimals)}` };
  }
  if (agg === 'max') {
    const m = Math.max(...values);
    return { val: m, label: `Max = ${formatNumberWithDecimals(m, decimals)}` };
  }
  if (agg === 'min') {
    const m = Math.min(...values);
    return { val: m, label: `Min = ${formatNumberWithDecimals(m, decimals)}` };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { val: mean, label: `μ = ${formatNumberWithDecimals(mean, decimals)}` };
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
  const sizes: number[] = [];
  const hoverTexts: string[] = [];
  let validRawGps = 0;

  if (state.dataset && (!state.geoLatCol || !state.geoLonCol)) {
    applyDatasetMetadata(state.dataset, false);
  }

  if (state.dataset && state.geoLatCol && state.geoLonCol) {
    const latIdx = state.dataset.columns.indexOf(state.geoLatCol);
    const lonIdx = state.dataset.columns.indexOf(state.geoLonCol);
    const colIdx = state.mapColorCol ? state.dataset.columns.indexOf(state.mapColorCol) : -1;
    const sizeIdx = state.mapSizeCol ? state.dataset.columns.indexOf(state.mapSizeCol) : -1;

    if (latIdx !== -1 && lonIdx !== -1) {
      if (state.mapClusterEnabled) {
        const grid = state.mapClusterGridDeg || 0.002;
        const bins: Record<string, { lats: number[]; lons: number[]; nums: number[]; raws: string[] }> = {};

        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
          validRawGps++;

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
          const aggRes = computeMathematicalAggregation(b.nums, b.raws, state.mapClusterAgg, state.mapDecimals);

          lats.push(cLat);
          lons.push(cLon);
          vals.push(aggRes.val);
          sizes.push(Math.min(28, 12 + Math.log2(b.lats.length + 1) * 4));
          hoverTexts.push(
            `<b>Cluster (${b.lats.length} pts)</b><br>Lat: ${cLat.toFixed(4)}, Lon: ${cLon.toFixed(4)}<br>${state.mapColorCol || 'Metric'}: <b>${aggRes.label}</b>`
          );
        });

        state.mapValidGpsCount = validRawGps;
        state.mapLastClusterCount = lats.length;
        state.mapLastSummaryStat = `${state.mapClusterAgg.toUpperCase()} · ${lats.length} clusters (${validRawGps} pts)`;
      } else {
        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
          validRawGps++;

          const num = colIdx !== -1 ? (parseNumericValue(r[colIdx]) ?? 0) : 1;
          const sz = sizeIdx !== -1 ? Math.max(6, Math.min(26, parseNumericValue(r[sizeIdx]) ?? 11)) : 11;
          lats.push(lat);
          lons.push(lon);
          vals.push(num);
          sizes.push(sz);
          hoverTexts.push(
            `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}<br>${state.mapColorCol || 'Value'}: <b>${formatNumberWithDecimals(num, state.mapDecimals)}</b>`
          );
        }
        state.mapValidGpsCount = validRawGps;
        state.mapLastClusterCount = validRawGps;
        state.mapLastSummaryStat = `Raw · ${validRawGps} GPS pts`;
      }
    }
  }

  const cntEl = document.getElementById('lbl-cluster-count');
  const stEl = document.getElementById('lbl-cluster-stat');
  if (cntEl) cntEl.textContent = String(state.mapClusterEnabled ? state.mapLastClusterCount : state.mapValidGpsCount);
  if (stEl) stEl.textContent = state.mapLastSummaryStat || 'Ready';

  // Fallback Demo Geo Data ONLY when no dataset is loaded
  if (lats.length === 0 && !state.dataset) {
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
      sizes.push(12);
      hoverTexts.push(`Demo Sensor<br>Lat: ${la}, Lon: ${lo}<br>Value: <b>${v} °C</b>`);
    }
  }

  const minLat = lats.length > 0 ? Math.min(...lats) : 45.478;
  const maxLat = lats.length > 0 ? Math.max(...lats) : 45.482;
  const minLon = lons.length > 0 ? Math.min(...lons) : 9.225;
  const maxLon = lons.length > 0 ? Math.max(...lons) : 9.232;
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const maxSpan = Math.max(maxLat - minLat, maxLon - minLon, 0.002);
  let zoom = Math.floor(Math.log2(360 / maxSpan)) - 1;
  zoom = Math.max(1, Math.min(16, zoom));

  const cbTickFmt = getTickFormat(state.mapDecimals);
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
        tickformat: cbTickFmt,
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
          tickformat: cbTickFmt,
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'GPS Track'
    });
  } else {
    traces.push({
      type: 'scattermapbox',
      mode: 'markers',
      lat: lats,
      lon: lons,
      marker: {
        size: sizes.length > 0 ? sizes : 12,
        opacity: 0.9,
        color: vals,
        colorscale: state.mapColorscale,
        showscale: true,
        colorbar: {
          title: { text: `${state.mapColorCol || 'Metric'} (${state.mapClusterEnabled ? state.mapClusterAgg.toUpperCase() : 'Raw'})`, font: { size: state.fontSize, color: '#000000' } },
          tickformat: cbTickFmt,
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'Geo Points'
    });
  }

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
    mapboxCfg.style = state.mapBasemap;
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

function calculatePeakAnnotations(
  xVals: any[],
  yVals: (number | null)[],
  mode: string,
  annotations: any[],
  yref: string,
  decimals: 'auto' | '0' | '1' | '2' | '3' = 'auto'
) {
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
        yref,
        text: `🔴 Max: ${formatNumberWithDecimals(maxVal, decimals)}`,
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
        yref,
        text: `🔵 Min: ${formatNumberWithDecimals(minVal, decimals)}`,
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
        yref,
        text: formatNumberWithDecimals(g.maxVal, decimals),
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
        yref,
        text: formatNumberWithDecimals(g.minVal, decimals),
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#0284c7',
        font: { size: 9, color: '#0284c7', family: 'JetBrains Mono, monospace' }
      });
    });
  }
}

async function initApp() {
  await fetchProjectsStore();
  renderApp();
}

initApp();
