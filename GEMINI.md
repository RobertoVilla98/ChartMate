# GEMINI.md — Contesto di Sessione per Agente Antigravity / Gemini

Questo file è il punto di ingresso per qualsiasi nuova sessione di lavoro con **Gemini / Antigravity**.  
Leggendo questo file all'inizio di una nuova chat, l'agente saprà istantaneamente cosa fa l'applicazione, dove siamo arrivati, le regole operative vincolanti e cosa fare nei prossimi step.

---

## 📌 Identikit di ChartMate

* **Scopo**: Studio desktop per ricercatori e ingegneri per creare grafici e figure scientifiche *journal-ready* ad alta risoluzione in pochi secondi, senza dover scrivere script Matplotlib/Seaborn.
* **Tech Stack**: Python 3.10+, **Dash**, **Polars** (nessun uso di Pandas), **Plotly**, Dash Bootstrap Components.
* **Design System**: *Velth Light Mode* (`#f8fafc`, bianco puro, accento `#059669` Emerald, font *Outfit* e *JetBrains Mono*).
* **Guida Completa di Dettaglio**: Leggi [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md) per l'architettura dettagliata di ogni modulo.

---

## 🎯 Stato Attuale: Dove Siamo Arrivati

1. **Gestione Dati & Progetti ([`pages/home.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/home.py))**: Ingestione file con parsing separatori (`,`, `;`, tab), virgole decimali europee, timestamp e preview Polars ad alta velocità.
2. **Single Chart Studio ([`pages/canvas.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/canvas.py))**:
   - Fino a 3 assi $Y$ indipendenti ($Y_1, Y_2, Y_3$).
   - **10 Tipologie di Grafico**: *Line, Scatter, Bar, Area, Box Plot, Violin Plot, Grouped Bar con Error Bars ($\mu \pm \sigma$), Correlation Matrix Heatmap ($r \in [-1, 1]$), Istogramma/KDE, Radar/Spider Plot*.
   - **Smart Labelling & Annotazioni** ([`components/annotation_panel.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/annotation_panel.py)):
     - *Peak & Valley Tracker*: Max & Min globale e **Daily Extrema** (max e min automatici per ogni giorno di calendario).
     - *Soglie e Fasce di Comfort*: Linee orizzontali di limite e fasce rettangolari di target.
     - *Statistiche*: Linee per Media ($\mu$), Mediana ($M$) e Trendline OLS con formula e $R^2$.
     - *Event Shading*: Fascia verticale per intervalli temporali critici (*Heatwave*, *Fault*).
   - **Publication Presets 1-Click**: *Single Column* ($8.5\text{ cm}$), *Double Column* ($17\text{ cm}$), *Square* ($12\text{ cm}$ con ratio $1:1$ reale), *Presentation 16:9*.
   - **Esportazione ad Alta Risoluzione**: Vettoriale (SVG, PDF) e raster (PNG, JPEG) a $96, 150, 300, 600\text{ DPI}$.
3. **MultiPlot Studio ([`pages/multi_plot.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/multi_plot.py))**:
   - *Topology Presets*: Stack Verticale $3\times 1$ per serie temporali sincrone, $2\times 1$, Griglia $2\times 2$, Affiancato $1\times 2$, Custom.
   - *Academic Auto-Lettering*: Lettere **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`**...
   - *Smart Dynamic Spacing*: Eliminazione di collisioni tra testi e assi; asse temporale $X$ condiviso pulito sul fondo.
4. **Maps Studio ([`pages/maps.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/maps.py))**:
   - Provider: 🛰️ *ESRI Satellite World Imagery*, 🗺️ *OpenStreetMap*, 🏙️ *CartoDB Positron*, 🌑 *CartoDB Dark Matter*, 🏔️ *OpenTopoMap*.
   - Modalità: *Bubble Scatter Map* (colore e raggio scalati), *Density Heatmap Geo*, *GPS Trajectories / Tracks*.

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
