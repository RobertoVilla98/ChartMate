# Third-party notices

ChartMate is released under the MIT licence (see `LICENSE`). It includes or links the following
third-party components; their licences apply to those components.

## Embedded binary

| Component | Source | Licence |
|---|---|---|
| `WebView2Loader.dll` (x64), embedded in the Windows executable built with MinGW | Microsoft Edge WebView2 SDK (NuGet package `Microsoft.Web.WebView2`), redistributed through the `webview2-com-sys` crate | Microsoft WebView2 SDK licence (redistributable), © Microsoft Corporation — see https://www.nuget.org/packages/Microsoft.Web.WebView2 |

The application uses the Microsoft Edge WebView2 Runtime installed on the system (preinstalled on
Windows 10/11); the runtime itself is not redistributed.

## Main libraries

| Component | Licence |
|---|---|
| Tauri, `@tauri-apps/api` | Apache-2.0 OR MIT |
| Plotly.js | MIT |
| jsPDF, svg2pdf.js | MIT |
| calamine | MIT |
| Apache Parquet / Arrow (Rust) | Apache-2.0 |
| hdf5-reader, netcdf-reader | MIT OR Apache-2.0 |
| matfile | MIT |
| sas7bdat | MIT |
| csv | Unlicense OR MIT |
| mysql (Rust) | MIT OR Apache-2.0 |
| sha2 | MIT OR Apache-2.0 |
| ryu | Apache-2.0 OR BSL-1.0 |

The complete dependency lists are in `tauri-app/package-lock.json` and
`tauri-app/src-tauri/Cargo.lock`.
