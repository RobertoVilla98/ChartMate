# GEMINI.md — Contesto di Sessione per Agente Antigravity / Gemini

Questo file è il punto di ingresso per qualsiasi nuova sessione di lavoro con **Gemini / Antigravity**.  
Leggendo questo file all'inizio di una nuova chat, l'agente saprà istantaneamente cosa fa l'applicazione, dove siamo arrivati, le regole operative vincolanti e cosa fare nei prossimi step.

---

## 📌 Identikit di ChartMate

* **Scopo**: Studio desktop per ricercatori e ingegneri per creare grafici, matrici multi-pannello e mappe GIS *journal-ready* ad alta risoluzione in pochi secondi, senza dover scrivere script Matplotlib/Seaborn/Geopandas.
* **Tech Stack Desktop Nativo**: **Rust (Tauri v2)**, **TypeScript**, **Vite**, **Plotly.js**, crate Rust `parquet`, `mysql`, `calamine`, `csv`.
* **Eseguibile Standalone**: Singolo file Windows [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe), avvio < 1s, zero conflitti di porte, RAM < 60 MB.
* **Supporto SharePoint, Parquet, MySQL & Filesystem**: Drag-and-drop diretto e dialog nativo Windows per leggere file CSV, Excel, Apache Parquet (`.parquet`, `.pq`) o connettersi a database relazionali **MySQL**.
* **Design System**: ChartMate Clean Scientific (`#f8fafc`, bianco puro, accento `#059669` Emerald, font *Outfit* e *JetBrains Mono*).
* **Guida Completa di Dettaglio**: Leggi [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) per l'architettura dettagliata di ogni modulo.
* **Branch di Backup Storico**: Il precedente codice Python/Dash è salvato al 100% nel branch Git `legacy-python-dash`.

---

## 🎯 Stato Attuale: Dove Siamo Arrivati

1. **Backend Rust Nativo, Parquet, MySQL & Filesystem I/O ([`tauri-app/src-tauri/src/lib.rs`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/src/lib.rs))**:
   - Lettura e parsing rapido di file **Apache Parquet (`.parquet`, `.pq`)**, CSV, TSV e fogli Excel (`.xlsx`, `.xls`) con auto-detection delimitatori (`,`, `;`, `\t`) e decodifica automatica dei timestamp logici Parquet.
   - Connettore nativo **MySQL** (`test_sql_connection`, `execute_sql_query`) con `rustls-tls` (zero dipendenze OpenSSL esterne) per interrogare tabelle e viste SQL direttamente dalla Tab 1.
   - Permessi Windows granulari (`dialog:allow-open`, `fs:allow-read-file`) per aprire percorsi SharePoint senza restrizioni.
2. **Tab 1 — Data Source, SQL & Configuratore Geospaziale ([`tauri-app/src/main.ts`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src/main.ts))**:
   - Selettore sorgente dati: *File Locale (CSV/Excel/Parquet)* vs *Database SQL (MySQL)*.
   - Auto-rilevamento intelligente delle colonne di Latitudine e Longitudine e scelta del formato coordinate (*Gradi Decimali DD* vs *Gradi Minuti Secondi DMS*).
3. **Tab 2 — Single Canvas Studio**:
   - Rendering fluido a 60 FPS con Plotly.js, fino a 4 assi Y indipendenti ($Y_1, Y_2, Y_3, Y_4$).
   - Trace Styler con dropdown dedicati, preset tipografici WYSIWYG (*Single Column* $8.5\text{ cm}$, *Double Column* $17\text{ cm}$, *Square* $12\times 12\text{ cm}$), Peak & Valley Tracker e Comfort Band IEQ.
4. **Tab 3 — MultiPlot Grid Studio (Sbloccata e Funzionante)**:
   - Topologie 1-Click: *Stack Verticale 3×1*, *Stack Verticale 2×1*, *Matrice 2×2* (4 quadranti) e *Side-by-Side 1×2*.
   - Asse X condiviso e sincronizzato (`matches: 'x'`) con occultamento automatico dei label intermedi e **Auto-Lettering Accademico** **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`**.
   - Configurazione per singolo pannello con serie primaria $Y_1$, serie secondaria $Y_2$ (doppio asse nel pannello) e importazione diretta da qualsiasi Canvas salvato.
5. **Tab 4 — Maps & Geo-Analytics Studio (Nuova Scheda Cartografica)**:
   - 3 modalità di visualizzazione: *Bubble Scatter Map*, *Spatial Density Heatmap*, *GPS Trajectory / Track*.
   - 5 Base Map Providers: *CartoDB Positron*, *ESRI World Imagery Satellite*, *OpenStreetMap*, *CartoDB Dark Matter*, *OpenTopoMap*.
   - **Motore di Clusterizzazione Spaziale & Operazioni Matematiche**: Griglia spaziale configurabile ($0.0005^\circ \div 0.10^\circ$) con calcolo automatico su ciascuna cella di **Media ($\mu$)**, **Somma ($\Sigma$)**, **Moda ($Mo$)**, **Max**, **Min** e **Conteggio ($N$)**.
6. **Persistenza Unificata (`projects.json`)**:
   - Salvataggio completo di progetti, parametri SQL (senza password), coordinate GIS, Canvas singoli, MultiPlot e Mappe GIS.

---

## ⚠️ Regole Ingegneristiche Imperative per Gemini / Agenti

1. **Aggiornamento Continuo dei File di Log**:
   - L'utente richiede espressamente: **"Aggiorna sempre i file di log ad ogni singolo step"**.
   - Ad ogni avanzamento, bugfix o nuova feature, aggiorna subito:
     - [`PROJECT_STATUS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/PROJECT_STATUS.md)
     - [`ChartMate_Structure.txt`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate_Structure.txt)
     - [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) e [`GEMINI.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/GEMINI.md)
2. **Non Eseguire `cargo clean` Inutilmente**: Mantieni la cache incrementale di Rust in `tauri-app/src-tauri/target` per compilare le release in pochi secondi.
3. **Contrasto Scientifico Rigoroso**: Tutti i testi, assi, tick e legende dei grafici devono essere in nero puro (`#000000`) ad alto contrasto con i font *Outfit* e *JetBrains Mono*.

---

## 🔮 Roadmap: Prossime Implementazioni Richieste

1. **Carpet Plot / Heatmap Temporale (Giorno-Ora)**:
   - Asse $X$ = Giorno dell'Anno, Asse $Y$ = Ora del Giorno ($0-23\text{h}$), $Z$ = Variabile continua. Essenziale per profili orari/stagionali IEQ e monitoraggio carichi energetici.
2. **Load Duration Curve (Curva di Durata del Carico)**:
   - Ordinamento decrescente delle grandezze con calcolo automatico delle ore di superamento soglia.
3. **Compilatore Report PDF Multi-Grafico**:
   - Generazione di schede o report multipagina PDF che combinano più grafici salvati con didascalie e metadati.
