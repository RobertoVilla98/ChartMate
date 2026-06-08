import PyInstaller.__main__
import os
import sys

# Percorsi delle cartelle da includere
base_path = os.path.dirname(os.path.abspath(__file__))
pages_path = os.path.join(base_path, 'pages')
assets_path = os.path.join(base_path, 'assets')

# Definizione dei dati da aggiungere (--add-data)
# Su Windows il separatore è ';'
add_data = []
if os.path.exists(pages_path):
    add_data.append(f"{pages_path};pages")
if os.path.exists(assets_path):
    add_data.append(f"{assets_path};assets")

# Argomenti per PyInstaller
args = [
    'app.py',
    '--name=ChartMate',
    '--onefile',
    '--windowed',  # Non mostra la console
    '--clean',
]

for data in add_data:
    args.extend(['--add-data', data])

print(f"Avvio build con argomenti: {args}")
PyInstaller.__main__.run(args)
