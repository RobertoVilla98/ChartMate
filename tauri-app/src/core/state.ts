import { I18N } from '../i18n';
import type { AppState, MultiPlotPanelConfig } from './types';

export const DEFAULT_PALETTE = ['#000000', '#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48'];

export function createDefaultPanels(count: number = 25): MultiPlotPanelConfig[] {
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

export const state: AppState = {
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
    undercoolPct: 0,
    outOfRangeHours: 0,
    trmSource: 'running_mean'
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
    monthlyPass: true,
    periods: 0
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

export function t(key: string): string {
  return I18N[state.lang]?.[key] || I18N.en[key] || key;
}

export const PRESETS = {
  single: { w: 8.5, h: 6.5 },
  double: { w: 17.0, h: 9.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 9.5 }
};

export const MP_PRESETS = {
  single_stack: { w: 8.5, h: 11.5 },
  double_stack: { w: 17.0, h: 13.5 },
  square_grid: { w: 14.0, h: 14.0 },
  custom: { w: 17.0, h: 13.5 }
};

export const MAP_PRESETS = {
  single: { w: 8.5, h: 7.5 },
  double: { w: 17.0, h: 10.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 10.5 }
};
