# backend_python/db/persistence.py
import json
import os

STORAGE_FILE = "persistent_storage.json"

def load_all_data():
    if not os.path.exists(STORAGE_FILE):
        return {}
    try:
        with open(STORAGE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading persistent storage: {e}")
        return {}

def save_data(key, data):
    all_data = load_all_data()
    all_data[key] = data
    try:
        with open(STORAGE_FILE, "w") as f:
            json.dump(all_data, f, indent=4)
    except Exception as e:
        print(f"Error saving to persistent storage: {e}")
