# ChartMate — Project Status & Milestone Log

## 🎯 Current Release Status: **v0.2.0 Complete 6-Tab Scientific & Building Physics Studio**
- **Executable Targets**: `ChartMate.exe` and `ChartMate-v0.2-windows-x64.exe` (Compiled & Verified).
- **Automated Test Suite**:
  - Rust Backend (`cargo test --lib`): **3/3 unit tests passed** (`test_civil_roundtrip`, `test_timestamp_parsing_and_resampling`, `test_ashrae_calibration_metrics`).
  - TypeScript & Scientific Modules (`tsc && vite build` + Node E2E verification on `sample_building_data.csv` 336h dataset): **5/5 tracks passed**.

---

## ✅ Completed Milestones

### Milestone 1 — Native Tauri v2 + Rust Core & Multi-Source Data Engine (Tab 1)
- [x] High-speed native Rust file parser (`parquet`, `calamine` for Excel `.xlsx/.xls`, `csv`/TSV).
- [x] Direct MySQL database connector (`test_sql_connection`, `execute_sql_query`).
- [x] **Track 4 — Native Rust Time-Series Resampling & Denoising (`resample_in_memory`, `resample_timeseries`)**:
  - Intervals: `1m`, `5m`, `15m`, `30m`, `1h`, `6h`, `1d`.
  - Aggregators: `mean`, `median`, `max`, `min`, `p5`, `p95`, `sum` with 1-click non-destructive reset to raw rows.

### Milestone 2 — Bilingual Architecture & Single Canvas Studio (Tab 2)
- [x] Full bilingual dictionary (`tauri-app/src/i18n.ts`) with **English (`EN`) default** and instant `[ EN | IT ]` switcher.
- [x] 4 progressive anti-clutter sidebar sub-tabs (`1. Traces`, `2. Axes & Scale`, `3. Grid & Frame`, `4. Style & Notes`).
- [x] Up to 4 independent Y-axes ($Y_1 - Y_4$) with custom `[Min, Max]` domain locking and decimal precision (`Auto`, `0`, `1`, `2`, `3`).
- [x] Major (`dtick`) & Minor internal (`minor.dtick`) gridlines and 4 Chart Frame Modes (`open_l`, `box`, `ticks`, `none`).

### Milestone 3 — MultiPlot Parallel Studio (Tab 3) & GIS Maps Studio (Tab 4)
- [x] Standard presets (`3×1`, `2×1`, `2×2`, `1×2`) + **Custom $R \times C$ Matrix** ($1\dots 5 \times 1\dots 5$).
- [x] Multi-trace per subplot panel, 1-click import from saved Single Canvases, external academic lettering `(a)`, `(b)`, `(c)`..., per-panel vs global legends, and outer macro-axes.
- [x] Maps & Geo-Analytics Studio with direct dataset loader, GPS coordinate validation badge, 5 basemaps, and spatial grid clustering ($\mu, \Sigma, Mo, \text{Max}, \text{Min}, N$).

### Milestone 4 — Building Physics & IEQ Studio (Tab 5: Tracks 1, 2, 3, 5)
- [x] **Track 1 — Carpet Plot / Temporal Heatmap (`Day × Hour 0–23h`)**:
  - 2D matrix binning (`mean`, `max`, `min`), 6 scientific colorscales (*Viridis*, *Plasma*, *Thermal*, *Turbo*, *Emerald*, *RdBu*), customizable iso-contours ($\Delta Z$), and calendar filtering (*All Days*, *Weekdays*, *Weekends*).
- [x] **Track 2 — Bioclimatic & Adaptive Thermal Comfort (`EN 16798-1` & `ASHRAE 55`)**:
  - EN 16798-1:2019 Cat. I/II/III adaptive comfort with exponential running mean $T_{rm}$, ASHRAE 55-2023 80%/90% limits, and Psychrometric $T\text{-}RH$ chart with Winter/Summer polygons and $W = 12\text{ g/kg}_{da}$ curve.
- [x] **Track 3 — Duration Curves & Exceedance Analyzer (`LDC`)**:
  - Descending duration curve over hours or % time, comparison series, primary & critical thresholds, shaded exceedance area, and cumulative exposure dose integral $I_{exc}$.
- [x] **Track 5 — ASHRAE Guideline 14 Calibration & Parity View**:
  - Automated $\text{NMBE}$, $\text{CV(RMSE)}$, $R^2$, $\text{RMSE}$, and $\text{MAE}$ with ASHRAE G14 Hourly & Monthly pass/fail compliance badges, Time-Series + Residual subplot, and 1:1 Parity plot.

### Milestone 5 — Editorial & LaTeX Publication Suite (Tab 6: Track 6) & Repo Hygiene (Track 7)
- [x] **Track 6 — Automated Statistical Summary & Composite Figure Plate Compiler**:
  - Multi-variable descriptive statistics ($N, \mu, \sigma, \text{Min}, P_{25}, P_{50}, P_{75}, P_{95}, \text{Max}, \text{IQR}$, exceedance hours & dose) exported in **LaTeX (`booktabs`)**, **GitHub Markdown**, and **Word/Excel TSV**.
  - Vector Composite Figure Plate compiler calibrated to **$85\text{ mm}$ Single Column**, **$120\text{ mm}$ 1.5 Column**, and **$170\text{ mm}$ Double Column** at **$300\text{ / }600\text{ DPI}$**.
- [x] **Track 7 — Repository Hygiene & Clean Root**:
  - Excluded internal AI files (`AGENTS.md`, `GEMINI.md`, `ChartMate_Structure.txt`) from Git tracking via `.gitignore` while maintaining them on local disk.
  - Isolated legacy Python files into `legacy-python-dash/` and cleaned up intermediate binaries.
- [x] **Hotfix — Windows MinGW WebView2Loader.dll Runtime Resolution**:
  - Added `WebView2Loader.dll` (160 KB) alongside `ChartMate.exe` and `ChartMate-v0.2-windows-x64.exe` to resolve Windows dynamic linking under MinGW.
  - Created complete portable zip package `ChartMate-v0.2-windows-x64.zip` (~11 MB) containing binary, DLL, and sample dataset.
  - Verified process startup and active responsive state (`Running: True, Responding: True`).

### Fix — Scientific Correctness of Adaptive Comfort $T_{rm}$ (2026-11-05)
- [x] **Running mean computed on daily means**: $T_{rm}(d) = (1-\alpha)\,\Theta_{ed}(d-1) + \alpha\,T_{rm}(d-1)$ on daily mean outdoor temperatures (EN 16798-1:2019 Annex B; exponentially weighted prevailing mean for ASHRAE 55-2023). Previously the recurrence was applied sample-by-sample (hourly), shrinking the memory from ~5 days to ~5 hours.
  - New exported helper `computeDailyRunningMean` in `scientific_modules.ts`; first day seeded with its own mean (warm-up), missing calendar days carried forward.
  - `buildThermalComfortFigure` now takes the timestamp column; without parseable timestamps it plots nothing and shows a warning KPI chip instead of a misleading result.
- [x] **Model applicability ranges**: EN 16798-1 $T_{rm} \in [10, 30]\,^\circ$C, ASHRAE 55 $T_{pma(out)} \in [10, 33.5]\,^\circ$C. Samples outside are plotted as grey crosses and excluded from category percentages (new KPI `outOfRangeHours`).
- [x] Verified: `tsc && vite build` OK; Node check against an independent daily-mean reference on `sample_building_data.csv` (336 h, 14 days) — all points match, KPIs consistent.

### Maintenance — Cleanup, Modular Frontend, G14 Fix & Cross-Platform Packaging (2026-11-05)
- [x] **Cleanup**: removed Vite template leftovers (`counter.ts`, `src/assets/*`, `public/*.svg`) and unused npm dependencies `xlsx` (vulnerable 0.18.5), `papaparse`, `@types/papaparse` (Excel/CSV parsing is done in Rust); `npm audit` → 0 vulnerabilities. README links point to `RobertoVilla98/ChartMate`; stale Stamen basemap mention replaced by the actual providers.
- [x] **Modular frontend**: `main.ts` (5,300 lines) split into `core/` (types, state, panels), `ui/` (render modules), `events/` (9 listener modules + index), `charts/` (single canvas, MultiPlot, map, physics, utils), `data/` (loader, persistence). No behavioural change; verified in the browser with mocked Tauri IPC across all 6 tabs and 4 physics modes, zero console errors.
- [x] **ASHRAE Guideline 14**: indices now computed on data aggregated to the criterion's time base (calendar hours for *Hourly*, calendar months for *Monthly*) with $(n-p)$, $p=1$ denominators; RMSE/MAE use $1/n$. KPI bar shows the number of evaluated periods and an *insufficient data* badge when fewer than 2 periods exist (e.g. monthly criterion on the 14-day sample). Rust command aligned.
- [x] **Unit tests**: `npm test` (10 tests, `node --test`) covering $T_{rm}$, EN 16798-1 / ASHRAE 55 limits vs. a **pythermalcomfort 4.0.2** reference fixture, applicability ranges and G14 indices. Rust `cargo test --lib`: 3/3.
- [x] **Cross-platform packaging**: `projects.json` falls back to the per-user app data directory (installed apps on macOS/Linux have read-only executable folders); bundle metadata in `tauri.conf.json`; `npm run build:bundle`; GitHub Actions `ci.yml` (tests on Windows/macOS/Linux) and `release.yml` (`.msi`/`.exe`, universal `.dmg`, `.AppImage`/`.deb`/`.rpm`). macOS/Linux builds are not yet verified (they run only in CI).
- [x] **License**: project relicensed consistently under **MIT** (`LICENSE` replaced the previous GPL-3.0 text that contradicted the README); `license = "MIT"` in `Cargo.toml` and `package.json`, README badge and section aligned.

### v0.3 — Formats, Benchmark & Software Fixes (2026-11-09)
- [x] **New formats (pure Rust, `chartmate-io` crate)**: ODS, HDF5, netCDF-3/4, MATLAB v5 and v7.3, SAS7BDAT, SAS XPT v5/v8, SPSS `.sav`, FITS (binary/ASCII tables, 1-D/2-D images); Excel dates now ISO text. Own readers for SPSS, XPT and FITS (no C dependencies, same build on all OSs).
- [x] **I/O engine split**: readers, timestamps and re-sampling moved to the Tauri-free crate `src-tauri/chartmate-io` (workspace member); Tauri commands are thin `async` wrappers (they no longer block the UI thread).
- [x] **Tests**: Rust 14/14 (`cargo test -p chartmate-io`: 13 formats return the CSV reference values; truncation flag; re-sampling statistics; IBM float; CF units). TypeScript 20/20 (`npm test`: + LDC/dose, carpet binning, statistics table, Δt inference, G14 scope, decimation, physics plate slots, 2·10⁵-row stack regression).
- [x] **Benchmark experiment** (`bench/`): dataset generator for all formats (10⁴–10⁶ rows), process-isolated reader benchmark vs pandas/polars/pyarrow/h5py/netCDF4/xarray/scipy/pyreadstat/astropy, plots and tables, protocols and templates for end-to-end and GUI task comparisons.
- [x] **Fixes**: G14 verdict only for energy data; plate PNG at true 300/600 dpi; Δt from timestamps; operative-temperature conditions note; Rust G14 duplicate removed; vector PDF export with standard fonts; building-physics figures in plate slots (plates only); SHA-256 data fingerprint in projects; truncation warning + load/render timing; min-max decimation and scattergl for long series; `CONTRIBUTING.md`, `CITATION.cff`.
- [x] **Bugs found while testing**: XPT v8 variable count, Excel midnight timestamps, stack overflow (`Math.min(...a)`) with ≥10⁵ rows in calibration/carpet/map, deep copy of the whole dataset on every load.
- [ ] Not yet: physics figures in MultiPlot; `.zsav`; Zenodo DOI; production executable rebuild (`npm run build:app`).

### Engine v0.3 — Typed Columns & Binary IPC (2026-11-09)
- [x] **Columnar engine** (`chartmate-io/src/columnar.rs`): readers fill typed `f64`/text columns directly (CSV with type inference, Parquet via Arrow, spreadsheets, all scientific formats); fast ISO timestamp writer.
- [x] **Binary IPC**: new `load_dataset` / `resample_loaded` / `execute_sql_query` return a `CMB1` message (raw f64 arrays + ` `-separated text blobs); the front end wraps numeric columns in `Float64Array` without copying (`src/data/table.ts`). The raw table is cached in the back end so re-sampling sends no data back.
- [x] **Front end**: charts read columns (`axisValues`, `numericValues`); `rows` is a lazy text view built only for modules that still need it (Tab 5, maps); the Editorial view is rendered only when visible (it recomputed statistics over all rows on every render).
- [x] **Benchmark rerun** (10⁶ rows, read time): CSV 1.67 → 0.70 s, Parquet 6.15 → 0.37 s, HDF5 2.99 → 0.47 s, netCDF-4 2.93 → 0.49 s, MATLAB 2.7 → 0.26 s, SPSS 2.93 → 0.49 s, FITS 2.13 → 0.26 s. In the browser check with 10⁶ rows: load into the UI 0.13 s (was ≈ 4.7 s), first chart 1.0 s.
- [x] Tests: Rust 17/17 (+ binary round trip, Parquet timestamps, column re-sampling), TypeScript 21/21 (+ decoder).
- [x] **Tab 5 and statistics on columns** (`src/source.ts`): the modules accept text rows or the column table; timestamps parsed once per column (fixed-layout fast path, cached); carpet bins with numeric keys and running aggregates; typed-array sorts; percentiles by quickselect; Δt inference cached. Node timings at 10⁶ rows: carpet 0.57 s (0.06 s when redrawn), comfort 0.22 s, duration 0.47 s, calibration 0.37 s, statistics table (5 variables) 0.38 s (was 1.1 / 0.65 / 1.24 / 1.16 / 4.8 s from text rows, plus 1.8 s to build them).
- [x] **Bounded drawing for physics figures**: duration curves drawn with ≤ 4000 points (monotone), residuals as a line above 20 000 samples, `reduceTracesForDisplay` (min-max decimation for lines, WebGL for > 50 000 markers) on Tab 5 and plates. Fixed another `Math.min(...array)` stack overflow in the comfort chart.
- [x] Tests: TypeScript 23/23 (+ column vs text equivalence for every module, quickselect).
- [ ] Maps tab still uses the lazy text view; in-browser timing at 10⁶ rows for Tab 5 not measured (browser pane hidden during the session) — measure with the e2e protocol.

### Standalone Windows executable — embedded WebView2 loader (2026-11-10)
- [x] The MinGW build no longer needs `WebView2Loader.dll` next to the `.exe`. `build.rs` links a delay-import library generated with `dlltool` (`tauri-app/src-tauri/webview2/WebView2Loader.def`), so Windows does not look for the DLL at start-up; `src/webview2_loader.rs` embeds the DLL (160 KB) and, before the first WebView2 call, writes it once to `%LOCALAPPDATA%\ChartMateuntime\<size>\` and loads it. MSVC builds (CI releases) are unchanged: they link the static loader.
- [x] Verified: release `ChartMate.exe` copied alone into an empty folder, runtime cache deleted → window opens, WebView2 starts, loader loaded from the runtime folder; second start reuses the cached copy.
- [x] `WebView2Loader.dll` removed from the repository (kept locally for the old v0.2 portable exe); README "How to Cite" section added (APA + BibTeX, `CITATION.cff`).
