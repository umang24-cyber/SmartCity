"""
backend_python/main_with_portal.py
====================================
NEW standalone backend entry — ADDITIVE ONLY.
Imports the EXISTING app from main.py (unchanged), then ADDS the portal
routes on top. Run this file instead of main.py to get ALL existing
endpoints PLUS the new portal endpoints.

  uvicorn main_with_portal:app --host 0.0.0.0 --port 8000 --reload

Existing endpoints remain 100% intact.
New endpoints added:
  POST /api/v1/route/safe
  POST /api/v1/user/sos
  GET  /api/v1/admin/incidents
  GET  /api/v1/admin/zones
  GET  /api/v1/admin/stats
"""

# 1. Import the existing app (nothing inside main.py is modified)
from main import app  # noqa: F401  ← same app object, same lifespan, same routes

# 2. Add ONLY the new portal router — additive, no conflicts
from routers.portal_routes import router as portal_router

app.include_router(portal_router, prefix="/api/v1")

# ── Done. All existing routes + new portal routes are now active. ──────────────
# Run with:
#   cd backend_python
#   uvicorn main_with_portal:app --reload --port 8000
