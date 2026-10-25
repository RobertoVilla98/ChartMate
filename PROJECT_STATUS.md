# ChartMate 📊 - Stato del Progetto, Avanzamenti e Roadmap

Documento ufficiale di tracciamento dello stato di sviluppo di **ChartMate**, contenente gli avanzamenti completati, le scelte architetturali, i problemi risolti e il backlog delle future implementazioni.

---

## 📅 Ultimo Aggiornamento: Ottobre 2026 (Parquet, MySQL, MultiPlot Grid & Maps Geo-Analytics Studio)

---

## 🚀 NUOVA ARCHITETTURA: Desktop Nativo con Rust + Tauri v2

Per risolvere definitivamente i colli di bottiglia legati alla distribuzione su Windows, ai conflitti di porte web locali e alla necessità di puntare direttamente a file locali e cartelle condivise su **SharePoint**, ChartMate è stato evoluto in un'applicazione **desktop nativa ultra-leggera**:

- **Backend Nativo in Rust (Tauri v2)**:
  - Compilato con il toolchain `stable-x86_64-pc-windows-gnu` e MinGW GCC.
  - Genera un singolo eseguibile Windows portabile: [`ChartMate.exe`](file:///c:/Users/rober/Documents/GitHub/ChartMate/ChartMate.exe).
  - Consumo di memoria RAM ridotto a meno di 60 MB grazie all'uso di WebView2 nativa di Windows.
  - Avvio istantaneo in meno di 1 secondo, senza dover avviare server locali o aprire il browser esterno.
- **Accesso Diretto a SharePoint, Parquet, MySQL e Filesystem Locale**:
  - Drag-and-drop nativo di file **Apache Parquet (`.parquet`, `.pq`)**, CSV, Excel (`.xlsx`, `.xls`) e TSV direttamente dall'Esplora Risorse di Windows.
  - Connettore nativo **MySQL** (`test_sql_connection`, `execute_sql_query`) per interrogare database relazionali remoti o locali.
  - Dialog nativo Windows per selezionare i file direttamente dal percorso di rete/SharePoint senza duplicarli.
  - Parser ad alte prestazioni implementato con `parquet`, `mysql`, `csv` e `calamine` in Rust per autodiagnosticare delimitatori (`,`, `;`, `\t`), gestire virgole decimali europee ed estrarre le colonne all'istante.
- **Frontend Scientifico Reattivo (TypeScript + Plotly.js + Vite)**:
  - Motore di plotting scientifico client-side a 60 FPS con supporto multi-asse ($Y_1, Y_2, Y_3, Y_4$), selezione rapida del tipo di grafico (linee continue, scatter, barre, aree).
  - Toolbar di pubblicazione accademica con proporzioni fisse WYSIWYG: *Single Column* ($8.5\text{ cm}$), *Double Column* ($17\text{ cm}$), *Square* ($12\times 12\text{ cm}$).
  - Esportazione vettoriale SVG e raster PNG ad alta risoluzione con un clic.
  - Smart annotations: Comfort / Target Band integrata per soglie IEQ e Peak/Valley Tracker.
  - Design pulito e professionale proprietario con i font **Outfit** e **JetBrains Mono**.
- **Step 1 Completato: Ingestione Dati Avanzata & Finestra Temporale**:
  - Scheda `1. Data Source & Parser` dedicata all'ingestione, delimitatori, coordinate geospaziali e preview dati raw.
  - Filtro dinamico del Timeframe collocato direttamente nella barra laterale del Canvas (Full, 1 Day, 1 Week, 1 Month, Custom).
- **Step 2 Completato: Trace Styler Per-Serie, Fino a 4 Assi Y, Annotazioni & Tipografia**:
  - **Trace Styler Indipendente con Selezione a Tendina Y**:
    - **Menu a Tendina Dedicato per Nuova Serie**: dropdown con elenco completo delle colonne del dataset prima del pulsante `+ Aggiungi Serie`.
    - **Selettore a Tendina Per-Card**: all'interno di ogni card traccia creata, l'intestazione contiene un selettore a tendina per cambiare istantaneamente la variabile plottata.
    - **Configurazione Avanzata per Traccia**: tipo di grafico (Linea, Barre, Area, Scatter), stile tratteggio (solid, dash, dot), asse di riferimento ($Y_1 - Y_4$) e colore dedicato con color picker.
  - **Supporto Multi-Asse Fino a 4 Assi Y ($Y_1, Y_2, Y_3, Y_4$)**: assi destri scalati con offset geometrico dinamico, titoli e unità di misura personalizzabili.
  - **Peak & Valley Tracker Configurabile**: modalità *Disattivato*, *Max & Min Globale* o *Estremi Giornalieri* (picco diurno e minimo notturno con badge e callout precisi).
  - **Comfort / Target Band Stagionale**: preset 1-click tra Inverno ($20 - 22^\circ\text{C}$), Estate ($24 - 26^\circ\text{C}$) o Custom liberamente editabile.
- **Step 3 Completato: Persistenza di Progetti e Memoria Stato Singoli Grafici (Canvas)**:
  - **Architettura di Salvataggio Standalone (`projects.json`)**:
    - Implementati i comandi Tauri/Rust `load_projects_store` e `save_projects_store` in [`tauri-app/src-tauri/src/lib.rs`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/src/lib.rs).
  - **Gestione Progetti (Tab 1 Sidebar)** e **Memoria di Stato del Singolo Grafico / Canvas (Tab 2 Sidebar)** con salvataggio e ripristino completo di tutti i 17 parametri grafici.
- **Step 4 Completato: Motore Dati Parquet & MySQL, MultiPlot Grid Studio (Tab 3) e Maps & Geo-Analytics Studio (Tab 4)**:
  - **Track A — Ingestione Dati High-Performance (Apache Parquet & MySQL)**:
    - **Supporto Nativo Apache Parquet (`.parquet`, `.pq`)**: Integrato il crate Rust `parquet` (`v53`, con codec `snap`, `flate2`, `lz4`, `brotli`) in [`tauri-app/src-tauri/src/lib.rs`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/src/lib.rs) tramite `SerializedFileReader`. Supporta decodifica automatica di timestamp logici (`TIMESTAMP_MILLIS`, `TIMESTAMP_MICROS`, `DATE`) in formato ISO `YYYY-MM-DD HH:MM:SS` e tipi numerici/decimali senza dipendenze C++.
    - **Connettore Database Relazionale MySQL**: Integrato il crate `mysql` (`v25` con `rustls-tls` puro Rust) ed esposti i comandi Tauri `test_sql_connection` ed `execute_sql_query`. Nella Tab 1 l'utente può commutare tra *File Locale* e *Database SQL (MySQL)*, testare la latenza di connessione, ispezionare l'elenco delle tabelle e lanciare query SQL personalizzate (`SELECT`, aggregazioni).
    - **Configuratore Coordinate Geospaziali (Tab 1)**: Auto-rilevamento intelligente delle colonne di latitudine e longitudine e selettore del formato coordinate (*Gradi Decimali DD* vs *Gradi Minuti Secondi DMS* con conversione automatica).
  - **Track B — MultiPlot Grid Studio (Tab 3 Sbloccata)**:
    - **Topologie Griglia Scientifica 1-Click**: *Stack Verticale 3×1* `(a)-(c)`, *Stack Verticale 2×1* `(a)-(b)`, *Matrice 2×2* `(a)-(d)` e *Side-by-Side 1×2*.
    - **Asse X Condiviso & Auto-Lettering Accademico**: Sincronizzazione automatica dell'asse temporale X (`matches: 'x'`) con occultamento dei tick intermedi negli stack verticali e badge automatici **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`**.
    - **Configurazione Per-Pannello & Import da Canvas**: Ogni pannello supporta serie primaria $Y_1$ (Linea, Barre, Area, Punti), serie secondaria opzionale $Y_2$ (doppio asse destro nel singolo pannello), titolo Y indipendente e importazione rapida da qualsiasi Canvas salvato nel progetto.
  - **Track C — Maps & Geo-Analytics Studio (Nuova Tab 4)**:
    - **3 Modalità Cartografiche**: *Bubble Scatter Map* (`scattermapbox`), *Spatial Density Heatmap* (`densitymapbox`) e *GPS Trajectory / Track* (`lines+markers`).
    - **5 Base Map Providers**: *CartoDB Positron (Light Paper)*, *ESRI World Imagery Satellite* (tiles satellitari ad alta risoluzione), *OpenStreetMap*, *CartoDB Dark Matter* e *OpenTopoMap*.
    - **Motore di Clusterizzazione Spaziale & Operazioni Matematiche**: Griglia spaziale configurabile ($0.0005^\circ \approx 50\text{m}$ fino a $0.10^\circ \approx 10\text{km}$) con calcolo real-time sul cluster di:
      - **Media ($\mu$)**, **Somma Cumulata ($\Sigma$)**, **Moda ($Mo$ - valore dominante)**, **Massimo ($\text{Max}$)**, **Minimo ($\text{Min}$)** e **Conteggio Campionamenti ($N$)**.
    - **Auto-Fit Bounding Box**: Calcolo automatico del centroide geografico e del livello di zoom ottimale in base all'estensione spaziale del dataset.
  - **Track D — Persistenza Unificata (`projects.json`)**:
    - Esteso lo schema di salvataggio per memorizzare all'interno di ciascun progetto anche i parametri SQL (esclusa password per sicurezza), il setup geospaziale, i layout **MultiPlot** e le configurazioni **Mappe GIS**.
- **Backup Completo Preservato**:
  - Il precedente codebase Python/Dash è stato interamente preservato e versionato sul branch Git `legacy-python-dash`.

---

## 🛠️ Problemi Tecnici Risolti nella Migrazione Rust

1. **Assenza di C++ Build Tools**: Configurato l'ambiente MinGW GCC 16 tramite MSYS2 e collegato il toolchain Rust `stable-x86_64-pc-windows-gnu`.
2. **MinGW DLL Export Ordinal Overflow**: Risolto rimuovendo il crate-type `cdylib` (dedicato ad Android/iOS) in [`tauri-app/src-tauri/Cargo.toml`](file:///c:/Users/rober/Documents/GitHub/ChartMate/tauri-app/src-tauri/Cargo.toml), consentendo il link statico pulito del solo eseguibile desktop Windows (`.exe`).
3. **Integrazione File Dialog**: Aggiunti i plugin `tauri-plugin-dialog` e `tauri-plugin-fs` con permessi granulari in `capabilities/default.json` per garantire la lettura istantanea dei percorsi file locali.
4. **Parquet & MySQL Pure-Rust Compilation**: Configurato `parquet v53` con `flate2` (rust_backend) e `mysql v25` con `rustls-tls` per compilare nativamente su MinGW senza dipendenze da OpenSSL o librerie C++ esterne.

---

## 🗺️ Backlog e Prossime Integrazioni
- [x] Porting della tab MultiPlot a matrice $R \times C$ con auto-lettering `(a)-(d)` nel nuovo frontend Tauri.
- [x] Porting della tab Mappe GIS satellitari con Clusterizzazione Spaziale e Operazioni Matematiche ($\mu, \Sigma, Mo, \text{Max}, \text{Min}, N$).
- [x] Supporto nativo a file Apache Parquet (`.parquet`, `.pq`) e database MySQL in Rust.
- [ ] Carpet Plot / Heatmap Temporale Giorno-Ora ($X = \text{Giorno}$, $Y = \text{Ora } 0-23\text{h}$).
- [ ] Load Duration Curve (Curva di Durata del Carico con calcolo ore di superamento soglia).
- [ ] Esportatore Report PDF Multi-Pagina.
