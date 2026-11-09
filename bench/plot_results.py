"""Figure and Markdown table from results/summary.csv.

    python plot_results.py --results results

Writes results/reader_benchmark.pdf / .png (small multiples, one panel per format, read time vs
rows on log-log axes; ChartMate in black) and results/summary.md (table at the largest size).
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ORDER = ["csv", "xlsx", "ods", "parquet", "hdf5", "netcdf4", "netcdf3", "matlab", "matlab73", "spss", "xpt5", "xpt8", "sas7bdat", "fits"]
LABEL = {
    "csv": "CSV", "xlsx": "XLSX", "ods": "ODS", "parquet": "Parquet", "hdf5": "HDF5", "netcdf4": "netCDF-4",
    "netcdf3": "netCDF-3", "matlab": "MATLAB v5", "matlab73": "MATLAB v7.3", "spss": "SPSS .sav",
    "xpt5": "SAS XPT v5", "xpt8": "SAS XPT v8", "sas7bdat": "SAS7BDAT", "fits": "FITS table",
}
GREYS = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e"]


def load(path: Path) -> list[dict]:
    with path.open() as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, default=Path(__file__).parent / "results")
    args = ap.parse_args()
    rows = load(args.results / "summary.csv")
    env = json.loads((args.results / "environment.json").read_text())

    by_fmt: dict[str, dict[str, list[tuple[int, float, float]]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_fmt[r["format"]][r["tool"]].append((int(r["rows_nominal"]), float(r["read_ms_median"]), float(r["read_ms_iqr"])))
    fmts = [f for f in ORDER if f in by_fmt]

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 7, "text.color": "black", "axes.labelcolor": "black",
                         "xtick.color": "black", "ytick.color": "black", "axes.edgecolor": "black", "pdf.fonttype": 42})
    ncol = 4
    nrow = (len(fmts) + ncol - 1) // ncol
    fig, axes = plt.subplots(nrow, ncol, figsize=(170 / 25.4, 42 / 25.4 * nrow), squeeze=False)
    for ax, fmt in zip(axes.flat, fmts):
        tools = sorted(by_fmt[fmt], key=lambda t: (t != "ChartMate", not t.startswith("ChartMate"), t))
        k = 0
        for tool in tools:
            pts = sorted(by_fmt[fmt][tool])
            x = [p[0] for p in pts]
            y = [p[1] for p in pts]
            if tool == "ChartMate":
                ax.plot(x, y, "-o", color="black", lw=1.4, ms=3, label=tool, zorder=5)
            elif tool.startswith("ChartMate v0.2"):
                ax.plot(x, y, ":o", color="#888888", lw=1.0, ms=2.5, mfc="white", label=tool, zorder=4)
            else:
                ax.plot(x, y, "--s", color=GREYS[k % len(GREYS)], lw=0.9, ms=2.5, label=tool)
                k += 1
        ax.set_xscale("log")
        ax.set_yscale("log")
        ax.set_title(LABEL.get(fmt, fmt), fontsize=7.5, color="black")
        ax.grid(True, which="major", lw=0.3, color="#bbbbbb")
        ax.legend(fontsize=5, frameon=False, loc="upper left")
    for ax in axes.flat[len(fmts):]:
        ax.axis("off")
    for ax in axes[:, 0]:
        ax.set_ylabel("read time [ms]")
    for ax in axes[-1, :]:
        ax.set_xlabel("rows")
    fig.suptitle(f"Warm-cache read time, median of 5 runs — {env.get('cpu', '')}, {env.get('ram_gb', '?')} GB RAM, {env.get('os', '')}", fontsize=6.5, color="black")
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    for ext in ("pdf", "png"):
        fig.savefig(args.results / f"reader_benchmark.{ext}", dpi=300)

    # Markdown table at the largest size of each format
    lines = ["| Format | Rows | Tool | Read [ms] (IQR) | First read [ms] | Peak memory [MB] | Speed-up of ChartMate |", "|---|---|---|---|---|---|---|"]
    for fmt in fmts:
        nmax = max(int(r["rows_nominal"]) for r in rows if r["format"] == fmt)
        sel = [r for r in rows if r["format"] == fmt and int(r["rows_nominal"]) == nmax]
        cm = next((float(r["read_ms_median"]) for r in sel if r["tool"] == "ChartMate"), None)
        for r in sorted(sel, key=lambda r: (r["tool"] != "ChartMate", float(r["read_ms_median"]))):
            t = float(r["read_ms_median"])
            ratio = "" if r["tool"] == "ChartMate" or not cm else f"{t / cm:.2f}×"
            lines.append(f"| {LABEL.get(fmt, fmt)} | {nmax:,} | {r['tool']} | {t:,.1f} ({float(r['read_ms_iqr']):,.1f}) | {float(r['first_read_ms_median']):,.1f} | {float(r['peak_mb_median']):,.0f} | {ratio} |")
    lines.append("")
    lines.append("Speed-up = tool read time / ChartMate read time (> 1: ChartMate faster). ChartMate returns typed columns like the other tools; 'ChartMate v0.2 (text rows)' is the earlier engine that converted every value to text (README, rule A.4).")
    (args.results / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {args.results / 'reader_benchmark.pdf'} and {args.results / 'summary.md'}")


if __name__ == "__main__":
    main()
