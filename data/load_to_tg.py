#!/usr/bin/env python3
"""
TigerGraph Data Loader – Chandigarh UrbanSafetyGraph
JWT Bearer token auth (no username/password).

Bypasses institutional DNS block by patching socket.getaddrinfo
so Python uses the pre-resolved IP instead of the blocked college DNS.

Usage:
    python load_to_tg.py
"""

import json
import socket
import time
import requests

# ─── CONFIG ──────────────────────────────────────────────────────────────────
TOKEN      = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwYWxha21pdHRhbC5idDI1Y3NlZHNAcGVjLmVkdS5pbiIsImlhdCI6MTc3NTExMzA3NiwiZXhwIjoxNzgyODg5MDgxLCJpc3MiOiJUaWdlckdyYXBoIn0.qDivaGPN9N9nRCwDnepSqgXNyjF76yo1ABmLMngEHXg"
GRAPH_NAME = "UrbanSafetyGraph"
HOSTNAME   = "tg-955b4acb-5d72-46eb-a8f4-420628df0978.tg-3452941248.i.tgcloud.io"

# IPs pre-resolved via Google DNS 8.8.8.8 (bypasses college DNS block)
RESOLVED_IPS = ["3.109.145.130", "13.126.119.236", "13.126.226.150"]

# Confirmed working REST++ upsert path
UPSERT_URL = f"https://{HOSTNAME}/restpp/graph/{GRAPH_NAME}"

HEADERS = {
    "Content-Type":  "application/json",
    "Authorization": f"Bearer {TOKEN}",
}

VERTEX_BATCH = 200
EDGE_BATCH   = 300

# ─── DNS PATCH ───────────────────────────────────────────────────────────────

_original_getaddrinfo = socket.getaddrinfo

def _patched_getaddrinfo(host, port, *args, **kwargs):
    """Return pre-resolved IPs for the TG hostname (bypasses blocked DNS)."""
    if host == HOSTNAME:
        results = []
        for ip in RESOLVED_IPS:
            results.append((socket.AF_INET, socket.SOCK_STREAM, 6, '',
                            (ip, port or 443)))
        return results
    return _original_getaddrinfo(host, port, *args, **kwargs)

socket.getaddrinfo = _patched_getaddrinfo
print(f"🔧  DNS patch active → {HOSTNAME} → {RESOLVED_IPS[0]}")

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def upsert(payload: dict, retries: int = 3) -> dict:
    """POST one upsert payload; retry on transient errors."""
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(UPSERT_URL, headers=HEADERS,
                              data=json.dumps(payload), timeout=60)
            if r.status_code == 200:
                return r.json()
            print(f"  ⚠️  HTTP {r.status_code}: {r.text[:200]}")
            return {}
        except requests.exceptions.RequestException as e:
            print(f"  ⚠️  Attempt {attempt} failed: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return {}


def warmup_check():
    """Send a 1-vertex test POST to confirm the endpoint is live."""
    test = {"vertices": {"Intersection": {
        "INT_S01": {"intersection_id": {"value": "INT_S01"},
                    "intersection_name": {"value": "Capitol Complex"},
                    "latitude": {"value": 30.764379},
                    "longitude": {"value": 76.79925}}
    }}}
    r = upsert(test)
    accepted = r.get("accepted_vertices", "?")
    print(f"🔗  Warmup upsert → accepted_vertices={accepted}  ✅")


def load_vertices(vertices: dict):
    total = 0
    for vtype, vdict in vertices.items():
        items = list(vdict.items())
        print(f"\n  ┌─ {vtype}  ({len(items)} vertices)")
        for i in range(0, len(items), VERTEX_BATCH):
            batch = dict(items[i : i + VERTEX_BATCH])
            res   = upsert({"vertices": {vtype: batch}})
            accepted = res.get("accepted_vertices", "?")
            print(f"  │  [{i}–{i+len(batch)-1}] accepted={accepted}")
            if isinstance(accepted, int):
                total += accepted
        print(f"  └─ done")
    print(f"\n✅  Vertices total accepted ≈ {total}")


def load_edges(edges: list):
    total   = 0
    batches = (len(edges) + EDGE_BATCH - 1) // EDGE_BATCH
    print(f"\n  ┌─ Edges  ({len(edges)} total, {batches} batches)")
    for i in range(0, len(edges), EDGE_BATCH):
        batch = edges[i : i + EDGE_BATCH]
        payload = {"edges": {}}
        for e in batch:
            ft = e["from_type"]; fi = e["from_id"]
            tt = e["to_type"];   ti = e["to_id"]
            et = e["edge_type"]; attrs = e.get("attributes", {})
            (payload["edges"]
             .setdefault(ft, {})
             .setdefault(fi, {})
             .setdefault(et, {})
             .setdefault(tt, {}))[ti] = attrs
        res      = upsert(payload)
        accepted = res.get("accepted_edges", "?")
        print(f"  │  batch {i//EDGE_BATCH+1}/{batches}: accepted={accepted}")
        if isinstance(accepted, int):
            total += accepted
    print(f"  └─ done")
    print(f"\n✅  Edges total accepted ≈ {total}")


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  TigerGraph Loader – Chandigarh UrbanSafetyGraph")
    print(f"  Endpoint: {UPSERT_URL}")
    print("=" * 60)

    # 1. Warm-up / connectivity check
    warmup_check()

    # 2. Load data files
    print(f"\n📂  Reading chandigarh_vertices.json …")
    with open("chandigarh_vertices.json") as f:
        vtx_data = json.load(f)

    print(f"📂  Reading chandigarh_edges.json …")
    with open("chandigarh_edges.json") as f:
        edge_data = json.load(f)

    # 3. Upload vertices
    print("\n─── VERTICES ─────────────────────────────────────────")
    load_vertices(vtx_data["vertices"])

    # 4. Upload edges
    print("\n─── EDGES ────────────────────────────────────────────")
    load_edges(edge_data["edges"])

    print("\n" + "=" * 60)
    print("  🎉  Load complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
