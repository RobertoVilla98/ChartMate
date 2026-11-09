"""Merge a ChartMate-only rerun into results/summary.csv, keeping the earlier engine as a series.

    python merge_results.py --base results --new results_v03 --old-label "ChartMate v0.2 (text rows)"
"""
import argparse
import csv
import shutil
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--base", type=Path, default=Path("results"))
ap.add_argument("--new", type=Path, default=Path("results_v03"))
ap.add_argument("--old-label", default="ChartMate v0.2 (text rows)")
a = ap.parse_args()

base_rows = list(csv.DictReader((a.base / "summary.csv").open()))
new_rows = list(csv.DictReader((a.new / "summary.csv").open()))
if not (a.base / "summary_v02.csv").exists():
    shutil.copy(a.base / "summary.csv", a.base / "summary_v02.csv")
out = []
for r in base_rows:
    if r["tool"] == "ChartMate":
        r["tool"] = a.old_label
    if r["tool"] != "ChartMate":
        out.append(r)
out += [r for r in new_rows if r["tool"] == "ChartMate"]
fields = list(base_rows[0].keys())
with (a.base / "summary.csv").open("w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=fields)
    w.writeheader()
    w.writerows(sorted(out, key=lambda r: (r["format"], int(r["rows_nominal"]), r["tool"])))
shutil.copy(a.new / "raw.csv", a.base / "raw_chartmate_v03.csv")
print(f"merged {len(new_rows)} new ChartMate rows")
