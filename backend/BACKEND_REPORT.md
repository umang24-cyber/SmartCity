# SmartCity Backend Detailed Report

This report provides a comprehensive overview of the `backend` component of the SmartCity project.

## 🏗️ Architecture Overview

The backend is a standard **Node.js Express** application designed with a clear separation of concerns. It features a dual-mode data layer that can switch between local mock data and a remote **TigerGraph** database.

### Core Technologies
- **Framework:** Express.js
- **Environment Management:** dotenv
- **Middleware:** CORS (configured for `http://localhost:5173`), express.json()
- **Utilities:** Axios (for TigerGraph communication)

---

## 📁 Directory Structure

| Directory | Purpose |
| :--- | :--- |
| `controllers/` | Logic for processing requests and interacting with data layers. |
| `routes/` | API endpoint definitions and routing. |
| `utils/` | Shared utilities including the Safety Engine and TigerGraph adapter. |
| `data/` | Static mock data and helper functions for development without a database. |

---

## 🚀 API Endpoints

### 1. Safe Route (`/safe-route`)
- **Method:** `GET`
- **Purpose:** Returns a recommended "safe path" between two intersections.
- **Logic:** In TigerGraph mode, it calls a GSQL query `getSafeRoute`. In mock mode, it returns a static path with dynamically generated reasons based on the current time (e.g., night-specific safety factors).

### 2. Danger Score (`/danger-score`)
- **Method:** `GET`
- **Purpose:** Computes a real-time safety/danger score for a specific intersection.
- **Factors considered:**
    - Peak danger hours (location-specific)
    - Weekend risk multipliers
    - Weather conditions (rain, fog, storm)
    - Isolation scores (escape route availability)
    - Safety feature status (functional/broken streetlights and CCTV)

### 3. Incidents (`/incidents`)
- **Method:** `GET`
- **Purpose:** Fetches all reported incidents, with an optional filter for verified reports (`?verified=true`).

### 4. Report Incident (`/report`)
- **Method:** `POST`
- **Purpose:** Allows users to report new safety incidents.
- **Validation:** Validates incident types (e.g., `poor_lighting`, `felt_followed`) and severity (1–5).
- **Storage:** In-memory store used during mock mode; vertex creation in TigerGraph mode.

### 5. Cluster Info (`/cluster-info`)
- **Method:** `GET`
- **Purpose:** Provides aggregate safety data and recommended interventions for specific geographic clusters.

---

## 🧠 Key Logic Components

### Safety Engine (`utils/safetyEngine.js`)
The "brain" of the application. It takes raw intersection data, current environmental factors (TimeSlice), and safety features to calculate a score from 0–100. It includes a sophisticated weighting system that rewards functional infrastructure and penalizes environmental risks.

### TigerGraph Adapter (`utils/tigergraph.js`)
A clean abstraction layer for graph database operations. It handles:
- Vertex/Edge retrieval
- GSQL query execution
- Normalization of graph-formatted responses into flat JSON for the frontend.

### Mock Data System (`data/mockData.js`)
Contains rich, schema-accurate mock vertices for:
- Intersections
- SafetyFeatures
- TimeSlices
- SafetyClusters
- IncidentReports

---

## 🔧 Configuration (.env)

The following environment variables control the backend behavior:
- `PORT`: Server port (default: 5000)
- `DATA_SOURCE`: Set to `tigergraph` to enable DB connection; otherwise defaults to mock mode.
- `TG_BASE_URL`: TigerGraph server URL.
- `TG_GRAPH`: Graph name (default: `SafeRouteGraph`).
- `TG_TOKEN`: Bearer token for TigerGraph auth.

---

## ⚠️ Current Status & Observations
- **Data Source:** Currently defaulting to **Mock Mode** because `DATA_SOURCE` is not set or the DB is unreachable.
- **Health:** Simple `/health` endpoint is available to check connectivity and current mode.
- **Error Handling:** Global error handler implemented in `index.js` to prevent server crashes on unhandled exceptions.
