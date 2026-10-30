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
