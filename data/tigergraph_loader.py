#!/usr/bin/env python3
"""
TigerGraph Loader for Chandigarh UrbanSafetyGraph
Uses pyTigerGraph (pip install pyTigerGraph) OR direct REST++ requests.

Usage:
    python tigergraph_loader.py

Adjust HOST / GRAPH_NAME / USERNAME / PASSWORD / SECRET as needed.
"""
import json, requests

HOST       = "http://localhost"         # your TigerGraph host
REST_PORT  = 9000
GRAPH_NAME = "UrbanSafetyGraph"
USERNAME   = "tigergraph"
PASSWORD   = "tigergraph"
SECRET     = ""                         # fill in if using token auth

BASE_URL = f"{HOST}:{REST_PORT}"

def get_token():
    if SECRET:
        r = requests.get(f"{BASE_URL}/requesttoken",
                         params={"secret": SECRET, "lifetime": 86400})
        return r.json().get("token", "")
    return ""

TOKEN = get_token()
HEADERS = {"Content-Type": "application/json"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

def upsert_vertices(vtype, vdict):
    payload = {"vertices": {vtype: vdict}}
    r = requests.post(f"{BASE_URL}/graph/{GRAPH_NAME}", headers=HEADERS,
                      data=json.dumps(payload))
    return r.json()

def upsert_edges(edge_list):
    """Batch upsert edges in groups of 500."""
    results = []
    for i in range(0, len(edge_list), 500):
        batch = edge_list[i:i+500]
        # Build TigerGraph edge payload
        edge_payload = {"edges": {}}
        for e in batch:
            ft  = e["from_type"]; fi = e["from_id"]
            tt  = e["to_type"];   ti = e["to_id"]
            et  = e["edge_type"]; attrs = e.get("attributes", {})
            edge_payload["edges"].setdefault(ft, {}).setdefault(fi, {}).setdefault(et, {}).setdefault(tt, {})[ti] = attrs
        r = requests.post(f"{BASE_URL}/graph/{GRAPH_NAME}", headers=HEADERS,
                          data=json.dumps(edge_payload))
        results.append(r.json())
    return results

with open("chandigarh_vertices.json") as f:
    data = json.load(f)
with open("chandigarh_edges.json") as f:
    edge_data = json.load(f)

print("Loading vertices …")
for vtype, vdict in data["vertices"].items():
    # split large dicts into batches of 200
    items = list(vdict.items())
    for i in range(0, len(items), 200):
        batch = dict(items[i:i+200])
        res = upsert_vertices(vtype, batch)
        print(f"  {vtype} [{i}:{i+len(batch)}]: accepted={res.get('accepted_vertices', '?')}")

print("\nLoading edges …")
res = upsert_edges(edge_data["edges"])
print(f"  Done: {sum(r.get('accepted_edges',0) for r in res if isinstance(r,dict))} edges accepted")

print("\n✅ Load complete.")
