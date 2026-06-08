import json
import os
from typing import Dict, List, Any

PROJECTS_FILE = "utils/projects.json"

def ensure_storage():
    """Ensures the storage directory exists."""
    if not os.path.exists("utils"):
        os.makedirs("utils")
    if not os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'w') as f:
            json.dump({}, f)

def load_projects() -> Dict[str, Any]:
    """Loads all projects from the JSON file."""
    ensure_storage()
    try:
        with open(PROJECTS_FILE, 'r') as f:
            content = f.read()
            if not content:
                return {}
            data = json.loads(content)
            return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, FileNotFoundError):
        return {}

def save_projects(projects: Dict[str, Any]):
    """Saves all projects to the JSON file."""
    if projects is None:
        projects = {}
    ensure_storage()
    with open(PROJECTS_FILE, 'w') as f:
        json.dump(projects, f, indent=4)

def get_project(project_name: str) -> Dict[str, Any]:
    """Retrieves a specific project."""
    projects = load_projects()
    return projects.get(project_name, {})

def save_project(project_name: str, file_path: str, sep: str = ',', decimal: str = '.',
                 timestamp_col: str = None, timestamp_format: str = None, 
                 canvases: Dict[str, Any] = None):
    """Saves or updates a project with CSV parameters and canvases."""
    projects = load_projects()
    
    # Handle terminology change if loading old data
    existing_project = projects.get(project_name, {})
    if canvases is None:
        canvases = existing_project.get('canvases', existing_project.get('subprojects', {}))
    
    projects[project_name] = {
        'file_path': file_path,
        'sep': sep,
        'decimal': decimal,
        'timestamp_col': timestamp_col,
        'timestamp_format': timestamp_format,
        'canvases': canvases
    }
    save_projects(projects)

def save_canvas(project_name: str, canvas_name: str, graph_config: Dict[str, Any]):
    """Saves a graph configuration as a canvas."""
    projects = load_projects()
    if projects is None or project_name not in projects:
        return False
    
    if 'canvases' not in projects[project_name]:
        projects[project_name]['canvases'] = {}
        
    projects[project_name]['canvases'][canvas_name] = graph_config
    save_projects(projects)
    return True

def delete_canvas(project_name: str, canvas_name: str) -> bool:
    """Deletes a saved canvas from a project."""
    projects = load_projects()
    if project_name in projects and 'canvases' in projects[project_name]:
        if canvas_name in projects[project_name]['canvases']:
            del projects[project_name]['canvases'][canvas_name]
            save_projects(projects)
            return True
    return False

def save_multiplot(project_name: str, multiplot_name: str, config: Dict[str, Any]) -> bool:
    """Saves a multiplot configuration under a 'multiplots' key."""
    projects = load_projects()
    if projects is None or project_name not in projects:
        return False
    if 'multiplots' not in projects[project_name]:
        projects[project_name]['multiplots'] = {}
    projects[project_name]['multiplots'][multiplot_name] = config
    save_projects(projects)
    return True

def delete_multiplot(project_name: str, multiplot_name: str) -> bool:
    """Deletes a saved multiplot from a project."""
    projects = load_projects()
    if project_name in projects and 'multiplots' in projects[project_name]:
        if multiplot_name in projects[project_name]['multiplots']:
            del projects[project_name]['multiplots'][multiplot_name]
            save_projects(projects)
            return True
    return False
