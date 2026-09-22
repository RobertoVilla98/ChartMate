# AGENTS.md — ChartMate Developer & AI Context Guide

> **Important**: This document is the primary briefing file for AI agents (and human developers) working on **ChartMate**. When starting a new session or chat, read this file first to immediately understand the project purpose, architecture, completed features, technical constraints, and current roadmap.

---

## 🎯 1. Project Overview & Mission

**ChartMate** is a standalone, ultra-fast desktop visualization studio built with **Rust (Tauri v2), TypeScript, Vite, and Plotly.js**.  
It is designed for researchers, engineers, and data scientists (specifically across engineering, building physics, indoor environmental quality, and time-series sensor analysis) who need to produce **journal-quality, publication-ready figures in seconds** without writing repetitive plotting scripts in Matplotlib or Seaborn.

### Key Philosophy
* **Ultra-Fast & Zero Conflict**: Native Windows desktop executable (`ChartMate.exe`, ~23 MB), starts in < 1 second, zero local port conflicts, native WebView2 rendering.
* **Direct SharePoint & Local Path Access**: Drag-and-drop or select files directly from local/SharePoint folders (`C:\Users\...\SharePoint\...`) without uploading or duplicating data.
* **Academic Standards Out-of-the-Box**: Publication presets (Single Column 8.5cm, Double Column 17cm, Square 12cm), vector SVG/PDF export at 300/600 DPI, multi-axis Y1/Y2/Y3, and smart annotations.
* **ChartMate Clean Scientific Design System**: Clean, white/zinc aesthetic using **Outfit** (sans-serif) and **JetBrains Mono** (tabular data and coordinates).

---

## 🏗️ 2. Tech Stack & Architectural Patterns

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Shell & Backend** | **Rust (Tauri v2)** | Native Windows app, low memory footprint (< 60 MB RAM), zero port conflicts, direct filesystem & dialog access |
| **Data Engine & I/O** | **Rust (`csv`, `calamine`) + PapaParse** | Instant multi-format parsing (CSV, TSV, Excel), auto delimiter detection (`,`, `;`, `\t`), European decimal comma handling |
| **Rendering Engine** | **Plotly.js (`plotly.js-dist-min`)** | 60 FPS client-side scientific visualization, zooming, panning, vector export |
| **Frontend Framework** | **TypeScript + Vite** | Fast build times (< 1.7s), modular component architecture |
| **Typography & Theme** | CSS3, Google Fonts (`Outfit`, `JetBrains Mono`) | `tauri-app/src/style.css`, ChartMate Clean Scientific theme |
| **Legacy Codebase** | Git Branch `legacy-python-dash` | Full Python/Dash codebase preserved for reference and parity validation |

---

## 📂 3. Repository File Structure

```
ChartMate/
├── app.py                      # Main entrypoint, Velth header, navbar & page routing
├── requirements.txt            # Dependencies (polars, dash, dash-bootstrap-components, etc.)
├── README.md                   # Public repository documentation
├── PROJECT_STATUS.md           # Live change log, accomplished milestones, backlog & roadmap
├── AGENTS.md                   # AI agent onboarding & codebase manual (this file)
├── GEMINI.md                   # Gemini / Antigravity agent context entrypoint
├── ChartMate_Structure.txt     # Plaintext directory structure
├── build_exe.py                # PyInstaller build script for standalone executable
│
├── assets/                     # Static files automatically served by Dash
│   ├── style.css               # Velth Light Mode Design System tokens & CSS overrides
│   └── logo.svg                # Vector SVG logo (L-shaped XY axes + waving mate character)
│
├── components/                 # Reusable UI Widgets & Controllers
│   ├── __init__.py
│   ├── export_toolbar.py       # Publication Presets, CM dimensions, DPI, and format selector
│   ├── annotation_panel.py     # Smart Labelling, Peak Tracker, Thresholds, Target Bands, Stats
│   ├── trace_styler.py         # Per-trace color picker, line styles, opacity, and z-order
│   ├── axis_panel.py           # Multi-axis (X, Y1, Y2, Y3), chart types, grids, limits, timeframe
│   ├── grid_navigator.py       # MultiPlot matrix navigator, cell mapping & Topology Presets
│   └── logo.py                 # Vector SVG logo rendering component
│
├── pages/                      # Slender Application Page Controllers (Dash Multi-Page)
│   ├── home.py                 # Project management, file ingestion, separator/decimal config, preview
│   ├── canvas.py               # Single Chart Studio (10 chart types, 3 Y-axes, smart labelling)
│   ├── multi_plot.py           # MultiPlot Subplot Matrix Studio (Topology presets, lettering, spacing)
│   └── maps.py                 # Maps GIS Studio (ESRI Satellite, OSM, Bubble, Density, GPS tracks)
│
├── utils/                      # Core Processing & Engine Modules
│   ├── data_handler.py         # Polars data ingestion, separator handling & export scaling
│   ├── storage.py              # Persistent JSON CRUD operations for projects.json
│   ├── chart_engine.py         # Decoupled Plotly scientific rendering engine (Charts, MultiPlot, Maps)
│   └── projects.json           # Local JSON database for projects, canvases, and multiplots
│
└── docs/                       # Extended Documentation
    └── PROJECT_OVERVIEW.md     # Architectural specification & system diagrams
```

---

## 🚀 4. Current State: What Has Been Built & Working

### 1. Data Ingestion & Project Management ([`pages/home.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/home.py))
- File ingestion with OS file dialog (`tkinter`).
- Robust delimiter parsing (`,`, `;`, `\t`), decimal comma/dot conversion, timestamp column detection and format strings.
- Interactive Polars preview table.
- Project profile saving, loading, updating (with overwrite protection modal), and deletion.

### 2. Single Chart Studio ([`pages/canvas.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/canvas.py))
- **Up to 3 Independent Y-Axes** ($Y_1, Y_2, Y_3$) with dedicated scaling, titles, and grid controls.
- **10 Scientific Chart Types Supported**:
  1. `line`: Continuous lines with `Connect Gaps` option.
  2. `scatter`: High-contrast marker scatters.
  3. `bar`: Standard categorical bar charts.
  4. `area`: Shaded area charts below curves.
  5. `box`: Box plots with medians, quartiles, IQR whiskers, and jittered data points.
  6. `violin`: Continuous KDE distributions with internal box plots.
  7. `bar_error`: Grouped bars with automatically computed Mean $\pm$ Standard Deviation ($\mu \pm \sigma$) error bars.
  8. `correlation`: Pearson correlation matrix heatmap ($r \in [-1, 1]$) with diverging *RdBu* scale and numeric cell values.
  9. `histogram`: Probability density and frequency distributions with automatic binning.
  10. `radar`: Polar radial spider charts for multi-metric KPI benchmarking.
- **Smart Labelling & Scientific Annotations** ([`components/annotation_panel.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/annotation_panel.py)):
  - **Peak & Valley Tracker**: Global Max & Min callouts with arrow pins (`🔴 Max`, `🔵 Min`); **Daily Extrema** (automatically calculates diurnal peak and nocturnal minimum per calendar day); Top 3 extrema.
  - **Threshold Reference Lines**: Horizontal lines with custom labels and colors (e.g. `Limit 1000 ppm`, `0 °C`).
  - **Target Comfort Bands**: Horizontal shaded rectangular regions (e.g. $[20, 26]^\circ\text{C}$).
  - **Statistical Lines & OLS Trendline**: 1-click Mean ($\mu$) and Median ($M$) horizontal lines; Ordinary Least Squares linear regression trendline with formula and $R^2$ indicator.
  - **Event Shading**: Vertical time-window shaded band between two dates for critical episodes (*Heatwave*, *Fault Period*).
- **Publication Presets & True Proportional Preview**:
  - Presets: *Single Column* ($8.5\times 6.5\text{ cm}$), *Double Column* ($17\times 9.5\text{ cm}$), *Square* ($12\times 12\text{ cm}$), *Presentation 16:9* ($24\times 13.5\text{ cm}$), *Custom*.
  - Sizing Engine: Injects concrete pixel dimensions into `fig.layout.width` and `fig.layout.height` (up to $1200\times 750\text{ px}$ on large screens) so square formats render as exact geometric squares ($680\times 680\text{ px}$).
  - High-res vector/raster export in SVG, PDF, PNG, JPEG ($96, 150, 300, 600\text{ DPI}$).

### 3. MultiPlot Studio ([`pages/multi_plot.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/multi_plot.py))
- **Topology Presets (1-Click)**:
  - *Vertical Stack 3×1* (gold standard for synchronized time-series like Temp, RH, $\text{CO}_2$ sharing bottom X time-axis).
  - *Vertical Stack 2×1*.
  - *Matrix Grid 2×2* (4 quadrants).
  - *Side-by-Side 1×2*.
  - *Custom Matrix $R\times C$*.
- **Academic Auto-Lettering**: Generates bold panel badges **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`**...
- **Anti-Collision Dynamic Spacing**: Auto-computes `vertical_spacing` and `horizontal_spacing` to eliminate text/axis overlapping.
- **Clean Shared Time Axis**: Hides intermediate X ticks in vertical stacks, showing only clean date labels on the bottom panel.
- **Per-Panel Y-Axis Labels**: Custom unit/title per cell.
- **Consolidated Unified Legend**: Compact horizontal legend centered at top.

### 4. Maps Studio ([`pages/maps.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/maps.py))
- **Base Map Providers**:
  - 🛰️ *ESRI World Imagery Satellite* (high-resolution global satellite tiles).
  - 🗺️ *OpenStreetMap* (standard road/geographic).
  - 🏙️ *CartoDB Positron* (minimal light paper standard).
  - 🌑 *CartoDB Dark Matter* (dark high contrast).
  - 🏔️ *OpenTopoMap* (topographic elevation).
- **Visualization Modes**:
  - 📍 *Bubble Scatter Map* (points with scalar color & size mapping).
  - 🔥 *Spatial Density Heatmap* (continuous density surface).
  - 〰️ *GPS Trajectory / Track* (sequential lines + waypoints).
- **Auto-Fit Bounding Box**: Automatic center coordinate and zoom calculation from dataset bounds.
- **Export Toolbar**: Full export capabilities at 96-600 DPI.

---

## ⚠️ 5. Important Rules & Engineering Guidelines

When modifying this repository, **you MUST follow these conventions**:

1. **Keep Tracking Files Synchronized at Every Step**:
   - The user has established a strict instruction: **"Aggiorna sempre i file di log ad ogni singolo step"**.
   - Whenever any feature, bugfix, or structural change is made, immediately update:
     - [`PROJECT_STATUS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/PROJECT_STATUS.md)
     - [`ChartMate_Structure.txt`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate_Structure.txt)
     - [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) / [`GEMINI.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/GEMINI.md)
2. **Never Use Pandas**: Always use **Polars** (`import polars as pl`) for data processing. Convert series with `_clean_series()` to safely handle European decimal commas (`,`).
3. **Keep Page Controllers Slender**:
   - Page files in `pages/` must only handle Dash layout assembly and callback wiring.
   - All complex plotting logic must be placed inside [`utils/chart_engine.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/utils/chart_engine.py).
   - Reusable UI blocks belong in `components/`.
4. **Dash Callback Duplicate Rule**:
   - Any `Output(component_id, property)` targeted by more than one callback must set `allow_duplicate=True` and `prevent_initial_call=True`.
5. **Plotly Resizing Rule**:
   - Do **not** rely on CSS `aspect-ratio` alone for Plotly sizing; Plotly.js ignores CSS height. Always calculate `calc_w` and `calc_h` in `chart_engine.py` using `_calc_aspect_dimensions()` and set `width=calc_w, height=calc_h, autosize=False`.
6. **Velth Light Design Standard**:
   - Backgrounds: `#f8fafc` (Zinc-50) and `#ffffff` (Card surface).
   - Accents: Emerald (`#059669`), Sky (`#0284c7`), Amber (`#d97706`), Slate (`#64748b`).
   - Fonts: `Outfit, sans-serif` for UI; `JetBrains Mono, monospace` for numbers and coordinates.

---

## 🔮 6. Current Roadmap & Backlog (Next Steps)

The following items are requested or planned for upcoming iterations:

### 📌 Priority 1: Advanced Scientific Plots
- [ ] **Carpet Plot / Temporal Day-Hour Heatmap**:
  - $X$ = Day of Year (Date), $Y$ = Hour of Day ($0-23\text{h}$), $Z$ = Metric (Temperature, $\text{CO}_2$, Electric Power $[\text{kW}]$).
  - Crucial for building physics, HVAC schedules, night setback detection, and seasonal energy benchmarking.
- [ ] **Load Duration Curve (Curva di Durata del Carico)**:
  - Descending cumulative duration plot ($0-8760\text{ hours}$ or $0-100\%$).
  - Automated calculation of threshold exceedance hours (overheating, poor IAQ hours $> 1000\text{ ppm}$).

### 📌 Priority 2: Multi-Figure PDF Report Export
- [ ] **Automated PDF Report Compiler**:
  - Export a formatted multi-page PDF compiling multiple saved canvases and multiplots with titles, figures, captions, and project metadata.

### 📌 Priority 3: External Database Ingestion
- [ ] **Direct Connectors**:
  - SQLite database query selector.
  - InfluxDB / Parquet remote time-series streaming.

---

## 🏃 7. Quick Commands

```powershell
# Run Development Server
python app.py

# Verify Compilation across all modules
python -m py_compile app.py utils/chart_engine.py components/annotation_panel.py components/grid_navigator.py components/export_toolbar.py pages/canvas.py pages/multi_plot.py pages/maps.py pages/home.py

# Build Standalone Windows Executable
python build_exe.py
```
