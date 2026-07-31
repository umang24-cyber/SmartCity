# TigerGraph Setup Guide

## Overview

This project uses **TigerGraph** to store Chandigarh's road network. The graph contains road intersections (vertices) and road segments (edges). Before running the application, you must configure a TigerGraph instance and load the sample graph data.

---

## Prerequisites

Before you begin, make sure you have:

- TigerGraph installed locally/ cloud or a running TigerGraph instance (TigerGraph database that is installed and currently running)
- Python 3.10 or later till 3.13
- The SmartCity project cloned to your machine(computer/laptop) locally.
- Git installed

Install the required Python dependencies:

```bash
pip install requests httpx pyTigerGraph

**Note:**  A running TigerGraph instance is required because the loader imports graph data into the database, and the backend connects to the same database during application startup

---

## Choose Your Setup

This project supports two ways to connect to TigerGraph:

- **Local (recommended for quick testing):** Run TigerGraph via Docker on your own machine. This is what `tigergraph_loader.py`'s default configuration (`localhost:9000`) assumes.

-- **Cloud (matches production):**  Use a TigerGraph Cloud instance with JWT Bearer token authentication — this is what the backend's DNS-bypass logic is built around.

### Option A: Local Setup
```bash
docker run -d 
-p 9000:9000
-p 14240:14240 
--name tigergraph 
tigergraph/community:latest
```
GraphStudio: `http://localhost:14240` · REST++ API: `http://localhost:9000`

### Option B: TigerGraph Cloud Setup
1. Sign up for a free instance at [tgcloud.io](https://tgcloud.io)
2. Generate a token from **Admin Portal → Users → Secrets**
3. Note your instance's hostname (used in the environment variables below)

**Note:** If you're on a restricted network (e.g. college Wi-Fi) that blocks TigerGraph Cloud's DNS resolution, the backend includes a DNS-bypass workaround (see `backend_python/custom_db/tigergraph_client.py`). If you hit connection timeouts on a restricted network, this is likely why.
---

## Required Environment Variables

The backend requires these environment variables, which are **not currently listed in `.env.example`**:

TG_HOST=https://your-instance.i.tgcloud.io # or http://localhost for local setup
TG_GRAPHNAME=UrbanSafetyGraph
TG_TOKEN=your_token_here
USE_MOCK_DB=False
```

| Variable | Description |
|----------|-------------|
| `TG_HOST` | TigerGraph server URL |
| `TG_GRAPHNAME` | TigerGraph graph name |
| `TG_TOKEN` | JWT Bearer authentication token |
| `USE_MOCK_DB` | Enables mock database mode when configured |

---

## Graph Components

The backend references the following TigerGraph graph components.

### Vertex Types

The backend uses the following vertex types:

- Intersection
- Zone
- TimeSlice
- SafetyCluster
- Incident
- IncidentReport

These vertex types are referenced by the backend when retrieving or creating graph data.

### Installed Query

The backend executes the following installed TigerGraph query:

- `getSafeRoute`

This query is used to retrieve safe routes from the graph.

> **Note**
>
> The repository currently does **not** include the GSQL schema (`CREATE GRAPH`, `CREATE VERTEX`, `CREATE EDGE`) or the corresponding `.gsql` files required to recreate the graph schema or install the required queries from scratch. Contributors can connect to an existing TigerGraph instance and import the provided graph data, but creating a new TigerGraph graph is not currently documented.

---

## Graph Data Files

The repository provides the following graph data files:

- `chandigarh_vertices.json`
- `chandigarh_edges.json`

These files contain the sample graph data that can be imported into an existing TigerGraph graph.

---

## Loading the Data

Two loader scripts exist in `data/` — use **`tigergraph_loader.py`**, the generic reusable template. Do not use `load_to_tg.py`; it's a personal script hardcoded to a specific instance (see Known Issues).

### Before Running the Loader

Verify that:
- `chandigarh_vertices.json` exists in the `data/` directory
- `chandigarh_edges.json` exists in the `data/` directory
- Your TigerGraph instance is running
- Your environment variables (`TG_HOST`, `TG_GRAPHNAME`, `TG_TOKEN`) are set

Then run:
```bash
cd data
python tigergraph_loader.py
```

---
### Data Import Process

The loader performs the following steps:

1. Connects to the configured TigerGraph instance.
2. Reads `chandigarh_vertices.json`.
3. Uploads vertices in batches.
4. Reads `chandigarh_edges.json`.
5. Uploads edges in batches.
6. Reports the number of accepted vertices and edges.

---

## Verifying Your Setup

Set `USE_MOCK_DB = True` in `config.py` to develop without TigerGraph. To verify a real connection:
```bash
GET http://localhost:8000/health
```
Look for `"db_connected": true` in the response.

---
## Troubleshooting

### Unable to Connect

Verify that:

- `TG_HOST` is correct.
- `TG_GRAPHNAME` matches your graph.
- `TG_TOKEN` is valid.

If using `tigergraph_loader.py`, also verify its local configuration (`HOST`, `REST_PORT`, `GRAPH_NAME`, and `SECRET`, if applicable).

### Graph Data Does Not Load

Verify that:

- `chandigarh_vertices.json` exists.
- `chandigarh_edges.json` exists.
- Your TigerGraph instance is running.
- The target graph (`UrbanSafetyGraph`) already exists.

---





