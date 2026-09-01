# backend_python/db/persistence.py
import asyncio
import json
import os

STORAGE_FILE = "persistent_storage.json"

_write_lock = asyncio.Lock()


def load_all_data():
    """Read all data from the JSON store. Safe to call concurrently.

    Returns an empty dict if the file is missing or unreadable.
    Note: callers should pair every write with a read inside the same
    critical section (``save_data``) to avoid lost updates.
    """
    if not os.path.exists(STORAGE_FILE):
        return {}
    try:
        with open(STORAGE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading persistent storage: {e}")
        return {}


async def load_all_data_async():
    """Async variant of ``load_all_data`` that acquires the write lock first.

    Use this when the read must be paired with a subsequent write to avoid
    losing updates from a concurrent request.
    """
    async with _write_lock:
        return load_all_data()


async def save_data(key, data):
    """Atomically persist ``data`` under ``key``.

    The whole read-modify-write happens inside ``_write_lock`` so concurrent
    FastAPI request handlers cannot overwrite each other's updates. The JSON
    file is written to a sibling ``.tmp`` path and renamed so a crash in the
    middle of a write cannot leave the file truncated.
    """
    async with _write_lock:
        try:
            all_data = load_all_data()
            all_data[key] = data
            tmp_path = f"{STORAGE_FILE}.tmp"
            with open(tmp_path, "w") as f:
                json.dump(all_data, f, indent=4)
            os.replace(tmp_path, STORAGE_FILE)
        except Exception as e:
            print(f"Error saving to persistent storage: {e}")
