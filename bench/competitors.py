"""One-shot readers of the reference Python tools, run in a fresh process by run_benchmark.py.

    python competitors.py <tool> <file>

Prints one JSON line: {"first_read_ms": ..., "read_ms": ..., "rows": ..., "cols": ...}. The file is
read twice in the same process; `read_ms` is the second (steady-state) read, `first_read_ms` the
first one. Interpreter start-up and imports are excluded (they are part of the wall time).
Every reader must materialise all values in memory (lazy objects are forced with .load()/[:]).
"""
from __future__ import annotations

import json
import sys
import time


def _shape(obj) -> tuple[int, int]:
    try:
        return int(obj.shape[0]), int(obj.shape[1])
    except Exception:  # noqa: BLE001
        return -1, -1


def pandas_csv(p):
    import pandas as pd
    return _shape(pd.read_csv(p))


def polars_csv(p):
    import polars as pl
    return _shape(pl.read_csv(p))


def pyarrow_csv(p):
    import pyarrow.csv as pc
    t = pc.read_csv(p)
    return t.num_rows, t.num_columns


def pandas_excel(p):
    import pandas as pd
    return _shape(pd.read_excel(p))  # openpyxl for .xlsx, odf for .ods


def pandas_parquet(p):
    import pandas as pd
    return _shape(pd.read_parquet(p))


def polars_parquet(p):
    import polars as pl
    return _shape(pl.read_parquet(p))


def h5py_all(p):
    import h5py
    rows, cols = 0, 0

    def visit(_name, obj):
        nonlocal rows, cols
        if isinstance(obj, h5py.Dataset):
            a = obj[()]
            rows = max(rows, max(a.shape) if a.ndim else 1)
            cols += 1

    with h5py.File(p, "r") as f:
        f.visititems(visit)
    return rows, cols


def xarray_nc(p):
    import xarray as xr
    with xr.open_dataset(p) as ds:
        ds.load()
        return int(max(ds.sizes.values())), len(ds.data_vars) + len(ds.coords)


def netcdf4_nc(p):
    import netCDF4
    with netCDF4.Dataset(p) as ds:
        n = 0
        for v in ds.variables.values():
            a = v[:]
            n = max(n, a.shape[0] if a.ndim else 1)
        return n, len(ds.variables)


def scipy_mat(p):
    from scipy.io import loadmat
    d = {k: v for k, v in loadmat(p).items() if not k.startswith("__")}
    return max(v.shape[0] for v in d.values()), len(d)


def pyreadstat_sav(p):
    import pyreadstat
    df, _ = pyreadstat.read_sav(p)
    return _shape(df)


def pandas_spss(p):
    import pandas as pd
    return _shape(pd.read_spss(p))


def pyreadstat_xpt(p):
    import pyreadstat
    df, _ = pyreadstat.read_xport(p)
    return _shape(df)


def pandas_sas(p):
    import pandas as pd
    return _shape(pd.read_sas(p))


def pyreadstat_sas7bdat(p):
    import pyreadstat
    df, _ = pyreadstat.read_sas7bdat(p)
    return _shape(df)


def astropy_fits(p):
    from astropy.table import Table
    t = Table.read(p, memmap=False)
    return len(t), len(t.colnames)


TOOLS = {
    "pandas.read_csv": (pandas_csv, ["csv"]),
    "polars.read_csv": (polars_csv, ["csv"]),
    "pyarrow.csv": (pyarrow_csv, ["csv"]),
    "pandas.read_excel": (pandas_excel, ["xlsx", "ods"]),
    "pandas.read_parquet": (pandas_parquet, ["parquet"]),
    "polars.read_parquet": (polars_parquet, ["parquet"]),
    "h5py": (h5py_all, ["hdf5", "matlab73"]),
    "xarray": (xarray_nc, ["netcdf4", "netcdf3"]),
    "netCDF4": (netcdf4_nc, ["netcdf4", "netcdf3"]),
    "scipy.io.loadmat": (scipy_mat, ["matlab"]),
    "pyreadstat": (pyreadstat_sav, ["spss"]),
    "pandas.read_spss": (pandas_spss, ["spss"]),
    "pyreadstat.xport": (pyreadstat_xpt, ["xpt5", "xpt8"]),
    "pandas.read_sas": (pandas_sas, ["xpt5", "sas7bdat"]),
    "pyreadstat.sas7bdat": (pyreadstat_sas7bdat, ["sas7bdat"]),
    "astropy": (astropy_fits, ["fits"]),
}


# Modules imported before the timer starts, so that only the read call is timed.
PRELOAD = {
    "pandas.read_csv": ["pandas"], "polars.read_csv": ["polars"], "pyarrow.csv": ["pyarrow.csv"],
    "pandas.read_excel": ["pandas", "openpyxl", "odf.opendocument"], "pandas.read_parquet": ["pandas", "pyarrow.parquet"],
    "polars.read_parquet": ["polars"], "h5py": ["h5py"], "xarray": ["xarray", "netCDF4"], "netCDF4": ["netCDF4"],
    "scipy.io.loadmat": ["scipy.io"], "pyreadstat": ["pyreadstat", "pandas"], "pandas.read_spss": ["pandas", "pyreadstat"],
    "pyreadstat.xport": ["pyreadstat", "pandas"], "pandas.read_sas": ["pandas", "pandas.io.sas"], "pyreadstat.sas7bdat": ["pyreadstat", "pandas"],
    "astropy": ["astropy.table", "astropy.io.fits"],
}


def main() -> None:
    import importlib

    tool, path = sys.argv[1], sys.argv[2]
    fn, _ = TOOLS[tool]
    for mod in PRELOAD.get(tool, []):
        importlib.import_module(mod)
    # Two reads in the same process: the first includes one-off lazy initialisation (plugin
    # discovery, JIT, lazy imports); the second is the steady-state cost in an open session.
    times = []
    try:
        for _ in range(2):
            t0 = time.perf_counter()
            rows, cols = fn(path)
            times.append((time.perf_counter() - t0) * 1e3)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}))
        sys.exit(1)
    print(json.dumps({"first_read_ms": times[0], "read_ms": times[1], "rows": rows, "cols": cols}))


if __name__ == "__main__":
    main()
