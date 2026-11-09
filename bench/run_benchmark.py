"""Reader benchmark: ChartMate I/O engine vs. reference Python libraries.

Protocol (see bench/README.md for the full description):
  * every (tool, file, repetition) runs in a fresh process; the first repetition is a warm-up
    and is discarded, so all reported runs read from the OS file cache (warm cache);
  * `read_ms` is timed inside the process around the read call only; each process reads the
    file twice and `read_ms` is the second read (steady state in an open session), while
    `first_read_ms` keeps the first one (includes lazy initialisation);
  * `wall_ms` is the process wall time (includes interpreter / binary start-up and imports);
  * `peak_mb` is the peak working set (Windows) or peak RSS sampled every 5 ms (other OSs);
  * the summary reports the median and the interquartile range of the kept repetitions.

Usage:
    python run_benchmark.py --data data --reps 6 --out results
    python run_benchmark.py --data data --only csv parquet --tools ChartMate pandas.read_csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import re
import statistics
import subprocess
import sys
import time
from pathlib import Path

import psutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from competitors import TOOLS  # noqa: E402

EXE = ROOT / "tauri-app" / "src-tauri" / "target" / "release" / "examples" / ("bench_read.exe" if os.name == "nt" else "bench_read")

PATTERNS = [
    (r"bench_(\d+)_classic\.nc$", "netcdf3"),
    (r"bench_(\d+)\.nc$", "netcdf4"),
    (r"bench_(\d+)_v73\.mat$", "matlab73"),
    (r"bench_(\d+)\.mat$", "matlab"),
    (r"bench_(\d+)_v5\.xpt$", "xpt5"),
    (r"bench_(\d+)_v8\.xpt$", "xpt8"),
    (r"bench_(\d+)\.csv$", "csv"),
    (r"bench_(\d+)\.xlsx$", "xlsx"),
    (r"bench_(\d+)\.ods$", "ods"),
    (r"bench_(\d+)\.parquet$", "parquet"),
    (r"bench_(\d+)\.h5$", "hdf5"),
    (r"bench_(\d+)\.sav$", "spss"),
    (r"bench_(\d+)\.fits$", "fits"),
    (r"bench_(\d+)\.sas7bdat$", "sas7bdat"),
]


def discover(data: Path) -> list[tuple[int, str, Path]]:
    out = []
    for p in sorted(data.iterdir()):
        for pat, fmt in PATTERNS:
            m = re.search(pat, p.name)
            if m:
                out.append((int(m.group(1)), fmt, p))
                break
    return sorted(out)


def run_once(cmd: list[str], timeout: float) -> dict:
    t0 = time.perf_counter()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    peak = 0
    try:
        ps = psutil.Process(proc.pid)
        while proc.poll() is None:
            try:
                # Sum over the process tree: on Windows a venv python.exe is a launcher that
                # starts the real interpreter as a child process.
                tree = [ps] + ps.children(recursive=True)
                total = 0
                for q in tree:
                    try:
                        mi = q.memory_info()
                        total += getattr(mi, "peak_wset", 0) or mi.rss
                    except psutil.Error:
                        pass
                peak = max(peak, total)
            except psutil.Error:
                break
            if time.perf_counter() - t0 > timeout:
                proc.kill()
                return {"error": f"timeout > {timeout:.0f} s"}
            time.sleep(0.005)
    except psutil.Error:
        pass
    out, err = proc.communicate()
    wall_ms = (time.perf_counter() - t0) * 1e3
    lines = [ln for ln in out.strip().splitlines() if ln.startswith("{")]
    if not lines:
        return {"error": (err or out).strip()[-300:] or f"exit code {proc.returncode}"}
    res = json.loads(lines[-1])
    if len(lines) > 1:  # ChartMate engine prints one line per in-process repetition
        res["first_read_ms"] = json.loads(lines[0]).get("parse_ms")
    res["wall_ms"] = wall_ms
    res["peak_mb"] = peak / 2**20
    return res


def environment() -> dict:
    import importlib

    env = {
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "os": platform.platform(),
        "cpu": platform.processor(),
        "cpu_cores_logical": psutil.cpu_count(),
        "cpu_cores_physical": psutil.cpu_count(logical=False),
        "ram_gb": round(psutil.virtual_memory().total / 2**30, 1),
        "python": sys.version.split()[0],
        "chartmate_engine": "chartmate-io 0.3.0 (release build, bench_read example)",
    }
    for mod in ["numpy", "pandas", "polars", "pyarrow", "h5py", "netCDF4", "xarray", "scipy", "pyreadstat", "astropy", "openpyxl", "odf"]:
        try:
            m = importlib.import_module(mod)
            env[mod] = getattr(m, "__version__", "?")
        except Exception:  # noqa: BLE001
            env[mod] = "missing"
    return env


def iqr(v: list[float]) -> float:
    if len(v) < 4:
        return max(v) - min(v) if v else float("nan")
    q = statistics.quantiles(v, n=4)
    return q[2] - q[0]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=HERE / "data")
    ap.add_argument("--out", type=Path, default=HERE / "results")
    ap.add_argument("--reps", type=int, default=6, help="repetitions per case, the first is discarded")
    ap.add_argument("--timeout", type=float, default=600.0)
    ap.add_argument("--only", nargs="*", help="formats to run (csv xlsx ods parquet hdf5 ...)")
    ap.add_argument("--tools", nargs="*", help="tools to run (ChartMate, pandas.read_csv, ...)")
    args = ap.parse_args()

    if not EXE.exists():
        sys.exit(f"Build the engine first:\n  cd tauri-app/src-tauri && cargo build --release -p chartmate-io --example bench_read\n(missing {EXE})")
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "environment.json").write_text(json.dumps(environment(), indent=2))

    cases = discover(args.data)
    if args.only:
        cases = [c for c in cases if c[1] in args.only]
    raw_path = args.out / "raw.csv"
    fields = ["tool", "format", "rows_nominal", "file_mb", "rep", "read_ms", "first_read_ms", "ipc_json_ms", "wall_ms", "peak_mb", "rows_read", "cols_read", "error"]
    rows_out = []
    with raw_path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for n, fmt, path in cases:
            tools = [("ChartMate", [str(EXE), str(path), "--repeat", "2"])]
            tools += [(name, [sys.executable, "-I", str(HERE / "competitors.py"), name, str(path)]) for name, (_, fmts) in TOOLS.items() if fmt in fmts]
            if args.tools:
                tools = [t for t in tools if t[0] in args.tools]
            for name, cmd in tools:
                for rep in range(args.reps):
                    r = run_once(cmd, args.timeout)
                    row = {
                        "tool": name,
                        "format": fmt,
                        "rows_nominal": n,
                        "file_mb": round(path.stat().st_size / 2**20, 3),
                        "rep": rep,
                        "read_ms": r.get("read_ms", r.get("parse_ms")),
                        "first_read_ms": r.get("first_read_ms"),
                        "ipc_json_ms": r.get("ipc_ms", r.get("json_ms")),
                        "wall_ms": r.get("wall_ms"),
                        "peak_mb": r.get("peak_mb"),
                        "rows_read": r.get("rows"),
                        "cols_read": r.get("cols"),
                        "error": r.get("error", ""),
                    }
                    w.writerow(row)
                    fh.flush()
                    rows_out.append(row)
                    status = row["error"] or f"{row['read_ms']:.1f} ms"
                    print(f"{fmt:9s} n={n:>9,} {name:22s} rep {rep}: {status}")
                    if row["error"]:
                        break  # do not repeat a failing case

    summarise(rows_out, args.out)


def summarise(rows: list[dict], out: Path) -> None:
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        if r["error"] or r["rep"] == 0:
            continue
        groups.setdefault((r["format"], r["rows_nominal"], r["tool"]), []).append(r)
    summary = []
    for (fmt, n, tool), rs in sorted(groups.items()):
        rt = [float(r["read_ms"]) for r in rs]
        summary.append({
            "format": fmt,
            "rows_nominal": n,
            "tool": tool,
            "n_runs": len(rs),
            "read_ms_median": round(statistics.median(rt), 2),
            "read_ms_iqr": round(iqr(rt), 2),
            "first_read_ms_median": round(statistics.median([float(r["first_read_ms"]) for r in rs]), 2),
            "ipc_json_ms_median": round(statistics.median([float(r["ipc_json_ms"]) for r in rs]), 2) if rs[0]["ipc_json_ms"] is not None else "",
            "wall_ms_median": round(statistics.median([float(r["wall_ms"]) for r in rs]), 1),
            "peak_mb_median": round(statistics.median([float(r["peak_mb"]) for r in rs]), 1),
            "rows_read": rs[0]["rows_read"],
            "file_mb": rs[0]["file_mb"],
        })
    errors = sorted({(r["format"], r["rows_nominal"], r["tool"], r["error"]) for r in rows if r["error"]})
    with (out / "summary.csv").open("w", newline="") as fh:
        if summary:
            w = csv.DictWriter(fh, fieldnames=list(summary[0].keys()))
            w.writeheader()
            w.writerows(summary)
    with (out / "failures.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["format", "rows_nominal", "tool", "error"])
        w.writerows(errors)
    print(f"\nsummary: {out / 'summary.csv'}  ({len(summary)} cases, {len(errors)} failures)")


if __name__ == "__main__":
    main()
