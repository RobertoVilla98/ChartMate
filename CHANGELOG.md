# Changelog

All notable changes to ChartMate. Detailed notes for each release are in
[`RELEASE_NOTES.md`](RELEASE_NOTES.md).

## [0.3.0] — 2026-11-10

### Added
- Readers for ODS, HDF5, netCDF-3/4, MATLAB (v4/v5/v7, v7.3), SAS (`.sas7bdat`, `.xpt` v5/v8), SPSS (`.sav`) and FITS, in the new Tauri-free Rust crate `chartmate-io`.
- Vector PDF export (standard fonts, exact physical size).
- Building-physics figures (carpet, comfort, duration curve, calibration parity) in composite plate slots.
- Selectable row limit with truncation warning; reader notes; load, parse and render timings.
- Min-max decimation for long line series and WebGL for large point clouds.
- *Quantity* setting for calibration: Guideline 14 verdict only for energy/power/demand data.
- Δt for duration curves and exceedance hours derived from the timestamps; irregular sampling flagged.
- Conditions-of-use note for the adaptive comfort models.
- Size and SHA-256 of the data file stored in projects, with a warning when the file changed.
- Reader benchmark and comparison protocol (`bench/`), `CONTRIBUTING.md`, `CITATION.cff`, README *How to Cite*.

### Changed
- Data engine: typed columns end to end, binary transfer to the interface, re-sampling on the table kept in the back end; heavy commands run off the interface thread. Reading 10⁶ rows: 0.23–0.70 s (was 2–6 s).
- Building-physics modules and the statistics table work on typed columns.
- Windows (MinGW) executable embeds the WebView2 loader; `WebView2Loader.dll` is no longer needed next to it.
- Composite plate PNG export at true 300/600 dpi (was 192/384 dpi).

### Removed
- Unused Rust implementation of the Guideline 14 indices (the TypeScript one is used).

### Fixed
- Stack overflow with 10⁵ rows or more in calibration, carpet plot, maps and adaptive comfort.
- Interface freeze while reading large files.
- Full copy of the dataset on every load.
- Editorial statistics recomputed on every interface update.
- Excel dates imported as serial numbers.

## [0.2.0] — 2026-10-30

- Six-tab studio: data engine (Parquet, MySQL, Excel, CSV, re-sampling), Single Canvas, MultiPlot, Maps, Building Physics (carpet plot, adaptive comfort, duration curves, ASHRAE Guideline 14 calibration) and Editorial suite (LaTeX/Markdown/TSV tables, composite plates).
