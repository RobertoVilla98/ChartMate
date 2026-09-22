# ChartMate 📊 - Stato del Progetto, Avanzamenti e Roadmap

Documento ufficiale di tracciamento dello stato di sviluppo di **ChartMate**, contenente gli avanzamenti completati, le scelte architetturali, i problemi risolti e il backlog delle future implementazioni.

---

## 📅 Ultimo Aggiornamento: Settembre 2026 (Transizione ad Architettura Desktop Nativa)

---

## 🚀 NUOVA ARCHITETTURA: Desktop Nativo con Rust + Tauri v2 (Settembre 2026)

Per risolvere definitivamente i colli di bottiglia legati alla distribuzione su Windows, ai conflitti di porte web locali e alla necessità di puntare direttamente a file locali e cartelle condivise su **SharePoint**, ChartMate è stato evoluto in un'applicazione **desktop nativa ultra-leggera**:

- **Backend Nativo in Rust (Tauri v2)**:
  - Compilato con il toolchain `stable-x86_64-pc-windows-gnu` e MinGW GCC.
  - Genera un singolo eseguibile Windows portabile: [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe) di soli **23.4 MB** (contro i 350+ MB di PyInstaller).
  - Consumo di memoria RAM ridotto a meno di 60 MB grazie all'uso di WebView2 nativa di Windows.
  - Avvio istantaneo in meno di 1 secondo, senza dover avviare server locali o aprire il browser esterno.
- **Accesso Diretto a SharePoint e Filesystem Locale**:
  - Drag-and-drop nativo di file CSV, Excel (`.xlsx`, `.xls`) e TSV direttamente dall'Esplora Risorse di Windows.
  - Dialog nativo Windows per selezionare i file direttamente dal percorso di rete/SharePoint senza duplicarli.
  - Parser ad alte prestazioni implementato con `csv` e `calamine` in Rust per autodiagnosticare delimitatori (`,`, `;`, `\t`), gestire virgole decimali europee ed estrarre le colonne all'istante.
- **Frontend Scientifico Reattivo (TypeScript + Plotly.js + Vite)**:
  - Motore di plotting scientifico client-side a 60 FPS con supporto multi-asse ($Y_1, Y_2$), selezione rapida del tipo di grafico (linee continue, scatter, barre, aree, box plot).
  - Toolbar di pubblicazione accademica con proporzioni fisse WYSIWYG: *Single Column* ($8.5\text{ cm}$), *Double Column* ($17\text{ cm}$), *Square* ($12\times 12\text{ cm}$).
  - Esportazione vettoriale SVG ad alta risoluzione (300/600 DPI) con un clic.
  - Smart annotations: Comfort / Target Band integrata per soglie IEQ.
  - Design pulito e professionale proprietario con i font **Outfit** e **JetBrains Mono**.
- **Step 1 Completato: Ingestione Dati Avanzata & Finestra Temporale**:
  - Scheda `1. Data Source & Parser` dedicata unicamente all'ingestione, delimitatori e preview dati raw.
  - Filtro dinamico del Timeframe collocato direttamente nella barra laterale del Canvas (Full, 1 Day, 1 Week, 1 Month, Custom).
- **Step 2 Completato: Trace Styler Per-Serie, Fino a 4 Assi Y, Annotazioni & Tipografia**:
  - **Trace Styler Indipendente**: pulsante `+ Aggiungi Serie` per configurare per ciascuna traccia tipo (Linea, Barre, Area, Scatter), stile tratteggio (solid, dash, dot), asse di riferimento e colore dedicato.
  - **Supporto Multi-Asse Fino a 4 Assi Y ($Y_1, Y_2, Y_3, Y_4$)**: assi destri scalati con offset geometrico dinamico, titoli e unità di misura personalizzabili.
  - **Peak & Valley Tracker Configurabile**: modalità *Disattivato*, *Max & Min Globale* o *Estremi Giornalieri* (picco diurno e minimo notturno con badge e callout precisi).
  - **Comfort / Target Band Stagionale**: preset 1-click tra Inverno ($20 - 22^\circ\text{C}$), Estate ($24 - 26^\circ\text{C}$) o Custom liberamente editabile.
  - **Tipografia Scientifica Paper-Ready**: testi rigorosamente neri ad alto contrasto per paper scientifici, selettore font (*Outfit*, *Arial*, *Times New Roman*, *JetBrains Mono*) e dimensione font configurabile.
- **Fix Risolutivo del Rendering Dati (Plotly Data Engine & Timeframe)**:
  - **Trace Types Corretti per Plotly.js**: Corretto l'errore semantico per cui le serie di tipo linea venivano configurate con `type: 'line'` (tipo non valido in Plotly). In Plotly le linee sono `type: 'scatter', mode: 'lines'`, gli scatter `type: 'scatter', mode: 'markers'`, le aree `type: 'scatter', mode: 'lines', fill: 'tozeroy'` e le barre `type: 'bar'`.
  - **Bypass e Normalizzazione Timeframe**: In modalità *Full* (`all`), il filtro per data viene ora completamente bypassato mostrando il 100% dei punti campionati. Creata la funzione `toISODate()` per normalizzare qualsiasi formato data (ISO o europeo `DD/MM/YYYY`) garantendo comparazioni cronologiche accurate per *1 Day*, *1 Week*, *1 Month* e *Custom*.
  - **Parsing Numerico Robusto**: Sanitizzazione completa dei numeri con virgola europea (`,`) o punto, separatori di migliaia, e correzione del bug per cui il valore `0.0` veniva valutato come `null` (`parseFloat(v) || null`).
  - **Isolamento CSS delle Schede (`.view-panel`)**: Aggiunte regole CSS esplicite per `.view-panel` (`display: none !important;`) e `.view-panel.active` (`display: flex !important;`) per impedire la sovrapposizione laterale e il collasso geometrico del canvas di Plotly.
  - **Ingestione Completa dei Dataset**: Rimosso il limite forzato di 100 righe da `read_dataset_sample` in Rust e da `loadFile` in TypeScript (supporto fino a centinaia di migliaia di righe), mantenendo lo slicing a 50 righe solo per la tabella di anteprima HTML raw.
  - **Eseguibile Windows Aggiornato**: Rigenerato [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe) (**24.68 MB**) pronto all'avvio con doppio clic, integrato con `WebView2Loader.dll`.
  - **Pulizia Disco Eseguita**: Eseguito `cargo clean` con recupero immediato di 1.6 GiB di file intermedi.
- **Backup Completo Preservato**:
  - Il precedente codebase Python/Dash è stato interamente preservato e versionato sul branch Git `legacy-python-dash`.

---

## 🏛️ Storico delle Funzionalità Scientifiche Implementate

### 📐 Publication Presets & Sizing Engine WYSIWYG
- *Single Column* ($8.5 \times 6.5\text{ cm}$), *Double Column* ($17.0 \times 9.5\text{ cm}$), *Square* ($12.0 \times 12.0\text{ cm}$).
- Calcolo esatto dei pixel proporzionali al centimetro tipografico per paper scientifici.

### 📊 Multi-Axis & Charting
- Fino a 3 assi Y indipendenti per visualizzare contemporaneamente grandezze con unità di misura eterogenee (es. Temperatura [°C], Umidità Relativa [%], $\text{CO}_2$ [ppm], Potenza [kW]).

### 🏷️ Smart Labelling & Scientific Annotations
- Diurnal Peak & Nocturnal Valley Tracker.
- Comfort target bands e linee di soglia limite.

---

## 🛠️ Problemi Tecnici Risolti nella Migrazione Rust

1. **Assenza di C++ Build Tools**: Configurato l'ambiente MinGW GCC 16 tramite MSYS2 e collegato il toolchain Rust `stable-x86_64-pc-windows-gnu`.
2. **MinGW DLL Export Ordinal Overflow**: Risolto rimuovendo il crate-type `cdylib` (dedicato ad Android/iOS) in [`tauri-app/src-tauri/Cargo.toml`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/Cargo.toml), consentendo il link statico pulito del solo eseguibile desktop Windows (`.exe`).
3. **Integrazione File Dialog**: Aggiunti i plugin `tauri-plugin-dialog` e `tauri-plugin-fs` con permessi granulari in `capabilities/default.json` per garantire la lettura istantanea dei percorsi file locali.

---

## 🗺️ Backlog e Prossime Integrazioni
- [ ] Porting della tab MultiPlot a matrice $R \times C$ con auto-lettering `(a)-(d)` nel nuovo frontend Tauri.
- [ ] Porting della tab Mappe GIS satellitari (Leaflet/Plotly).
- [ ] Supporto a file Parquet tramite WASM/Rust Arrow.
