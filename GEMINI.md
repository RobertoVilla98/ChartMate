# GEMINI.md — Contesto di Sessione per Agente Antigravity / Gemini

Questo file è il punto di ingresso per qualsiasi nuova sessione di lavoro con **Gemini / Antigravity**.  
Leggendo questo file all'inizio di una nuova chat, l'agente saprà istantaneamente cosa fa l'applicazione, dove siamo arrivati, le regole operative vincolanti e cosa fare nei prossimi step.

---

## 📌 Identikit di ChartMate

* **Scopo**: Studio desktop per ricercatori e ingegneri per creare grafici e figure scientifiche *journal-ready* ad alta risoluzione in pochi secondi, senza dover scrivere script Matplotlib/Seaborn.
* **Tech Stack Desktop Nativo**: **Rust (Tauri v2)**, **TypeScript**, **Vite**, **Plotly.js**, PapaParse, SheetJS.
* **Eseguibile Standalone**: Singolo file Windows [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe) da appena **23.4 MB**, avvio < 1s, zero conflitti di porte, RAM < 60 MB.
* **Supporto SharePoint & Filesystem**: Drag-and-drop diretto e dialog nativo Windows per leggere file da percorsi locali/rete senza duplicare dati.
* **Design System**: ChartMate Clean Scientific (`#f8fafc`, bianco puro, accento `#059669` Emerald, font *Outfit* e *JetBrains Mono*).
* **Guida Completa di Dettaglio**: Leggi [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) per l'architettura dettagliata di ogni modulo.
* **Branch di Backup Storico**: Il precedente codice Python/Dash è salvato al 100% nel branch Git `legacy-python-dash`.

---

## 🎯 Stato Attuale: Dove Siamo Arrivati

1. **Backend Rust Nativo & Filesystem I/O ([`tauri-app/src-tauri/src/lib.rs`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/src/lib.rs))**:
   - Lettura e parsing rapido di file CSV, TSV e fogli Excel (`.xlsx`, `.xls`) con auto-detection delimitatori (`,`, `;`, `\t`).
   - Permessi Windows granulari (`dialog:allow-open`, `fs:allow-read-file`) per aprire percorsi SharePoint senza restrizioni.
2. **Controller Grafico Scientifico Client-Side ([`tauri-app/src/main.ts`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src/main.ts))**:
   - Rendering fluido a 60 FPS con Plotly.js.
   - **Fix Plotly Data Engine**: Corretto l'uso dei tipi traccia (linee come `scatter` con `mode: 'lines'`, scatter come `markers`, area come `lines` + `tozeroy`, barre come `bar`).
   - **Gestione Timeframe e Normalizzazione**: Bypass del filtro in modalità *Full* (100% dati plottati) e normalizzatore `toISODate()` per comparazioni cronologiche per *1 Day*, *1 Week*, *1 Month* e *Custom*.
   - **Parsing Numerico Robusto**: Sanitizzazione completa dei numeri con virgola europea e protezione per valori `0.0`.
   - **Isolamento CSS Schede**: Stile esplicito `.view-panel` per prevenire collassi del contenitore Plotly.
   - Gestione assi multi-variabile ($X$, $Y_1, Y_2, Y_3, Y_4$) con titoli, offset e unità di misura indipendenti.
   - **Trace Styler con Dropdown Dedicati**: Selettore a tendina dedicato per aggiungere colonne Y specifiche (`+ Aggiungi Serie`) e selettore a tendina all'interno di ogni card traccia per cambiare al volo la variabile plottata.
   - **Preset Tipografici WYSIWYG**: *Single Column* ($8.5\text{ cm}$), *Double Column* ($17\text{ cm}$), *Square* ($12\times 12\text{ cm}$).
   - **Smart Annotations**: Peak & Valley Tracker (Global, Daily, Weekly) e Comfort Band IEQ ($[20, 22]^\circ\text{C}$ inverno, $[24, 26]^\circ\text{C}$ estate, custom).
   - **Export Vector 1-Click**: Esportazione SVG diretta alle dimensioni fisiche esatte.
3. **Eseguibile Release Windows Generato**:
   - Compilazione ottimizzata con toolchain GNU: [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe) pronto nella cartella principale (**24.68 MB**), testato e funzionante.

---

## ⚠️ Regole Ingegneristiche Imperative per Gemini / Agenti

1. **Aggiornamento Continuo dei File di Log**:
   - L'utente richiede espressamente: **"Aggiorna sempre i file di log ad ogni singolo step"**.
   - Ad ogni avanzamento, bugfix o nuova feature, aggiorna subito:
     - [`PROJECT_STATUS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/PROJECT_STATUS.md)
     - [`ChartMate_Structure.txt`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate_Structure.txt)
     - [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) e [`GEMINI.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/GEMINI.md)
2. **Usa Sempre Polars (No Pandas)**: Tutte le elaborazioni dati avvengono tramite `polars as pl`. Usa la funzione `_clean_series` in `chart_engine.py` per gestire le stringhe con virgola decimale.
3. **Pagine Snelle e Engine Disaccoppiato**: I file in `pages/` gestiscono solo il layout Dash e il cablaggio dei callback; tutta la logica di generazione delle figure Plotly risiede in [`utils/chart_engine.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/utils/chart_engine.py).
4. **Dash Duplicate Outputs**: Ogni volta che un output Dash è condiviso da più callback, usa `allow_duplicate=True` e `prevent_initial_call=True`.
5. **Ridimensionamento Plotly**: Calcola sempre dimensioni esplicite `width` e `height` in pixel tramite `_calc_aspect_dimensions()` e impostale in `fig.layout` con `autosize=False`.

---

## 🔮 Roadmap: Prossime Implementazioni Richieste

1. **Carpet Plot / Heatmap Temporale (Giorno-Ora)**:
   - Asse $X$ = Giorno dell'Anno, Asse $Y$ = Ora del Giorno ($0-23\text{h}$), $Z$ = Variabile continua. Essenziale per profili orari/stagionali IEQ e monitoraggio carichi energetici.
2. **Load Duration Curve (Curva di Durata del Carico)**:
   - Ordinamento decrescente delle grandezze con calcolo automatico delle ore di superamento soglia.
3. **Compilatore Report PDF Multi-Grafico**:
   - Generazione di schede o report multipagina PDF che combinano più grafici salvati con didascalie e metadati.
4. **Connettori Database (SQLite / InfluxDB)**.
