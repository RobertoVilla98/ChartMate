# ChartMate 📊 - Stato del Progetto, Avanzamenti e Roadmap

Documento ufficiale di tracciamento dello stato di sviluppo di **ChartMate**, contenente gli avanzamenti completati, le scelte architetturali, i problemi risolti e il backlog delle future implementazioni.

---

## 📅 Ultimo Aggiornamento: Agosto 2026

---

## ✅ 1. Avanzamenti Completati (Accomplishments)

### 🎨 A. Design System "Velth Light Mode" & Branding
- **Design System Velth Light**: Interfaccia moderna e pulita con sfondo Zinc-50 (`#f8fafc`), card in bianco puro (`#ffffff`), tipografia raffinata con Google Fonts **Outfit** (sans-serif ad alta leggibilità) e **JetBrains Mono** (numeri e codice).
- **Accenti Cromatici Funzionali**: Emerald (`#059669`), Sky (`#0284c7`), Amber (`#d97706`) e Slate (`#64748b`).
- **Logo Vettoriale SVG**: Creato [`assets/logo.svg`](file:///c:/Users/rober/Documents/GitHub/ChartMate/assets/logo.svg) con assi cartesiani $X-Y$ a forma di "L" e omino stilizzato che saluta (*Mate*).
- **Branding Pulito**: Rimosso il badge "PRO" e il puntino pulsante per un'estetica minimale e professionale da studio.

### 🏗️ B. Architettura a Componenti Modulari
- Refactoring completo del codice per massima manutenibilità e riusabilità:
  - [`components/export_toolbar.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/export_toolbar.py): Toolbar universale di esportazione (DPI, $\text{cm}$, formati SVG/PDF/PNG/JPEG, publication presets, aspect ratio badge).
  - [`components/annotation_panel.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/annotation_panel.py): Pannello a fisarmonica per Smart Labelling, Peak Tracker, soglie e statistiche.
  - [`components/trace_styler.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/trace_styler.py): Personalizzazione per-traccia (colori, stili linea, spessore, opacità, ordinamento z-order).
  - [`components/axis_panel.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/axis_panel.py): Gestione multi-asse ($X, Y_1, Y_2, Y_3$), griglie, scale, timeframe.
  - [`components/grid_navigator.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/grid_navigator.py): Navigatore visivo matriciale, mappatura celle e Topology Presets.
  - [`components/logo.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/components/logo.py): Componente header con logo vettoriale.
  - [`utils/chart_engine.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/utils/chart_engine.py): Motore di rendering scientifico Plotly completamente disaccoppiato.
- **Documentazione & AI Context Onboarding**:
  - [`AGENTS.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/AGENTS.md): Guida completa per sviluppatori e agenti IA (architettura, convenzioni, moduli, regole imperative).
  - [`GEMINI.md`](file:///c:/Users/rober/Documents/GitHub/ChartMate/GEMINI.md): Entrypoint dedicato per sessioni con Gemini / Google Antigravity per riprendere il lavoro all'istante.

### 📐 C. Publication Presets & Sizing Engine WYSIWYG
- **Preset di Pubblicazione 1-Click**:
  - *Single Column* ($8.5 \times 6.5\text{ cm}$, Ratio 1.31)
  - *Double Column* ($17.0 \times 9.5\text{ cm}$, Ratio 1.79)
  - *Square* ($12.0 \times 12.0\text{ cm}$, Ratio 1.00)
  - *Presentation 16:9* ($24.0 \times 13.5\text{ cm}$, Ratio 1.78)
  - *Custom* (libera personalizzazione)
- **Calcolo Geometrico Reattivo**: Iniezione diretta di `width` e `height` nel layout JSON di Plotly e reattività istantanea ai cambi di $\text{cm}$ o preset.
- **Moltiplicatori per Monitor Grandi**: Dimensioni di anteprima ampliate fino a $1200 \times 750\text{ px}$ con visualizzazione quadrata perfetta ($680 \times 680\text{ px}$).

### 📊 D. Riprogettazione MultiPlot a Standard Scientifico "Journal-Ready"
- **Topology Presets**: *Vertical Stack 3×1* (ideale per serie temporali sincronizzate), *Vertical Stack 2×1*, *Matrix Grid 2×2*, *Side-by-Side 1×2*, *Custom Matrix*.
- **Academic Auto-Lettering**: Generazione automatica dei badge **`(a)`**, **`(b)`**, **`(c)`**, **`(d)`**... nei titoli dei subplot.
- **Smart Dynamic Spacing**: Calcolo dinamico di `vertical_spacing` e `horizontal_spacing` per eliminare qualsiasi sovrapposizione tra testi e assi.
- **Asse Temporale Sincronizzato Pulito**: Negli stack verticali con asse $X$ condiviso, le date intermedie vengono rimosse mostrando solo le date formattate sul pannello inferiore.
- **Etichette Asse Y per Cella**: Definizione personalizzata dell'unità di misura/label per ciascun subplot.
- **Legenda Unificata Orizzontale**: Posizionata in alto al centro con font compatto ($10\text{ pt}$).

### 🏷️ E. Smart Labelling & Scientific Annotations Engine (Fase 1)
- **Peak & Valley Tracker**:
  - *Global Max & Min*: Callout pin con freccia e badge colorati (`🔴 Max: 29.80`, `🔵 Min: 17.20`).
  - *Daily Extrema*: Rilevamento automatico del picco diurno e della minima notturna per ogni singolo giorno di calendario.
  - *Top 3 Extrema*: Evidenziazione dei 3 valori massimi e 3 minimi.
  - *Formati Badge*: Value & Timestamp, Value Only, Marker Only (Clean Pin).
- **Threshold Lines & Target Bands**:
  - Linee orizzontali tratteggiate di soglia con testo descrittivo (es. `Soglia Limite 1000 ppm`, `0 °C`).
  - Fasce orizzontali ombreggiate semi-trasparenti (*Comfort / Target Zones* $[20, 26]^\circ\text{C}$).
- **Statistiche & Trendline OLS**:
  - Linee di riferimento per Media ($\mu$) e Mediana ($M$).
  - Regressione Lineare (OLS) con equazione e coefficiente $R^2$.
- **Event Shading**: Ombreggiatura di intervalli temporali verticali per evidenziare eventi speciali (*Heatwave*, *Fault Period*).

### 📈 F. Suite Completa di 6 Grafici Scientifici Universali (Fase 2)
1. **📦 Box Plot**: Mediana, quartili, baffi $\text{IQR}$, jitter points e marcatore della media.
2. **🎻 Violin Plot**: Stima continua di densità KDE combinata con boxplot interno.
3. **📊 Grouped Bar con Error Bars ($\mu \pm \sigma$)**: Calcolo automatico di media e deviazione standard con barre d'errore tipografiche.
4. **🔥 Correlation Matrix Heatmap**: Matrice di correlazione di Pearson ($r \in [-1, 1]$) con scala divergente *RdBu* e valori $r$ numerici in ogni cella.
5. **📈 Istogramma & Frequenza (KDE)**: Distribuzione di probabilità con binning automatico.
6. **🕸️ Radar / Spider Plot**: Profilo polare radiale multi-dimensionale.

### 🛰️ G. Nuova Scheda: Maps Studio (GIS & Satellite Spatial Data)
- **Nuova Pagina [`pages/maps.py`](file:///c:/Users/rober/Documents/GitHub/ChartMate/pages/maps.py)** integrata nella navbar globale.
- **Provider di Sfondo Multipli**:
  - 🛰️ *ESRI World Imagery Satellite* (satellite globale ad altissima risoluzione).
  - 🗺️ *OpenStreetMap* (stradale e toponomastica standard).
  - 🏙️ *CartoDB Positron* (sfondo chiaro ad alto contrasto per paper).
  - 🌑 *CartoDB Dark Matter* (sfondo scuro).
  - 🏔️ *OpenTopoMap* (topografico con curve di livello).
- **Modalità di Visualizzazione**:
  - 📍 *Bubble Scatter Map* (punti georeferenziati con dimensione e colore scalari).
  - 🔥 *Spatial Density Heatmap* (mappa di calore continua).
  - 〰️ *GPS Trajectory / Route* (linee e waypoint sequenziali).
- **Centratura e Zoom Automatico**: Bounding box calcolato dai punti del dataset.
- **Esportazione Vettoriale e Raster**: Con DPI e preset di pubblicazione.

---

## 🛠️ 2. Problemi e Dubbi Tecnici Risolti (Solved Challenges)

1. **Callback Duplicate Outputs**: Risolto tramite l'introduzione di `allow_duplicate=True` e `prevent_initial_call=True` sui callback di preset e font.
2. **Logica dei DPI vs Dimensioni Fisiche**: Chiarito e implementato che il DPI governa la risoluzione del file raster esportato (PNG/JPEG da $96$ a $600\text{ DPI}$ per standard tipografici), mentre l'Aspect Ratio dipende unicamente dalle dimensioni geometriche $\frac{W_{\text{cm}}}{H_{\text{cm}}}$.
3. **Mancato Ridimensionamento Proporzionale Plotly**: Risolto iniettando esplicitamente `fig.layout.width` e `fig.layout.height` calcolati dinamicamente dal rapporto in centimetri e collegando `dl-width` e `dl-height` come `Input` reattivi di `render_graph_cb`.
4. **SVG Asset Rendering in Dash**: Risolto sostituendo i tag SVG inline con il caricamento statico di `assets/logo.svg` tramite `html.Img`.

---

## 🗺️ 3. Backlog & Future Implementazioni Possibili

### 📌 Priorità Media (Estensioni Scientifiche Avanzate)
- [ ] **Carpet Plot / Temporal Heatmap (Giorno-Ora)**:
  - Matrice 2D Giorno dell'Anno (Asse $X$) vs Ora del Giorno (Asse $Y$) per diagnostica oraria e stagionale IEQ / HVAC.
- [ ] **Load Duration Curve (Curva di Durata del Carico)**:
  - Ordinamento decrescente delle grandezze continue con quantificazione automatica delle ore di superamento soglia.
- [ ] **Esportazione Multi-Grafico in Report PDF**:
  - Compilatore per esportare compendi di figure in formato PDF multipagina con didascalie e intestazioni formattate.

### 📌 Priorità Bassa / Ottimizzazioni
- [ ] **Connettori Database Esterni**: Supporto per importazione diretta da database SQLite o serie temporali InfluxDB.
- [ ] **Preset per Riviste Specifiche**: Aggiunta di template pre-configurati per journal specifici (*Nature*, *Science*, *Elsevier Building and Environment*, *IEEE Transactions*).
