import polars as pl
import os
from typing import Optional, Any

def load_csv_data(file_path: str, sep: str = ',', decimal: str = '.',
                  timestamp_col: str = None, 
                  timestamp_format: str = None) -> Optional[pl.DataFrame]:
    """Loads CSV data with custom parameters."""
    if not os.path.exists(file_path):
        return None
    try:
        kwargs = {
            "separator": sep,
            "infer_schema_length": 10000,
            "ignore_errors": True
        }
        if decimal == ',':
            kwargs["decimal_comma"] = True
            
        df = pl.read_csv(file_path, **kwargs)
        
        if timestamp_col and timestamp_col in df.columns:
            if df[timestamp_col].dtype != pl.Datetime and df[timestamp_col].dtype != pl.Date:
                if timestamp_format:
                    df = df.with_columns(
                        pl.col(timestamp_col).str.to_datetime(format=timestamp_format, strict=False)
                    )
                else:
                    df = df.with_columns(
                        pl.col(timestamp_col).str.to_datetime(strict=False)
                    )
                
        return df
    except Exception as e:
        print(f"Error loading CSV at {file_path}: {e}")
        return None

def get_data_preview(df: pl.DataFrame, rows: int = 5) -> pl.DataFrame:
    """Returns a preview of the data."""
    return df.head(rows)

def calculate_export_params(width_cm: float, height_cm: float, dpi: int):
    """
    Calculates Plotly export parameters (width, height, scale) from CM and DPI.
    
    1 inch = 2.54 cm.
    Base Plotly DPI = 96.
    """
    width_px = (width_cm / 2.54) * 96
    height_px = (height_cm / 2.54) * 96
    scale = dpi / 96
    
    return int(width_px), int(height_px), scale
