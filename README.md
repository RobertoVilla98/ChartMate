# ChartMate 📊

**ChartMate** is a high-speed, publication-ready scientific figure studio built with **Python, Dash, Polars, and Plotly**. Designed for researchers, engineers, and data scientists, it streamlines the generation of journal-quality single-panel and multi-panel figures without requiring complex scripting.

---

## 🚀 Key Features

* **🎨 Velth Light Mode Design System**: Clean, modern interface with crisp typography (Outfit & JetBrains Mono) and high-contrast scientific palettes.
* **🏷️ Smart Labelling & Annotations**:
  * *Peak & Valley Tracker*: Automatic Global Max/Min callouts and Daily Extrema per calendar day.
  * *Threshold Lines & Comfort Bands*: Horizontal reference lines and shaded target ranges.
  * *Statistical Indicators*: Mean ($\mu$), Median ($M$), and Linear OLS Trendline with $R^2$.
  * *Event Shading*: Vertical time-window highlighting for critical events or faults.
* **📊 Universal Scientific Chart Suite**:
  * 📈 **Line** (Continuous & Gap management)
  * ⚬ **Scatter** (High-precision markers)
  * 📊 **Bar & Area**
  * 📦 **Box Plot** (Medians, IQR, and Jitter Points)
  * 🎻 **Violin Plot** (Kernel Density Estimations)
  * 📊 **Grouped Bar with Error Bars** ($\mu \pm \sigma$)
  * 🔥 **Correlation Matrix Heatmap** (Pearson $r \in [-1, 1]$ with cell text)
  * 📈 **Histogram & Frequency Distribution**
  * 🕸️ **Radar / Spider Plot** (Multi-metric evaluation)
* **📐 1-Click Publication Presets**:
  * *Single Column* ($8.5 \times 6.5\text{ cm}$)
  * *Double Column* ($17.0 \times 9.5\text{ cm}$)
  * *Square* ($12.0 \times 12.0\text{ cm}$, Ratio 1:1)
  * *Presentation 16:9* ($24.0 \times 13.5\text{ cm}$)
  * *Custom Dimensions* & True WYSIWYG responsive sizing.
* **🔲 Journal-Ready MultiPlot Studio**:
  * *Topology Presets*: Vertical Time-Series Stack ($3\times 1$, $2\times 1$), Matrix Grid ($2\times 2$), Side-by-Side ($1\times 2$).
  * *Academic Auto-Lettering*: Automatic **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`** panel badges.
  * *Smart Dynamic Spacing*: Zero text or axis collision.
* **⚡ Ultra-Fast Polars Engine**: Instant ingestion and filtering of massive time-series datasets.
* **💾 Vector & Raster Export**: Direct download in **SVG**, **PDF**, **PNG**, and **JPEG** with custom DPI ($96$, $150$, $300$, $600\text{ DPI}$).

---

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/villain-98/ChartMate.git
   cd ChartMate
   ```

2. **Set up a virtual environment**:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

---

## 📖 Usage

### Running the Studio
```powershell
python app.py
```
ChartMate will automatically open in your default browser at `http://127.0.0.1:8050/`.

### Building Standalone Desktop Executable
```powershell
python build_exe.py
```
The standalone executable will be generated in `dist/`.

---

## 📁 Project Architecture & Tracking

For detailed architecture, recent advancements, and future roadmap, refer to:
* [`PROJECT_STATUS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/PROJECT_STATUS.md) — Official status, solved decisions, and future implementation roadmap.
* [`ChartMate_Structure.txt`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate_Structure.txt) — Modular file tree.
* [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/docs/PROJECT_OVERVIEW.md) — Architectural specification.
