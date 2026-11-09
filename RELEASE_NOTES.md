# 🚀 ChartMate v0.3.0 — Scientific File Formats, Columnar Engine & Standalone Executable

> **Release type**: Windows x64 portable release + native installers for Windows, macOS and Linux (built by CI)
> **Portable binary**: `ChartMate-v0.3-windows-x64.exe` — runs on its own, no extra DLL needed
> **Stack**: Rust (Tauri v2) + TypeScript + Vite + Plotly.js · **Interface**: English (default) | Italiano

---

## 🌟 Highlights

- **Nine more input formats**: ODS, HDF5, netCDF-3/4, MATLAB (v4/v5/v7 and v7.3), SAS (`.sas7bdat`, transport `.xpt` v5/v8), SPSS (`.sav`) and FITS, next to CSV/TSV, Excel, Parquet and MySQL. All readers are pure Rust: no C libraries, same build on every OS.
- **A new data engine**: numbers stay typed from the file to the chart, the data travel as a compact binary message, and re-sampling runs in the back end. Reading 10⁶ rows now takes **0.23–0.70 s** (was 2–6 s); loading 10⁶ rows into the interface takes about **0.13 s**.
- **Large data without freezing**: file reading runs off the interface thread, long series are drawn with min-max decimation (peaks and minima kept), very large point clouds use WebGL, and every statistic is still computed on all values.
- **Publication output**: vector **PDF export** with standard fonts and exact physical size, composite plates at true **300/600 dpi**, and building-physics figures inside the composite plate.
- **One-file Windows executable**: the WebView2 loader is embedded, so `ChartMate.exe` no longer needs `WebView2Loader.dll` next to it.

---

## ✨ What's new

### 📂 Data import (Tab 1)

| Format | Extensions | Notes |
|---|---|---|
| OpenDocument spreadsheet | `.ods` | first sheet |
| Excel | `.xlsx` `.xlsm` `.xlsb` `.xls` | dates now imported as ISO date-times |
| HDF5 | `.h5` `.hdf5` `.he5` `.hdf` | 1-D and 2-D datasets of a common length become columns; compound datasets; CF `units` → timestamps |
| netCDF-3 / netCDF-4 | `.nc` `.nc4` `.cdf` | CF unpacking and masking; CF time → timestamps |
| MATLAB | `.mat` (v4/v5/v7, v7.3) | numeric arrays; `datenum` → timestamps |
| SAS | `.sas7bdat`, `.xpt` (v5, v8) | SAS dates and date-times → ISO |
| SPSS | `.sav` | uncompressed and bytecode-compressed; long names; user-missing values; SPSS dates → ISO |
| FITS | `.fits` `.fit` `.fts` | binary and ASCII tables; 1-D / narrow 2-D images; scaling and null values |

- **Row limit** selectable in the data panel (100 k, 500 k, 2 M, 5 M, all rows), with an explicit warning when a file is cut.
- **Reader notes** in the data panel (skipped variables, unsupported features) and **timings** (load, read + parse, render).
- **Re-sampling** now runs on the table kept in the back end: no data are sent back from the interface.

### 📈 Charts (Tabs 2–3)
- Line and area traces longer than 20 000 points are drawn with **min-max decimation** (on by default, can be switched off); scatter traces above 50 000 points use **WebGL**.
- Charts read typed columns directly: the first chart of a 10⁶-point series appears in about one second.

### 🏢 Building Physics (Tab 5)
- **Calibration**: new *Quantity* setting. ASHRAE Guideline 14 pass/fail is shown only for energy, power or demand data; for other quantities (e.g. temperature) ChartMate reports NMBE, CV(RMSE), R², RMSE and MAE without a verdict. The setting is pre-filled from the column name.
- **Duration curves and exposure dose**: the time step Δt is taken from the timestamps by default (manual value still available); irregular sampling is flagged.
- **Adaptive comfort**: a note in the panel states the conditions of use of EN 16798-1 and ASHRAE 55 (operative temperature, occupant-controlled naturally conditioned spaces, near-sedentary activity).
- All modules work on typed columns: at 10⁶ rows carpet plot 0.57 s (0.06 s when redrawn), comfort 0.22 s, duration curve 0.47 s, calibration 0.37 s.

### 📑 Editorial & export (Tab 6 and toolbar)
- **PDF export** (new toolbar button): vector output, text kept as text in the standard PDF fonts (Helvetica, Times, Courier), page size equal to the figure size.
- **Composite plates**: PNG export now at true 300/600 dpi (previously 192/384 dpi); SVG/PDF sized in millimetres. Plate slots can hold a **carpet plot, adaptive comfort chart, duration curve or calibration parity plot** built with the current Tab-5 settings.
- **Statistics table** about 10× faster on large datasets (percentiles by selection instead of full sorting); exceedance hours use Δt from the timestamps.

### 💾 Projects
- A project stores the **size and SHA-256** of its data file; reopening a project whose data file has changed shows a warning.

### 🪟 Windows executable
- The WebView2 loader is embedded in the executable and copied once to `%LOCALAPPDATA%\ChartMate\runtime\` at first start. `WebView2Loader.dll` is no longer needed next to `ChartMate.exe`.

### 📖 Citation
- `CITATION.cff` and a **How to Cite** section in the README (APA and BibTeX). GitHub's *Cite this repository* button uses them.

---

## 🛠️ Fixes

- Crash ("Maximum call stack size exceeded") in calibration, carpet plot, maps and adaptive comfort with 10⁵ rows or more.
- The interface froze while a large file was being read.
- Every file load made a full copy of the dataset (double memory, seconds of delay at 10⁶ rows).
- The Editorial view recomputed its statistics on every interface update, whatever tab was open.
- Excel dates were imported as serial numbers.

---

## ⚡ Performance

Read time of the same table (timestamp + 8 columns) at 10⁶ rows, Windows 11, AMD Ryzen 7 5800H (8 cores), 32 GB RAM, warm cache, median of 5 runs. Spreadsheets at 10⁵ rows.

| Format | v0.3.0 | v0.2.0 |
|---|---|---|
| CSV | 0.70 s | 1.67 s |
| Parquet | 0.37 s | 6.15 s |
| HDF5 | 0.47 s | 2.99 s |
| netCDF-4 | 0.49 s | 2.93 s |
| MATLAB v5 / v7.3 | 0.26 / 0.23 s | 2.73 / 2.46 s |
| SPSS `.sav` | 0.49 s | 2.93 s |
| SAS XPT | 0.46 s | 2.91 s |
| FITS | 0.26 s | 2.13 s |
| XLSX / ODS (10⁵ rows) | 1.28 / 1.11 s | 1.66 / 1.28 s |

The comparison with pandas, polars, pyarrow, h5py, netCDF4, xarray, scipy, pyreadstat and astropy, and the scripts to reproduce it, are in [`bench/`](bench/README.md).

---

## ⚠️ Notes and known limitations

- The Windows portable executable is larger (50 MB, was 36 MB; the zip is 16 MB) because of the new readers.
- Very large point clouds drawn with WebGL are exported as images inside SVG/PDF files; lines stay vector.
- Not yet supported: SPSS `.zsav`, MATLAB structs and cell arrays, wide FITS images and N-D variables; building-physics figures in the MultiPlot grid (they can be placed in composite plates).
- Projects store absolute file paths.
- macOS builds are unsigned: right-click → *Open* the first time.

---

## 📦 Release assets

| Asset | Platform | Description |
| :--- | :--- | :--- |
| **`ChartMate-v0.3-windows-x64.zip`** (16 MB) | Windows 10/11 (x64) | Portable package: `ChartMate-v0.3-windows-x64.exe`, `sample_building_data.csv`, `LICENSE`, `THIRD_PARTY_NOTICES.md` |
| **`ChartMate-v0.3-windows-x64.exe`** (50 MB) | Windows 10/11 (x64) | Portable executable, runs on its own (requires the Microsoft Edge WebView2 Runtime, preinstalled on Windows 10/11) |
| `.msi` / `-setup.exe` | Windows 10/11 (x64) | Installers (built by the release workflow) |
| Universal `.dmg` | macOS 10.15+ | Apple Silicon and Intel (built by the release workflow) |
| `.AppImage` / `.deb` / `.rpm` | Linux x64 | Requires WebKitGTK 4.1 (built by the release workflow) |

**SHA-256 checksums (portable assets)**

```
3272b40b0cae723c1556c20d0ca88e1675af1604bbf97beeb022f75c6f7dbc1d  ChartMate-v0.3-windows-x64.exe
cedb60b4e6b14487b18452be39faa76070fd78e7b9c11b972af68fcf45b76d96  ChartMate-v0.3-windows-x64.zip
```

---

## ⬆️ Upgrading from v0.2

- Projects (`projects.json`) open unchanged; the data-file fingerprint is added the next time a project is saved.
- `WebView2Loader.dll` from v0.2 can be deleted.

---
---

# ⏮️ Previous release — ChartMate v0.2.0

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
| **`ChartMate-v0.2-windows-x64.zip`** | Windows 10/11 (x64) | ~11 MB | Complete portable release package (contains `ChartMate-v0.2-windows-x64.exe`, `WebView2Loader.dll`, and sample data) |
| **`ChartMate-v0.2-windows-x64.exe`** | Windows 10/11 (x64) | ~36 MB | Standalone Windows x64 binary (requires `WebView2Loader.dll` in the same directory) |
| **`WebView2Loader.dll`** | Windows 10/11 (x64) | 160 KB | Microsoft WebView2 Loader library (included in the repo and in the `.zip` archive) |
| **`sample_building_data.csv`** | Cross-platform | 14 days (336h) | Sample IEQ, HVAC, EnergyPlus simulation & GPS dataset |

> 💡 **Nota per l'esecuzione su Windows**: Se scarichi l'eseguibile singolo `.exe`, assicurati che il file `WebView2Loader.dll` sia presente nella stessa cartella dell'eseguibile (già pre-incluso nel repository e nel pacchetto zip `ChartMate-v0.2-windows-x64.zip`).
