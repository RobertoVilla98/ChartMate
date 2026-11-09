# ChartMate performance benchmark

This folder holds the performance experiment: how fast ChartMate reads and draws large tables
compared with established tools. It has three parts:

| Part | What is measured | How | Output |
|---|---|---|---|
| **A. Reader benchmark** (automated) | Time and peak memory to read the same table from 13 file formats, ChartMate engine vs. reference Python libraries | `run_benchmark.py` | `results/summary.csv`, `results/raw.csv`, `results/environment.json` |
| **B. End-to-end in ChartMate** (semi-automated) | Load (read + IPC) and render time inside the desktop app, 10⁴–10⁶ rows | timings shown in the app (data panel, below each chart) | `results/e2e_chartmate.csv` (template below) |
| **C. Task comparison with GUI tools** (manual, timed) | Format coverage and time to complete the same figure tasks in LabPlot, Veusz, PlotJuggler, LibreOffice Calc / Excel, and a Python script | protocol below, screen recording | `results/gui_tasks.csv` from `gui_tasks_template.csv` |

Part A is fully reproducible from this folder. Parts B and C need a person at the keyboard; the
protocol fixes the tasks, the stopwatch rules and the number of repetitions so that another person
can repeat them.

---

## Datasets

`make_datasets.py` writes one synthetic time series in every format:

* columns: `timestamp` (1-min steps from 2026-01-01), six float columns (`t_air`, `rh`, `co2`,
  `power_kw`, `t_out`, `sim_power_kw`), one integer (`occupants`) and one text column (`zone`);
* sizes: 10⁴, 10⁵, 10⁶ rows (spreadsheets XLSX/ODS only up to 10⁵: writing larger ones is impractical
  and XLSX is capped at 1 048 576 rows anyway);
* formats: CSV, XLSX, ODS, Parquet, HDF5 (1-D datasets, gzip), netCDF-4 (zlib) and netCDF-3 (64-bit
  offset), MATLAB v5 and v7.3, SPSS `.sav` (bytecode-compressed), SAS transport XPT v5 and v8, FITS
  binary table.
* SAS `.sas7bdat` cannot be written with open tools; the reader is verified on the reference file of
  the `sas7bdat` crate (`tauri-app/src-tauri/chartmate-io/tests/fixtures/people_nonascii.sas7bdat`).
  To include it in the benchmark, place files named `bench_<rows>.sas7bdat` (e.g. exported from SAS
  or R `haven`) in `data/`; they are picked up automatically.

The values are synthetic by construction and carry no physical meaning; they only exercise the
readers. The same generator writes the 48-row fixture set used by the Rust tests
(`--fixture`), where every reader must return the same values as the CSV reference.

## Part A — reader benchmark

### Tools

| Format | ChartMate engine | Reference tools |
|---|---|---|
| CSV | `chartmate-io` | `pandas.read_csv`, `polars.read_csv`, `pyarrow.csv` |
| XLSX / ODS | `chartmate-io` (calamine) | `pandas.read_excel` (openpyxl / odfpy) |
| Parquet | `chartmate-io` (parquet-rs) | `pandas.read_parquet` (pyarrow), `polars.read_parquet` |
| HDF5, MATLAB v7.3 | `chartmate-io` (hdf5-reader) | `h5py` (libhdf5) |
| netCDF-3/4 | `chartmate-io` (netcdf-reader) | `netCDF4` (netcdf-c), `xarray` |
| MATLAB v5 | `chartmate-io` (matfile) | `scipy.io.loadmat` |
| SPSS | `chartmate-io` (own reader) | `pyreadstat` (ReadStat), `pandas.read_spss` |
| SAS XPT | `chartmate-io` (own reader) | `pyreadstat.read_xport`, `pandas.read_sas` |
| SAS7BDAT | `chartmate-io` (sas7bdat crate) | `pyreadstat.read_sas7bdat`, `pandas.read_sas` |
| FITS | `chartmate-io` (own reader) | `astropy.table` |

### Measurement rules

1. Each (tool, file, repetition) runs in a **fresh process**. Six repetitions; the first is a warm-up
   and is discarded, so the reported runs read from the operating-system file cache (warm cache).
   Cold-cache numbers are not reported because they mostly measure the disk.
2. Inside each process the file is **read twice**: `first_read_ms` is the first read (includes
   one-off lazy initialisation such as plugin discovery), `read_ms` the second one (steady state in
   an open session, the relevant case for an interactive tool). Imports and interpreter start-up are
   excluded from both and included in `wall_ms`.
3. Every reader must materialise all values (lazy objects are forced with `[:]` or `.load()`).
4. **What ChartMate's number contains.** `read_ms` for ChartMate is the `load_columnar` call that
   the app's `load_dataset` command runs: read, parse into typed columns (`f64` / text), timestamp
   conversion and detection. `ipc_json_ms` (column name kept for continuity) is the encoding of the
   binary IPC message (raw `f64` arrays, see `chartmate-io/src/columnar.rs`). Like the Python tools,
   ChartMate now stops at a typed in-memory table. The first run (2026-11-09, engine v0.2) converted
   every value to a text cell and sent JSON; it is kept in the results as
   `ChartMate v0.2 (text rows)` (`results/summary_v02.csv`) to document the effect of the change.
5. Peak memory (`peak_mb`) is the peak working set (Windows) or sampled RSS (other systems) of the
   whole process tree, sampled every 5 ms. It includes the interpreter or binary itself; compare
   values within a format, not across formats.
6. Summary statistics: median and interquartile range of the five kept runs.

### Run

```bash
# 1. build the engine benchmark binary (from the repository root)
cd tauri-app/src-tauri
cargo build --release -p chartmate-io --example bench_read
cd ../../bench

# 2. Python environment for the generators and the reference readers
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows (bin/python on Linux/macOS)

# 3. data and benchmark
.venv/Scripts/python make_datasets.py --rows 10000 100000 1000000 --out data
.venv/Scripts/python run_benchmark.py --data data --reps 6 --out results
.venv/Scripts/python plot_results.py --results results           # figure for the paper

# after changing the engine only: rerun ChartMate and merge (competitors unchanged, same machine)
.venv/Scripts/python run_benchmark.py --data data --reps 6 --tools ChartMate --out results_v03
.venv/Scripts/python merge_results.py --base results --new results_v03
```

Report the machine from `results/environment.json` (CPU, cores, RAM, OS, library versions) with the
results.

## Part B — end-to-end inside ChartMate

The reader time alone does not include the IPC transfer, the JavaScript parsing of the JSON and the
drawing. Since v0.3 the app shows them:

* data panel: `Load … ms (read + parse … ms)`: total `invoke()` round trip and the Rust share;
* below the Single Canvas chart: `Render … ms · N pts` and, when used, the min-max decimation ratio.

Protocol: for each size (10⁴, 10⁵, 10⁶ rows, CSV and Parquet; row limit set to *All rows*), open the
file, wait for the chart, write down the three numbers; close and reopen the app between sizes;
5 repetitions. Do it once with min-max decimation on (default) and once off. Use
`e2e_template.csv`.

## Part C — task comparison with GUI tools

### Tools and versions

LabPlot, Veusz, PlotJuggler, LibreOffice Calc (and/or Microsoft Excel), a Python script
(pandas + matplotlib) and ChartMate. Record the exact version of each.

### Format coverage

Fill the table from each tool's documentation **and** by trying to open the 10⁴-row file of every
format (✓ opens without conversion, ◐ needs a plug-in or a conversion step, ✗ not possible).
Do not copy claims from this file into the paper without checking them on the installed version.

### Tasks (same data, same target figure)

| ID | Task | Start | Stop |
|---|---|---|---|
| T1 | Open the 10⁵-row CSV and plot `t_air` against time | file chosen in the open dialog | line fully drawn |
| T2 | Same with the 10⁶-row file | idem | idem (or tool gives up: record ✗ and the reason) |
| T3 | 2×2 multi-panel figure (`t_air`, `rh`, `co2`, `power_kw`), panel letters (a)–(d), 170 mm wide | data already loaded | figure exported |
| T4 | Export T3 as vector PDF at 170 mm with text as text | figure ready | PDF written; check size in a PDF viewer |
| T5 | Hourly mean re-sampling of the 10⁶-row file, then T1 on the result | data loaded | re-sampled line drawn |

Rules: one trained operator per tool (practise each task twice before timing); 3 timed repetitions;
times from a screen recording (frame of the start and stop events), not from a hand stopwatch;
record failures and workarounds. Report the median and the range. State that the operator is the
ChartMate author (a bias), or better, use a colleague.

### Threats to validity (to state in the paper)

* warm-cache, single machine; numbers scale with disk and CPU;
* the Python tools return typed tables while ChartMate returns display-ready text cells (rule A.4);
* GUI task times depend on the operator's familiarity with each tool;
* synthetic data: regular 1-min sampling and no missing values favour every reader equally.
