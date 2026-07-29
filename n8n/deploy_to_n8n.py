#!/usr/bin/env python3
"""Deploy 10 workflows to n8n cloud via REST API.

Strategy:
  1. List existing workflows; match by exact name.
  2. For new workflows  → POST /workflows with {name, nodes, connections, settings}.
  3. For existing ones  → PUT  /workflows/{id} to bring them in sync.
  4. After upsert, sync tags via POST /workflows/{id}/tags.
  5. Leave active=false everywhere — user activates manually.
"""
import json
import os
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

N8N_URL = "https://launchpad-novaops.app.n8n.cloud"
N8N_KEY = os.environ["N8N_KEY"]
WF_DIR  = Path("/home/user/workspace/n8n/workflows")

HEADERS = {
    "X-N8N-API-KEY": N8N_KEY,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
}

def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            txt = res.read().decode()
            return res.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try: body = json.loads(body)
        except: pass
        return e.code, body

# ── 1. Existing workflows ────────────────────────────────────────────
status, all_wf = req("GET", "/workflows?limit=250")
assert status == 200, all_wf
existing = {w["name"]: w["id"] for w in all_wf["data"]}
print(f"Existing workflows: {len(existing)}")

# ── 2. Existing tags (we'll add any missing) ─────────────────────────
status, all_tags = req("GET", "/tags?limit=250")
tag_id_by_name = {t["name"]: t["id"] for t in all_tags["data"]}
print(f"Existing tags: {len(tag_id_by_name)}")

def ensure_tag(name):
    if name in tag_id_by_name:
        return tag_id_by_name[name]
    s, body = req("POST", "/tags", {"name": name})
    if s in (200, 201):
        tid = body["id"]
        tag_id_by_name[name] = tid
        return tid
    print(f"   ⚠ failed to create tag {name}: {s} {body}")
    return None

# ── 3. Push every workflow ───────────────────────────────────────────
results = []
for f in sorted(WF_DIR.glob("*.json")):
    wf = json.loads(f.read_text())
    name = wf["name"]
    tag_names = [t["name"] for t in wf.get("tags", [])]
    body = {
        "name":        name,
        "nodes":       wf["nodes"],
        "connections": wf["connections"],
        "settings":    wf.get("settings", {"executionOrder": "v1"}),
    }

    if name in existing:
        wid = existing[name]
        s, resp = req("PUT", f"/workflows/{wid}", body)
        action = "UPDATE"
    else:
        s, resp = req("POST", "/workflows", body)
        action = "CREATE"
        if s in (200, 201):
            wid = resp["id"]
            existing[name] = wid

    if s in (200, 201):
        wid = resp.get("id") or existing[name]
        # tags
        tag_ids = [{"id": ensure_tag(n)} for n in tag_names if ensure_tag(n)]
        if tag_ids:
            ts, _ = req("PUT", f"/workflows/{wid}/tags", tag_ids)
        else:
            ts = "n/a"
        print(f"  ✓ {action}  id={wid}  tags={ts}  {name}")
        results.append({"file": f.name, "id": wid, "name": name, "action": action, "tag_status": ts})
    else:
        print(f"  ✗ {action} FAILED ({s})  {name}")
        print(f"     resp: {json.dumps(resp)[:500]}")
        results.append({"file": f.name, "name": name, "action": action, "error": resp, "status": s})
    time.sleep(0.3)

# ── 4. Save deploy report ────────────────────────────────────────────
report = Path("/home/user/workspace/n8n/deploy_report.json")
report.write_text(json.dumps(results, indent=2))
ok = sum(1 for r in results if "id" in r)
print(f"\nDONE: {ok}/{len(results)} succeeded.  Report → {report}")
