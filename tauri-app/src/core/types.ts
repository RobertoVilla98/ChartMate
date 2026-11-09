import type { ColumnData } from '../data/table';
import type { Lang } from '../i18n';
import type { CarpetPlotState, ThermalComfortState, ComfortKpiSummary, DurationCurveState, DurationKpiSummary, CalibrationState, CalibrationMetrics, EditorialSuiteState } from '../scientific_modules';

export interface DatasetPreview {
  /** Back-end cache id of the raw dataset (re-sampling runs there, without resending the data). */
  id?: number;
  columns: string[];
  /** Typed columns (v0.3 binary transfer). When present, `rows` is a lazily built text view. */
  colData?: ColumnData[];
  n_rows?: number;
  rows: string[][];
  total_rows: number;
  detected_sep: string;
  suggested_ts_col?: string;
  suggested_ts_format?: string;
  /** True when the reader stopped at row_limit before the end of the file. */
  truncated?: boolean;
  row_limit?: number;
  /** Reader notes (skipped variables, unsupported features, truncation). */
  notes?: string[];
  /** Read + parse time in the Rust back end, ms. */
  parse_ms?: number;
}

/** Timing of the last load, shown in the data panel. */
export interface LoadTiming {
  parseMs: number;
  /** invoke() round trip: parse + JSON serialisation + IPC + deserialisation. */
  totalMs: number;
  rows: number;
  /** Last chart render (Plotly.react) time, ms. */
  renderMs?: number;
  renderPoints?: number;
}

export interface ParseOptions {
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

export interface CanvasConfig {
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

export interface SqlConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

export interface SqlConnectionStatus {
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

export interface MultiPlotConfig {
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

export interface MapConfig {
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

export interface ProjectConfig {
  name: string;
  lang?: Lang;
  source_type?: 'file' | 'sql';
  file_path: string;
  /** Size and SHA-256 of the data file when the project was saved. */
  data_fingerprint?: { size: number; sha256: string };
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

export type ProjectsStore = Record<string, ProjectConfig>;

export interface AppState {
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
  /** Timing of the last file load and chart render. */
  loadTiming: LoadTiming | null;
  renderTiming: { renderMs: number; points: number } | null;
  /** Min-max decimation of long line traces (on by default). */
  decimateLargeSeries: boolean;
  decimationInfo: string;
  /** Row limit sent to the reader (default 500 000). */
  rowLimit: number;
  dataFingerprint: { size: number; sha256: string } | null;

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
