# utils/project_manager.py
import json
import os

PROJECTS_FILE = 'projects.json'

def load_projects():
    """Loads the projects dictionary from the JSON file."""
    if not os.path.exists(PROJECTS_FILE):
        return {}
    try:
        with open(PROJECTS_FILE, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        # If the file is empty or corrupted, return an empty dict
        return {}

def save_projects(projects_data):
    """Saves the projects dictionary to the JSON file."""
    with open(PROJECTS_FILE, 'w') as f:
        json.dump(projects_data, f, indent=4)