"""
backend_python/db/mock_db.py
==============================
Backward-compatibility shim.
All logic has moved to custom_db/mock_db.py.
Import from there directly in new code.
"""
from custom_db.mock_db import (  # noqa: F401
    MOCK_ZONES,
    MOCK_INCIDENTS,
    MOCK_CAMERAS,
    MOCK_SAFETY_FEATURES,
    MOCK_INTERSECTIONS,
    IN_MEMORY_REPORTS,
    get_mock_zone,
    get_all_mock_zones,
    get_heatmap_data,
    get_mock_incidents,
    add_mock_incident,
    update_incident_verification,
    _rng,
)
