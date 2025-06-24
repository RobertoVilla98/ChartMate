'''
/tuo_progetto_dash/
|
├── app.py                  # File principale, inizializza l'app e gestisce il routing
├── layouts/
│   ├── __init__.py
│   ├── data_loader.py      # Layout e callback per la prima schermata (caricamento dati)
│   └── plotter.py          # Layout e callback per la seconda schermata (grafici)
|
├── utils/
│   ├── __init__.py
│   └── project_manager.py  # Funzioni helper per leggere/scrivere il file JSON
|
├── projects.json           # File per salvare le configurazioni dei progetti
├── requirements.txt        # Dipendenze del progetto
└── .gitignore              # Per escludere file non necessari da Git
'''