# AGENTS.md — ChartMate Developer & AI Context Guide

> **Important**: This document is the primary briefing file for AI agents (and human developers) working on **ChartMate**. When starting a new session or chat, read this file first to immediately understand the project purpose, architecture, completed features, technical constraints, and current roadmap.

---

## 🎯 1. Project Overview & Mission

**ChartMate** is a standalone, ultra-fast desktop visualization studio built with **Rust (Tauri v2), TypeScript, Vite, and Plotly.js**.  
It is designed for researchers, engineers, and data scientists (specifically across engineering, building physics, indoor environmental quality, and time-series/geospatial sensor analysis) who need to produce **journal-quality, publication-ready figures, multi-panel grids, and GIS maps in seconds** without writing repetitive plotting scripts in Matplotlib, Seaborn, or GeoPandas.

### Key Philosophy
* **Ultra-Fast & Zero Conflict**: Native Windows desktop executable (`ChartMate.exe`), starts in < 1 second, zero local port conflicts, native WebView2 rendering.
* **Direct SharePoint, Parquet & MySQL Access**: Drag-and-drop or select files directly from local/SharePoint folders (`.parquet`, `.pq`, `.csv`, `.xlsx`, `.tsv`) or connect directly to **MySQL** databases without duplicating data.
* **Academic Standards Out-of-the-Box**: Publication presets (Single Column 8.5cm, Double Column 17cm, Square 12cm), vector SVG and high-DPI PNG export, multi-axis Y1–Y4, MultiPlot `(a)`–`(d)` matrices, and GIS maps with spatial clustering.
* **ChartMate Clean Scientific Design System**: Clean, white/zinc aesthetic using **Outfit** (sans-serif) and **JetBrains Mono** (tabular data and coordinates).

---

## 🏗️ 2. Tech Stack & Architectural Patterns

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Shell & Backend** | **Rust (Tauri v2)** | Native Windows app, low memory footprint (< 60 MB RAM), zero port conflicts, direct filesystem & dialog access |
| **Data Engine & I/O** | **Rust (`parquet`, `mysql`, `csv`, `calamine`)** | Instant multi-format parsing (Parquet, MySQL, CSV, TSV, Excel), auto delimiter detection, European decimal comma handling |
| **Rendering Engine** | **Plotly.js (`plotly.js-dist-min`)** | 60 FPS client-side scientific visualization, subplots, Mapbox GIS layers, vector SVG export |
| **Frontend Framework** | **TypeScript + Vite** | Fast build times (~2s), strongly typed state management |
| **Typography & Theme** | CSS3, Google Fonts (`Outfit`, `JetBrains Mono`) | `tauri-app/src/style.css`, ChartMate Clean Scientific theme |
| **Legacy Codebase** | Git Branch `legacy-python-dash` | Full Python/Dash codebase preserved for reference |

---

## 📂 3. Repository File Structure

```
ChartMate/
├── ChartMate.exe               # Standalone lightweight Windows Native Executable (Tauri v2 + Rust)
├── sample_building_data.csv    # Sample engineering, IEQ & GPS sensor dataset for instant testing
├── projects.json               # Standalone JSON database for projects, canvases, multiplots & maps
├── README.md                   # Public repository documentation
├── PROJECT_STATUS.md           # Live change log, accomplished milestones, backlog & roadmap
├── AGENTS.md                   # AI agent onboarding & codebase manual (this file)
├── GEMINI.md                   # Gemini / Antigravity agent context entrypoint
├── ChartMate_Structure.txt     # Plaintext directory structure
│
├── tauri-app/                  # Modern Native Desktop Core Architecture
│   ├── package.json            # Frontend tools: Vite, TypeScript, Plotly.js, PapaParse, SheetJS
│   ├── index.html              # Clean desktop window entrypoint
│   ├── src/                    # Reactive Frontend Architecture
│   │   ├── main.ts             # 4-Tab Controller: Data/Parquet/MySQL, Single Canvas, MultiPlot Grid, Maps GIS & Clustering
│   │   └── style.css           # ChartMate Clean Scientific Design System (Outfit, JetBrains Mono, Emerald)
│   │
│   └── src-tauri/              # Ultra-fast Rust Native Backend
│       ├── Cargo.toml          # Rust dependencies (tauri v2, parquet, mysql, calamine, csv, dialog, fs)
│       ├── tauri.conf.json     # Window, capabilities, HiDPI scaling & filesystem permissions
│       ├── capabilities/       # Granular OS permissions (open dialog, direct local/SharePoint file read)
│       └── src/
│           ├── main.rs         # Native desktop bootstrap
│           └── lib.rs          # Native high-speed reader (Parquet, MySQL, CSV, TSV, Excel) & projects store persistence
│
└── legacy-python-dash/         # (Git Branch) Complete original Python/Dash codebase preserved 100%
```

---

## 🚀 4. Current State: What Has Been Built & Working

### 1. Tab 1 — Data Source, Parquet, MySQL & GIS Setup ([`tauri-app/src/main.ts`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src/main.ts) & [`tauri-app/src-tauri/src/lib.rs`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/src/lib.rs))
- **Native Apache Parquet Reader (`.parquet`, `.pq`)**: Built with Rust `parquet` (`v53`, `SerializedFileReader`) supporting Snappy, Gzip, LZ4, and Brotli compression, logical timestamp decoding (`TIMESTAMP_MILLIS`, `TIMESTAMP_MICROS`, `DATE`), and decimal types.
- **Native MySQL Connector**: Built with Rust `mysql` (`v25`, `rustls-tls`) exposing `test_sql_connection` and `execute_sql_query` Tauri commands. Users can test connection latency, inspect database tables, and run custom SQL queries.
- **CSV / TSV / Excel Reader**: Automatic delimiter detection (`,`, `;`, `\t`), European decimal conversion, and timestamp identification.
- **Geospatial Coordinate Configurator**: Auto-detects Latitude and Longitude columns and supports both **Decimal Degrees (DD)** and **Degrees Minutes Seconds (DMS)** with automatic conversion.
- **Projects Store Persistence (`projects.json`)**: Saves project metadata, file paths, SQL parameters (excluding password), geo configuration, canvases, multiplots, and maps.

### 2. Tab 2 — Single Canvas Studio
- **Up to 4 Independent Y-Axes** ($Y_1, Y_2, Y_3, Y_4$) with independent scaling, titles, colors, and dynamic offset positioning.
- **Per-Trace Styler**: Dedicated dropdown for adding series, per-card variable selector dropdown, individual chart types (`line`, `scatter`, `bar`, `area`), line dash styles (`solid`, `dash`, `dot`), and color picker.
- **Smart Scientific Annotations**: Peak & Valley Tracker (*Global Max/Min*, *Daily Diurnal/Nocturnal Extrema*) and seasonal IEQ Comfort Bands (*Winter*, *Summer*, *Custom*).
- **Publication Presets**: *Single Column* ($8.5\times 6.5\text{ cm}$), *Double Column* ($17\times 9.5\text{ cm}$), *Square* ($12\times 12\text{ cm}$).

### 3. Tab 3 — MultiPlot Grid Studio
- **1-Click Subplot Topologies**: *Vertical Stack 3×1* `(a)-(c)`, *Vertical Stack 2×1* `(a)-(b)`, *Matrix Grid 2×2* `(a)-(d)`, and *Side-by-Side 1×2*.
- **Synchronized Shared X-Axis**: Links zoom/pan across subplots (`matches: 'x'`) and hides redundant intermediate tick labels on vertical stacks.
- **Academic Auto-Lettering**: Automatically places bold **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`** badges in each subplot corner.
- **Per-Panel Dual Axis & Canvas Import**: Each panel supports a primary $Y_1$ series, an optional secondary $Y_2$ right-hand axis, custom Y title, or 1-click import from any saved Single Canvas.

### 4. Tab 4 — Maps & Geo-Analytics Studio
- **3 Cartographic Visualization Modes**:
  - 📍 *Bubble Scatter Map* (`scattermapbox` with scalar color and size mapping).
  - 🔥 *Spatial Density Heatmap* (`densitymapbox` continuous kernel surface).
  - 〰️ *GPS Trajectory / Track* (sequential path line + colored waypoints).
- **5 Base Map Providers**:
  - 🏙️ *CartoDB Positron* (clean light paper standard).
  - 🛰️ *ESRI World Imagery Satellite* (high-res satellite imagery).
  - 🗺️ *OpenStreetMap* (urban & road).
  - 🌑 *CartoDB Dark Matter* (dark high contrast).
  - 🏔️ *OpenTopoMap* (topographic elevation).
- **Spatial Clustering & Mathematical Aggregations Engine**:
  - Configurable spatial grid binning ($0.0005^\circ \approx 50\text{m}$ up to $0.10^\circ \approx 10\text{km}$).
  - Real-time mathematical operators per spatial cluster: **Mean ($\mu$)**, **Cumulative Sum ($\Sigma$)**, **Mode ($Mo$ - dominant frequent value)**, **Maximum ($\text{Max}$)**, **Minimum ($\text{Min}$)**, and **Sample Count ($N$)**.

---

## ⚠️ 5. Important Rules & Engineering Guidelines

1. **Keep Tracking Files Synchronized at Every Step**:
   - The user has established a strict instruction: **"Aggiorna sempre i file di log ad ogni singolo step"**.
   - Whenever any feature, bugfix, or structural change is made, immediately update:
     - [`PROJECT_STATUS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/PROJECT_STATUS.md)
     - [`ChartMate_Structure.txt`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate_Structure.txt)
     - [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) & [`GEMINI.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/GEMINI.md)
2. **Preserve Incremental Rust Build Cache**:
   - Do **not** run `cargo clean` unless explicitly requested by the user, so `tauri build --no-bundle` completes in seconds.
3. **Scientific High-Contrast Typography**:
   - Always render chart text, axis titles, and tick labels in pure `#000000` black with `Outfit` and `JetBrains Mono`.
