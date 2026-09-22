import polars as pl
import os
from typing import Optional, Any, Dict

def get_file_format(file_path: str) -> str:
    """Returns detected format type based on extension."""
    if not file_path:
        return "unknown"
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.parquet', '.pq']:
        return "parquet"
    elif ext in ['.xlsx', '.xls']:
        return "excel"
    elif ext == '.tsv':
        return "tsv"
    elif ext in ['.csv', '.txt']:
        return "csv"
    return "csv"

def load_data_file(file_path: str, sep: str = ',', decimal: str = '.',
                   timestamp_col: str = None, 
                   timestamp_format: str = None,
                   sheet_name: str = None) -> Optional[pl.DataFrame]:
    """
    Unified ingestion engine supporting CSV, TSV, Parquet, and Excel (.xlsx, .xls) files.
    """
    if not file_path or not os.path.exists(file_path):
        return None
    
    fmt = get_file_format(file_path)
    df = None

    try:
        if fmt == "parquet":
            df = pl.read_parquet(file_path)
        elif fmt == "excel":
            # Polars read_excel with optional sheet specification
            kwargs = {}
            if sheet_name:
                kwargs["sheet_name"] = sheet_name
            df = pl.read_excel(file_path, **kwargs)
        else:
            # CSV / TSV / Delimited text
            effective_sep = '\t' if fmt == "tsv" else (sep or ',')
            kwargs = {
                "separator": effective_sep,
                "infer_schema_length": 10000,
                "ignore_errors": True,
                "truncate_ragged_lines": True
            }
            if decimal == ',':
                kwargs["decimal_comma"] = True
                
            df = pl.read_csv(file_path, **kwargs)

        if df is None:
            return None

        # Timestamp Parsing and Normalization
        if timestamp_col and timestamp_col in df.columns:
            col_type = df[timestamp_col].dtype
            if col_type not in [pl.Datetime, pl.Date]:
                if col_type in [pl.Utf8, pl.String, pl.Object]:
                    if timestamp_format:
                        df = df.with_columns(
                            pl.col(timestamp_col).str.to_datetime(format=timestamp_format, strict=False)
                        )
                    else:
                        # Auto-infer datetime string
                        df = df.with_columns(
                            pl.col(timestamp_col).str.to_datetime(strict=False)
                        )
                elif col_type in [pl.Int64, pl.Int32, pl.Float64]:
                    # Likely Unix timestamp (seconds or ms)
                    try:
                        sample_val = df[timestamp_col].drop_nulls().head(1).item()
                        if sample_val and sample_val > 1e11: # Milliseconds
                            df = df.with_columns(pl.from_epoch(pl.col(timestamp_col), time_unit="ms"))
                        elif sample_val and sample_val > 1e8: # Seconds
                            df = df.with_columns(pl.from_epoch(pl.col(timestamp_col), time_unit="s"))
                    except Exception:
                        pass
                    
        return df

    except Exception as e:
        print(f"Error loading data file at {file_path}: {e}")
        return None

# Backwards compatibility alias
load_csv_data = load_data_file

def get_data_preview(df: pl.DataFrame, rows: int = 10) -> pl.DataFrame:
    """Returns a preview of the dataframe."""
    return df.head(rows)

def calculate_export_params(width_cm: float, height_cm: float, dpi: int):
    """
    Calculates Plotly export parameters (width_px, height_px, scale) from CM and DPI.
    1 inch = 2.54 cm.
    Base Plotly DPI = 96.
    """
    if not width_cm or width_cm <= 0: width_cm = 20.0
    if not height_cm or height_cm <= 0: height_cm = 15.0
    if not dpi or dpi <= 0: dpi = 300
    
    width_px = (width_cm / 2.54) * 96
    height_px = (height_cm / 2.54) * 96
    scale = dpi / 96
    
    return int(width_px), int(height_px), scale
