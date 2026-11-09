# Contributing to ChartMate

Thank you for considering a contribution. ChartMate is maintained by Roberto Villa; issues and
pull requests are reviewed on a best-effort basis, usually within two weeks.

## Reporting a problem

Open a GitHub issue with:

* the ChartMate version and operating system;
* the file format and, if possible, a small file that reproduces the problem (anonymise it first);
* what you expected and what happened (a screenshot helps).

For a file that does not open, the message in the data panel (reader notes) is the most useful part.

## Development set-up

```bash
cd tauri-app
npm ci
npm run tauri dev          # desktop app with hot reload
```

Windows with the MinGW toolchain: prepend `C:\msys64\mingw64\bin` to `PATH` before any `cargo`
command (MinGW `dlltool` is also used by `build.rs` to delay-load the embedded WebView2 loader). Do not run `cargo clean` unless needed (the incremental cache saves minutes).

## Code layout

| Path | Content |
|---|---|
| `tauri-app/src-tauri/chartmate-io/` | Rust I/O engine: readers for all formats, timestamps, re-sampling. No Tauri dependency. |
| `tauri-app/src-tauri/src/lib.rs` | Tauri commands (thin wrappers), projects store, MySQL. |
| `tauri-app/src/scientific_modules.ts` | Building-physics and editorial calculations (pure functions). |
| `tauri-app/src/{core,ui,events,charts,data}/` | Front end. New listeners go in the matching `events/*_events.ts`. |
| `bench/` | Reader benchmark and comparison protocol. |

## Tests (required for every pull request)

```bash
cd tauri-app && npm test                                  # TypeScript calculations
cd tauri-app/src-tauri && cargo test -p chartmate-io      # readers and re-sampling
```

* A new reader needs a fixture written by `bench/make_datasets.py --fixture` (or a small public
  file with a compatible licence) and a case in `chartmate-io/tests/formats.rs` that compares its
  values with the CSV reference.
* A change to a standard-based calculation needs a test against an independent reference
  (published example, pythermalcomfort, hand calculation) and the clause of the standard in a comment.
* Chart text must stay pure black (`#000000`).

## Adding a file format

1. Write `chartmate-io/src/formats/<format>.rs` returning a `Table` (column-oriented).
2. Register the extension in `formats::detect_format` and `formats::read_table`.
3. Add the extension to the open dialog in `tauri-app/src/data/loader.ts`.
4. Add a fixture and a test; add the format to `bench/make_datasets.py` and `bench/competitors.py`.

Prefer pure-Rust dependencies: they keep the Windows, macOS and Linux builds free of C toolchains.

## Releases

Releases are tagged `vX.Y.Z` and built by `.github/workflows/release.yml`. Each release is
archived on Zenodo; update `CITATION.cff` with the DOI.

## Licence

By contributing you agree that your contribution is released under the MIT licence of the project.
