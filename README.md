# ChartMate 📊 — Scientific Visualization & Building Physics Studio

[![Version](https://img.shields.io/badge/version-v0.2.0-emerald.svg)](https://github.com/villain-98/ChartMate/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20(Standalone%20Portable)-blue.svg)](https://github.com/villain-98/ChartMate/releases)
[![Language](https://img.shields.io/badge/interface-Bilingual%20[EN%20%7C%20IT]-green.svg)](#-bilingual-user-interface)
[![Architecture](https://img.shields.io/badge/stack-Rust%20%7C%20Tauri%20v2%20%7C%20TypeScript%20%7C%20Plotly.js-orange.svg)](#-building-from-source)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Academic-lightgrey.svg)](LICENSE)

**ChartMate** is a standalone, ultra-fast desktop visualization and engineering analytics studio designed for researchers, building physicists, and data scientists to produce **journal-quality, publication-ready figures, custom $R \times C$ multi-panel matrices, GIS maps, building physics diagnostics, and LaTeX `booktabs` tables in seconds**.

Built from the ground up with **Rust (Tauri v2), TypeScript, Vite, and Plotly.js**, it runs as a single lightweight native Windows executable (~37 MB) with **zero installation, no Python runtime, and no local server required**.

---

## 🚀 Complete 6-Tab Studio Architecture

### 🌐 Bilingual User Interface (`[ EN | IT ]`)
* **English Default (`EN`)**: Tailored for international scientific writing, peer review, and collaboration.
* **Instant Italian Switch (`IT`)**: Switch language with 1 click via the `[ EN | IT ]` toggle in the top navbar without reloading.

### ⚡ Tab 1 — Data Engine, SQL Telemetry & Rust High-Speed Resampling
* **Apache Parquet (`.parquet`, `.pq`)**: High-throughput native Rust ingestion of multi-million-row sensor feeds and simulation outputs.
* **Direct MySQL Telemetry Connector**: Query local or remote SQL databases directly with an integrated query editor (`test_sql_connection`, `execute_sql_query`).
* **Spreadsheets & Delimited Text**: Drag-and-drop loading for Excel (`.xlsx`, `.xls`), CSV, and TSV files.
* **High-Speed Rust Resampling & Denoising Engine**:
  * Aggregate time series in memory across `1m`, `5m`, `15m`, `30m`, `1h`, `6h`, and `1d` intervals.
  * Choose from `mean`, `median`, `max`, `min`, `p5` (drop removal), `p95` (spike removal), or `sum` with 1-click non-destructive restore to raw data.

### 🗂️ Tab 2 — Single Canvas Studio (Progressive Sub-Tabs)
Organized into 4 progressive, anti-clutter sidebar sub-tabs:
1. **Traces**: Multi-series assignment, chart types (Line, Scatter, Bar, Area), dual/quad axes ($Y_1 - Y_4$), and opacity.
2. **Axes & Scale**:
   * **Custom Axis Range (`[Min, Max]`)**: Lock physical ranges (e.g. $[15, 30]^\circ\text{C}$) to prevent misleading visual fluctuations.
   * **Decimal Precision**: Configure `Auto`, `0` (integer, e.g. for $\text{CO}_2$ ppm), `1`, `2`, or `3` decimal digits per axis.
3. **Grid & Frame**:
   * **Major Grid Interval (`dtick`) & Minor Sub-Grid (`minor.dtick`)**: Set primary grid lines (e.g. every $5^\circ\text{C}$) and internal sub-grids (e.g. every $1^\circ\text{C}$) with independent line weights and colors.
   * **Chart Frame Modes**: Choose between **Open L-Axes** (bottom X and left Y only, standard for scientific journals), **Box Frame** (all 4 sides enclosed), **Mirror Ticks** (box with inward ticks), or **Frameless**.
4. **Style & Notes**: Global typography, statistical annotations ($\mu, M, \text{Trend}$ with $R^2$), peak/valley detectors, and threshold bands.

### 🔲 Tab 3 — MultiPlot Parallel Studio (Custom $R \times C$ Matrices)
* **Topologies**: Standard presets (`3×1`, `2×1`, `2×2`, `1×2`) and **Custom Matrix $R \times C$** ($1\dots 5 \times 1\dots 5$, e.g., $3\times 4$, $2\times 5$, $5\times 5$).
* **Full Multi-Trace per Panel**: Each quadrant operates as an independent parallel canvas supporting multiple series, dual Y-axes, custom domains, or **1-click import from saved canvases**.
* **External Academic Lettering `(a)`, `(b)`, `(c)`...**: Positioned cleanly **outside** the chart frame (above or beside) to eliminate data occlusion.
* **Per-Panel vs Global Legends** & **Outer Matrix Macro-Axes** framing the entire grid.

### 🗺️ Tab 4 — Maps & Geo-Analytics Studio
* Direct dataset loading with live GPS coordinate diagnostics (`✓ GPS Coordinates OK`).
* Configurable decimal precision and radius for spatial markers across 5 basemap providers (CartoDB Positron, CartoDB Dark, OpenStreetMap, Stamen Terrain, Stamen Toner).
* **Spatial Grid Geoclustering**: Cluster coordinates into uniform spatial cells with mathematical aggregation ($\text{Mean } \mu$, $\text{Sum } \Sigma$, $\text{Mode } Mo$, $\text{Max}$, $\text{Min}$, $\text{Count } N$).

### 🏢 Tab 5 — Building Physics & IEQ Studio
Four specialized engineering analysis workspaces in a single studio:
1. **Carpet Plot / Temporal Heatmap (`Day × Hour 0–23h`)**:
   * 2D matrix binning (`mean`, `max`, `min`), 6 scientific colorscales (*Viridis*, *Plasma*, *Thermal*, *Turbo*, *Emerald*, *RdBu*), customizable iso-contour lines ($\Delta Z$), and calendar filtering (*All Days*, *Weekdays Mon–Fri*, *Weekends Sat–Sun*).
2. **Bioclimatic & Adaptive Thermal Comfort (`EN 16798-1` & `ASHRAE 55`)**:
   * **EN 16798-1:2019** Adaptive Model (Categories I, II, III with exponential running mean outdoor temperature $T_{rm}$).
   * **ASHRAE 55-2023** Adaptive Model (80% and 90% acceptability limits).
   * **Psychrometric $T\text{-}RH$ Envelope** (Winter & Summer comfort polygons + $W = 12\text{ g/kg}_{da}$ upper humidity ratio curve) with live compliance KPIs.
3. **Duration Curves & Exceedance Analyzer (`LDC`)**:
   * Descending duration curves over cumulative hours or % of time, dual threshold lines, shaded exceedance regions, and cumulative exposure dose integration ($I_{exc} = \sum \max(0, y_t - y_{thresh})\cdot\Delta t$ in degree-hours or ppm-hours).
4. **ASHRAE Guideline 14 Model Calibration & Parity**:
   * Automated calculation of **$\text{NMBE}$ ($\%$)**, **$\text{CV(RMSE)}$ ($\%$)**, **$R^2$**, **$\text{RMSE}$**, and **$\text{MAE}$** with live **ASHRAE G14 Hourly** ($|\text{NMBE}|\le 10\%$, $\text{CV(RMSE)}\le 30\%$) and **Monthly** ($|\text{NMBE}|\le 5\%$, $\text{CV(RMSE)}\le 15\%$) pass/fail compliance badges.
   * Switch between *Time-Series + Residual Subplot* and *1:1 Parity Scatter Plot* with $\pm 10\%$ error cone.

### 📑 Tab 6 — Editorial & LaTeX Publication Suite
* **Automated Statistical Summary Generator**: Computes $N$, $\text{Mean}$, $\text{Std}$, $\text{Min}$, $P_{25}$, $\text{Median } (P_{50})$, $P_{75}$, $P_{95}$, $\text{Max}$, $\text{IQR}$, exceedance hours, and dose integral across multiple selected columns.
* **1-Click Manuscript Export**: Generates publication-ready **LaTeX (`booktabs`)**, **GitHub Flavored Markdown**, and **Word/Excel TSV** tables.
* **Journal Figure Plate Compiler**: Compiles multi-panel vector figure plates calibrated to exact journal column widths (**Single Column $85\text{ mm}$**, **1.5 Column $120\text{ mm}$**, **Double Column $170\text{ mm}$**) at **$300\text{ / }600\text{ DPI}$**.

---

## 📥 Download & Quick Start

1. Go to the [**Releases**](https://github.com/villain-98/ChartMate/releases) page and download **`ChartMate-v0.2-windows-x64.zip`** (or `ChartMate-v0.2-windows-x64.exe` + `WebView2Loader.dll`).
2. Extract the archive (or ensure `WebView2Loader.dll` sits in the same directory as the executable) and double-click `ChartMate-v0.2-windows-x64.exe` to launch ChartMate immediately.
3. Drag and drop [`sample_building_data.csv`](sample_building_data.csv) (336 hourly records of indoor/outdoor temperatures, EnergyPlus simulated series, relative humidity, $\text{CO}_2$, HVAC power, and GPS coordinates) to test all 6 tabs immediately.

---

## 💻 Building from Source

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* [Rust](https://rustup.rs/) (v1.77+ with `stable-x86_64-pc-windows-gnu` or `stable-x86_64-pc-windows-msvc`)

### Development & Production Build
```powershell
cd tauri-app
npm install
npm run build
cd src-tauri
cargo test --lib
cargo build --release
```
The compiled standalone binary is generated at `tauri-app/src-tauri/target/release/app.exe`.

---

## 📚 Technical Documentation & Roadmap

* **[`RELEASE_NOTES.md`](RELEASE_NOTES.md)**: Detailed release notes and changelog for v0.2.0.
* **[`ROADMAP_IMPLEMENTATION_PLAN.md`](ROADMAP_IMPLEMENTATION_PLAN.md)**: Architectural and mathematical specifications for all implemented Building Physics, IEQ, Resampling, Calibration, and Editorial tracks.
* **[`PROJECT_STATUS.md`](PROJECT_STATUS.md)**: Active development log and milestone status.

---

## 📄 License
This project is released under the **MIT License**.
