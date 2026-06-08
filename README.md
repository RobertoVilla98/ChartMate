# ChartMate 📊

**ChartMate** is a lightweight desktop utility built with Python, Dash, and Plotly, designed for loading, managing, and visualizing datasets. It features a standalone window interface thanks to `pywebview` and supports project-based data management.

## 🚀 Key Features

- **Standalone Desktop App**: Runs in its own window without needing a browser.
- **Project Management**: Save file paths and CSV configurations as projects.
- **Canvas System**: Create and save multiple visualization "canvases" per project.
- **Dynamic Plotting**: High-level customization for graphs (axes, legends, grids, etc.).
- **Data Persistence**: Automatic saving of project and canvas configurations in JSON.

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/villain-98/ChartMate.git
   cd ChartMate
   ```

2. **Set up a virtual environment**:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**:
   ```powershell
   pip install -r Requirenents.txt
   ```

## 📖 Usage

### Running the Application
To start the app in standalone mode:
```powershell
python app.py
```

### Building the Executable
You can package ChartMate as a single-file executable using the provided build script:
```powershell
python build_exe.py
```
The executable will be generated in the `dist/` folder.

## 📂 Project Structure

- `app.py`: Main entry point (Dash server + pywebview window).
- `pages/`: Contains the UI layouts for different views (Home, Canvas).
- `utils/`: Core logic and helper modules:
  - `storage.py`: Handles project and canvas persistence (JSON).
  - `data_handler.py`: CSV loading and preprocessing.
- `assets/`: Custom CSS and static files.
- `build_exe.py`: Script for generating the standalone executable.
- `Requirenents.txt`: List of Python dependencies.

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

Distributed under the GNU License. See `LICENSE` for more information.

---
*Created with ❤️ for lightweight data visualization.*
