# 🚀 ChartMate v0.2.0 — Complete 6-Tab Scientific Visualization & Building Physics Studio

> **Release Type**: Official Standalone Windows x64 Portable Release  
> **Primary Binary**: [`ChartMate-v0.2-windows-x64.exe`](ChartMate-v0.2-windows-x64.exe) / [`ChartMate.exe`](ChartMate.exe)  
> **Stack**: Rust (Tauri v2) + TypeScript + Vite + Plotly.js  
> **Interface**: Bilingual (`English [EN]` default | `Italiano [IT]` 1-click switch)

---

## 🌟 Executive Summary

**ChartMate v0.2.0** delivers a complete **6-Tab Desktop Studio** for researchers, architectural engineers, building physicists, and data scientists.  
Alongside the high-speed **Parquet / MySQL / Excel Data Engine (Tab 1)**, **Single Canvas Studio (Tab 2)**, **Custom $R \times C$ MultiPlot Studio (Tab 3)**, and **Maps & Geo-Analytics Studio (Tab 4)**, this release incorporates the complete **Building Physics & IEQ Studio (Tab 5)** and **Editorial & LaTeX Publication Suite (Tab 6)**.

---

## ✨ What's Included in v0.2.0

### 1. 🌐 Bilingual Interface (`[ EN | IT ]`) & Global Scientific Typography
- Starts in **English (`EN`)** by default for international academic publishing, with an instant `[ EN | IT ]` toggle in the top navigation bar.
- Global typography controls (*Outfit*, *Arial*, *Times New Roman*, *JetBrains Mono*) with pure `#000000` black high-contrast axis titles, ticks, and legends.

### 2. ⚡ Tab 1 — Data Engine, Parquet, MySQL & Native Rust Resampling
- Native multi-threaded ingestion for **Apache Parquet (`.parquet`, `.pq`)**, **MySQL databases**, **Excel (`.xlsx`, `.xls`)**, **CSV**, and **TSV**.
- **High-Speed Rust Time-Series Resampling & Denoising (`resample_in_memory` / `resample_timeseries`)**:
  - Bucket high-frequency sensor streams into `1m`, `5m`, `15m`, `30m`, `1h`, `6h`, or `1d` intervals.
  - Supports `mean`, `median`, `max`, `min`, `p5` (drop removal), `p95` (spike removal), and `sum` with 1-click non-destructive reset to raw data.

### 3. 📈 Tab 2 — Single Canvas Studio with Granular Axis, Grid & Frame Control
- **4 Progressive Sidebar Sub-Tabs**: `1. Traces`, `2. Axes & Scale`, `3. Grid & Frame`, `4. Style & Notes`.
- **Up to 4 Independent Y-Axes ($Y_1 - Y_4$)** with per-axis custom `[Min, Max]` range locking and decimal precision (`Auto`, `0`, `1`, `2`, `3`).
- **Major (`dtick`) & Minor Internal (`minor.dtick`) Gridlines** with independent line width and color controls.
- **Chart Frame Modes**: *Open L-Axes* (standard scientific bottom + left axes only), *Closed Box Frame*, *Mirror Ticks*, or *Frameless*.

### 4. 🔲 Tab 3 — MultiPlot Parallel Studio (Custom $R \times C$ Matrices up to $5\times 5$)
- Standard presets (`3×1`, `2×1`, `2×2`, `1×2`) plus **Custom $R \times C$ Matrix** ($1\dots 5$ rows $\times 1\dots 5$ cols).
- Multi-trace per subplot panel, 1-click import from saved Single Canvases, external academic lettering `(a)`, `(b)`, `(c)`..., per-panel vs global legends, and outer macro-axes.

### 5. 🗺️ Tab 4 — Maps & Geo-Analytics Studio
- Direct dataset loader, live GPS coordinate validation badge, 5 basemap providers, and **Spatial Grid Geoclustering** ($\text{Mean } \mu, \text{Sum } \Sigma, \text{Mode } Mo, \text{Max}, \text{Min}, \text{Count } N$).

### 6. 🏢 Tab 5 — Building Physics & IEQ Studio (New!)
- **Carpet Plot / Temporal Heatmap (`Day × Hour 0–23h`)**:
  - 2D matrix aggregation (`mean`, `max`, `min`), 6 scientific colorscales (*Viridis*, *Plasma*, *Thermal*, *Turbo*, *Emerald*, *RdBu*), customizable iso-contours ($\Delta Z$), and calendar filtering (*All Days*, *Weekdays Mon–Fri*, *Weekends Sat–Sun*).
- **Bioclimatic & Adaptive Thermal Comfort (`EN 16798-1` & `ASHRAE 55`)**:
  - **EN 16798-1:2019** Adaptive Comfort (Categories I, II, III with exponential running mean outdoor temperature $T_{rm}$).
  - **ASHRAE 55-2023** Adaptive Comfort (80% and 90% acceptability limits).
  - **Psychrometric $T\text{-}RH$ Chart** (Winter & Summer comfort polygons + $W = 12\text{ g/kg}_{da}$ upper humidity threshold) with automatic compliance KPIs.
- **Duration Curves & Exceedance Analyzer (`LDC`)**:
  - Descending duration curves over hours or % of time, secondary comparison curve, primary & critical thresholds, shaded exceedance area, and cumulative exposure dose integral ($I_{exc} = \sum \max(0, y_t - y_{thresh})\cdot\Delta t$).
- **ASHRAE Guideline 14 Calibration & Parity View**:
  - Instant calculation of $\text{NMBE}$ ($\%$), $\text{CV(RMSE)}$ ($\%$), $R^2$, $\text{RMSE}$, and $\text{MAE}$ with **ASHRAE G14 Hourly** ($|\text{NMBE}|\le 10\%$, $\text{CV(RMSE)}\le 30\%$) and **Monthly** ($|\text{NMBE}|\le 5\%$, $\text{CV(RMSE)}\le 15\%$) pass/fail badges, Time-Series + Residual subplot, and 1:1 Parity plot.

### 7. 📑 Tab 6 — Editorial & LaTeX Publication Suite (New!)
- **Automated Statistical Summary Generator**: Computes $N$, $\text{Mean}$, $\text{Std}$, $\text{Min}$, $P_{25}$, $P_{50}$, $P_{75}$, $P_{95}$, $\text{Max}$, $\text{IQR}$, exceedance hours, and dose across selected variables.
- **1-Click Table Code Export**: Generates ready-to-paste **LaTeX (`booktabs`)**, **GitHub Markdown**, and **Word/Excel TSV** tables.
- **Journal Figure Plate Compiler**: Formats multi-panel composite plates to exact journal column widths (**$85\text{ mm}$ Single Column**, **$120\text{ mm}$ 1.5 Column**, **$170\text{ mm}$ Double Column**) at **$300\text{ / }600\text{ DPI}$**.

---

## 📦 Release Assets

| Asset | Platform | Size | Description |
| :--- | :--- | :--- | :--- |
| **`ChartMate-v0.2-windows-x64.exe`** | Windows 10/11 (x64) | ~37 MB | Standalone portable executable (zero installation required) |
| **`sample_building_data.csv`** | Cross-platform | 14 days (336h) | Sample IEQ, HVAC, EnergyPlus simulation & GPS dataset |
