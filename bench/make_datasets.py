"""Generate the benchmark / test datasets in every supported format.

The same synthetic time series (timestamp + 6 float columns + 1 integer + 1 text column) is
written to CSV, XLSX, ODS, Parquet, HDF5, netCDF-4, netCDF-3, MATLAB v5, SPSS .sav, SAS XPT
(v5 and v8) and FITS. SAS .sas7bdat cannot be written with open tools, so it is only covered by
the reference fixture shipped with the `sas7bdat` crate (see bench/README.md).

Usage:
    python make_datasets.py --rows 10000 100000 1000000 --out data
    python make_datasets.py --fixture ../tauri-app/src-tauri/tests/fixtures   # 48-row test set

The data are synthetic by construction and are used only to time readers and check that every
reader returns the same values; they carry no physical meaning.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import pandas as pd

FLOAT_COLS = ["t_air", "rh", "co2", "power_kw", "t_out", "sim_power_kw"]
SPREADSHEET_MAX_ROWS = 100_000  # writing larger XLSX/ODS takes too long and ODS is impractical


def make_frame(n: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    ts = pd.date_range("2026-01-01 00:00:00", periods=n, freq="min")
    hours = np.arange(n) / 60.0
    day = np.sin(2 * np.pi * hours / 24.0)
    df = pd.DataFrame({"timestamp": ts})
    df["t_air"] = np.round(21.0 + 1.5 * day + rng.normal(0, 0.3, n), 3)
    df["rh"] = np.round(45.0 - 8.0 * day + rng.normal(0, 2.0, n), 3)
    df["co2"] = np.round(600.0 + 250.0 * np.clip(day, 0, None) + rng.normal(0, 30.0, n), 3)
    df["power_kw"] = np.round(np.clip(4.0 + 2.0 * day + rng.normal(0, 0.5, n), 0, None), 4)
    df["t_out"] = np.round(8.0 + 5.0 * day + rng.normal(0, 0.8, n), 3)
    df["sim_power_kw"] = np.round(df["power_kw"] * 0.97 + rng.normal(0, 0.2, n), 4)
    df["occupants"] = rng.integers(0, 12, n).astype(np.int32)
    df["zone"] = np.array(["Z1", "Z2", "Z3", "Z4"])[np.arange(n) % 4]
    return df


def epoch_minutes(ts: pd.Series) -> np.ndarray:
    return ((ts - pd.Timestamp("1970-01-01")) // pd.Timedelta(minutes=1)).to_numpy(dtype=np.float64)


def write_all(df: pd.DataFrame, out: Path, stem: str, spreadsheets: bool = True) -> dict[str, float]:
    out.mkdir(parents=True, exist_ok=True)
    times: dict[str, float] = {}

    def timed(fmt: str, fn) -> None:
        t0 = time.perf_counter()
        try:
            fn()
            times[fmt] = time.perf_counter() - t0
        except Exception as exc:  # noqa: BLE001 - report and continue with the other formats
            print(f"  ! {fmt}: {exc}")

    text = df.copy()
    text["timestamp"] = text["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

    timed("csv", lambda: text.to_csv(out / f"{stem}.csv", index=False))
    timed("parquet", lambda: df.to_parquet(out / f"{stem}.parquet", index=False))
    if spreadsheets and len(df) <= SPREADSHEET_MAX_ROWS:
        timed("xlsx", lambda: df.to_excel(out / f"{stem}.xlsx", index=False, engine="openpyxl"))
        timed("ods", lambda: df.to_excel(out / f"{stem}.ods", index=False, engine="odf"))

    def h5() -> None:
        import h5py

        with h5py.File(out / f"{stem}.h5", "w") as f:
            t = f.create_dataset("time", data=epoch_minutes(df["timestamp"]))
            t.attrs["units"] = "minutes since 1970-01-01 00:00:00"
            for c in FLOAT_COLS:
                f.create_dataset(c, data=df[c].to_numpy(), compression="gzip", compression_opts=4)
            f.create_dataset("occupants", data=df["occupants"].to_numpy())

    timed("hdf5", h5)

    def nc(fmt: str, name: str) -> None:
        import netCDF4

        with netCDF4.Dataset(out / name, "w", format=fmt) as ds:
            ds.createDimension("time", len(df))
            t = ds.createVariable("time", "f8", ("time",))
            t.units = "minutes since 1970-01-01 00:00:00"
            t[:] = epoch_minutes(df["timestamp"])
            for c in FLOAT_COLS:
                v = ds.createVariable(c, "f8", ("time",), zlib=(fmt == "NETCDF4"))
                v[:] = df[c].to_numpy()
            o = ds.createVariable("occupants", "i4", ("time",))
            o[:] = df["occupants"].to_numpy()

    timed("netcdf4", lambda: nc("NETCDF4", f"{stem}.nc"))
    timed("netcdf3", lambda: nc("NETCDF3_64BIT_OFFSET", f"{stem}_classic.nc"))

    def mat() -> None:
        from scipy.io import savemat

        d = {c: df[c].to_numpy().reshape(-1, 1) for c in FLOAT_COLS}
        d["occupants"] = df["occupants"].to_numpy().astype(np.float64).reshape(-1, 1)
        # MATLAB datenum: days since year 0 (719529 = 1970-01-01)
        d["time"] = (epoch_minutes(df["timestamp"]) / 1440.0 + 719529.0).reshape(-1, 1)
        savemat(out / f"{stem}.mat", d, do_compression=False)

    timed("matlab", mat)

    def mat73() -> None:
        # MATLAB v7.3 = HDF5 with a 512-byte user block; arrays are stored transposed (1×N for N×1).
        import h5py

        path = out / f"{stem}_v73.mat"
        with h5py.File(path, "w", userblock_size=512) as f:
            for c in FLOAT_COLS:
                ds = f.create_dataset(c, data=df[c].to_numpy().reshape(1, -1))
                ds.attrs["MATLAB_class"] = np.bytes_("double")
            ds = f.create_dataset("time", data=(epoch_minutes(df["timestamp"]) / 1440.0 + 719529.0).reshape(1, -1))
            ds.attrs["MATLAB_class"] = np.bytes_("double")
        with open(path, "r+b") as fh:
            hdr = b"MATLAB 7.3 MAT-file, Platform: GLNXA64, Created by: ChartMate bench".ljust(116, b" ")
            fh.write(hdr + b"\x00" * 8 + b"\x00\x02IM")

    timed("matlab73", mat73)

    def sav() -> None:
        import pyreadstat

        pyreadstat.write_sav(df, out / f"{stem}.sav", compress=False, row_compress=True)

    timed("spss", sav)

    def xpt(version: int) -> None:
        import pyreadstat

        d = df.copy()
        if version == 5:
            d = d.rename(columns={"sim_power_kw": "simpowkw", "occupants": "occupant", "timestamp": "time"})
        pyreadstat.write_xport(d, out / f"{stem}_v{version}.xpt", file_format_version=version, table_name="DATA")

    timed("xpt5", lambda: xpt(5))
    timed("xpt8", lambda: xpt(8))

    def fits() -> None:
        from astropy.io import fits as afits
        from astropy.table import Table

        t = Table()
        t["timestamp"] = text["timestamp"].to_numpy().astype("S19")
        for c in FLOAT_COLS:
            t[c] = df[c].to_numpy()
        t["occupants"] = df["occupants"].to_numpy()
        t["zone"] = df["zone"].to_numpy().astype("S2")
        afits.BinTableHDU(t).writeto(out / f"{stem}.fits", overwrite=True)

    timed("fits", fits)
    return times


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rows", type=int, nargs="*", default=[10_000, 100_000, 1_000_000])
    ap.add_argument("--out", type=Path, default=Path(__file__).parent / "data")
    ap.add_argument("--fixture", type=Path, help="write the small 48-row test fixture set here")
    args = ap.parse_args()

    if args.fixture:
        df = make_frame(48)
        write_all(df, args.fixture, "sample")
        print(f"fixtures written to {args.fixture}")
        return

    for n in args.rows:
        print(f"n = {n:,}")
        times = write_all(make_frame(n), args.out, f"bench_{n}")
        for k, v in times.items():
            print(f"  {k:8s} {v:7.2f} s")


if __name__ == "__main__":
    main()
