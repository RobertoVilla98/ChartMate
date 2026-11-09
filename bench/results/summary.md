| Format | Rows | Tool | Read [ms] (IQR) | First read [ms] | Peak memory [MB] | Speed-up of ChartMate |
|---|---|---|---|---|---|---|
| CSV | 1,000,000 | ChartMate | 697.1 (22.4) | 699.2 | 302 |  |
| CSV | 1,000,000 | polars.read_csv | 89.8 (26.3) | 98.7 | 270 | 0.13× |
| CSV | 1,000,000 | pyarrow.csv | 107.2 (5.0) | 113.3 | 340 | 0.15× |
| CSV | 1,000,000 | pandas.read_csv | 160.9 (22.6) | 156.3 | 314 | 0.23× |
| CSV | 1,000,000 | ChartMate v0.2 (text rows) | 1,666.9 (198.6) | 1,476.0 | 526 | 2.39× |
| XLSX | 100,000 | ChartMate | 1,279.2 (21.2) | 1,288.2 | 69 |  |
| XLSX | 100,000 | ChartMate v0.2 (text rows) | 1,662.8 (109.6) | 1,580.6 | 76 | 1.30× |
| XLSX | 100,000 | pandas.read_excel | 22,206.7 (3,529.9) | 21,443.0 | 168 | 17.36× |
| ODS | 100,000 | ChartMate | 1,108.2 (28.1) | 1,147.4 | 92 |  |
| ODS | 100,000 | ChartMate v0.2 (text rows) | 1,284.5 (79.7) | 1,309.7 | 109 | 1.16× |
| ODS | 100,000 | pandas.read_excel | 109,149.2 (14,144.8) | 96,174.6 | 2,462 | 98.49× |
| Parquet | 1,000,000 | ChartMate | 373.9 (11.6) | 374.1 | 307 |  |
| Parquet | 1,000,000 | polars.read_parquet | 58.8 (1.8) | 74.4 | 178 | 0.16× |
| Parquet | 1,000,000 | pandas.read_parquet | 69.1 (8.9) | 112.8 | 330 | 0.18× |
| Parquet | 1,000,000 | ChartMate v0.2 (text rows) | 6,146.5 (289.5) | 5,429.6 | 561 | 16.44× |
| HDF5 | 1,000,000 | ChartMate | 472.9 (73.1) | 477.7 | 260 |  |
| HDF5 | 1,000,000 | h5py | 420.4 (28.9) | 427.9 | 62 | 0.89× |
| HDF5 | 1,000,000 | ChartMate v0.2 (text rows) | 2,988.1 (725.9) | 2,313.2 | 521 | 6.32× |
| netCDF-4 | 1,000,000 | ChartMate | 490.5 (5.4) | 493.1 | 258 |  |
| netCDF-4 | 1,000,000 | netCDF4 | 298.2 (10.0) | 295.5 | 106 | 0.61× |
| netCDF-4 | 1,000,000 | xarray | 1,857.1 (88.5) | 1,619.8 | 211 | 3.79× |
| netCDF-4 | 1,000,000 | ChartMate v0.2 (text rows) | 2,932.6 (290.9) | 2,366.4 | 532 | 5.98× |
| netCDF-3 | 1,000,000 | ChartMate | 273.4 (4.8) | 272.6 | 257 |  |
| netCDF-3 | 1,000,000 | netCDF4 | 96.1 (2.3) | 94.7 | 58 | 0.35× |
| netCDF-3 | 1,000,000 | xarray | 111.1 (16.7) | 130.9 | 162 | 0.41× |
| netCDF-3 | 1,000,000 | ChartMate v0.2 (text rows) | 3,001.1 (477.4) | 2,190.6 | 526 | 10.98× |
| MATLAB v5 | 1,000,000 | ChartMate | 256.8 (32.5) | 250.9 | 257 |  |
| MATLAB v5 | 1,000,000 | scipy.io.loadmat | 45.8 (7.7) | 43.3 | 113 | 0.18× |
| MATLAB v5 | 1,000,000 | ChartMate v0.2 (text rows) | 2,730.1 (55.5) | 2,158.8 | 528 | 10.63× |
| MATLAB v7.3 | 1,000,000 | ChartMate | 227.4 (7.5) | 224.8 | 235 |  |
| MATLAB v7.3 | 1,000,000 | h5py | 28.3 (14.4) | 29.6 | 50 | 0.12× |
| MATLAB v7.3 | 1,000,000 | ChartMate v0.2 (text rows) | 2,460.4 (320.2) | 1,975.0 | 455 | 10.82× |
| SPSS .sav | 1,000,000 | ChartMate | 487.1 (7.4) | 486.3 | 304 |  |
| SPSS .sav | 1,000,000 | pandas.read_spss | 2,879.8 (197.6) | 2,662.6 | 332 | 5.91× |
| SPSS .sav | 1,000,000 | pyreadstat | 2,902.1 (238.9) | 2,606.2 | 332 | 5.96× |
| SPSS .sav | 1,000,000 | ChartMate v0.2 (text rows) | 2,925.8 (346.9) | 2,452.2 | 573 | 6.01× |
| SAS XPT v5 | 1,000,000 | ChartMate | 461.2 (12.7) | 461.9 | 301 |  |
| SAS XPT v5 | 1,000,000 | pandas.read_sas | 1,207.9 (4.9) | 1,231.2 | 341 | 2.62× |
| SAS XPT v5 | 1,000,000 | ChartMate v0.2 (text rows) | 2,914.8 (322.5) | 2,432.2 | 573 | 6.32× |
| SAS XPT v5 | 1,000,000 | pyreadstat.xport | 7,468.8 (150.5) | 7,513.6 | 333 | 16.20× |
| SAS XPT v8 | 1,000,000 | ChartMate | 464.8 (14.1) | 461.1 | 301 |  |
| SAS XPT v8 | 1,000,000 | ChartMate v0.2 (text rows) | 2,470.8 (4.5) | 2,469.3 | 573 | 5.32× |
| SAS XPT v8 | 1,000,000 | pyreadstat.xport | 7,372.2 (26.4) | 7,475.6 | 332 | 15.86× |
| FITS table | 1,000,000 | ChartMate | 259.2 (6.6) | 258.8 | 301 |  |
| FITS table | 1,000,000 | astropy | 178.6 (31.2) | 179.4 | 152 | 0.69× |
| FITS table | 1,000,000 | ChartMate v0.2 (text rows) | 2,129.8 (191.1) | 1,681.9 | 558 | 8.22× |

Speed-up = tool read time / ChartMate read time (> 1: ChartMate faster). ChartMate returns typed columns like the other tools; 'ChartMate v0.2 (text rows)' is the earlier engine that converted every value to text (README, rule A.4).