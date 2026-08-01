"""
SmartML Dashboard - End-to-End API Test
Run this AFTER starting the server:
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

Usage:
    python test_api.py
    python test_api.py iris       # uses test_iris.csv
    python test_api.py <csv_path> # uses your own file
"""
import sys
import time
import json
import requests

BASE = "http://localhost:8000/api"
CSV  = sys.argv[1] if len(sys.argv) > 1 else "test_iris.csv"

def sep(title=""):
    print(f"\n{'─'*50}")
    if title:
        print(f"  {title}")
        print('─'*50)

def ok(msg):  print(f"  ✅  {msg}")
def err(msg): print(f"  ❌  {msg}"); sys.exit(1)
def info(msg):print(f"  ℹ️   {msg}")

# ── 1. Health ──────────────────────────────────────────────────────────────
sep("1 / Health Check")
try:
    r = requests.get(f"{BASE}/health", timeout=5)
    r.raise_for_status()
    ok(r.json())
except Exception as e:
    err(f"Server not reachable: {e}")

# ── 2. Upload ──────────────────────────────────────────────────────────────
sep("2 / Upload Dataset")
try:
    with open(CSV, "rb") as f:
        r = requests.post(f"{BASE}/upload", files={"file": (CSV, f, "text/csv")})
    r.raise_for_status()
    data = r.json()
    job_id = data["job_id"]
    insp   = data["inspection"]
    ok(f"job_id  : {job_id}")
    ok(f"rows    : {insp['rows']}  |  cols: {insp['columns']}")
    ok(f"numeric : {insp['numeric_columns']}")
    ok(f"categorical: {insp['categorical_columns']}")
    missing_total = sum(v for v in insp["missing_values"].values() if v)
    ok(f"missing : {missing_total}")
except Exception as e:
    err(f"Upload failed: {e}")

# ── 3. Chat / LLM Agent ────────────────────────────────────────────────────
sep("3 / Chat (LLM Agent)")
try:
    r = requests.post(f"{BASE}/chat", json={
        "job_id": job_id,
        "message": "What should I predict with this dataset?",
        "history": []
    })
    r.raise_for_status()
    chat = r.json()
    ok(f"Reply     : {chat['reply'][:120]}…")
    ok(f"Suggested target      : {chat.get('suggested_target')}")
    ok(f"Suggested problem_type: {chat.get('suggested_problem_type')}")
    suggested_target = chat.get("suggested_target") or insp["column_names"][-1]
    suggested_type   = chat.get("suggested_problem_type") or "classification"
except Exception as e:
    err(f"Chat failed: {e}")

# ── 4. Train ───────────────────────────────────────────────────────────────
sep("4 / Start Training")
try:
    r = requests.post(f"{BASE}/train", json={
        "job_id": job_id,
        "target_column": suggested_target,
        "problem_type": suggested_type,
        "model_selection": "smart"
    })
    r.raise_for_status()
    ok(r.json())
except Exception as e:
    err(f"Train failed: {e}")

# ── 5. Poll Status ─────────────────────────────────────────────────────────
sep("5 / Polling Status")
start = time.time()
while True:
    r   = requests.get(f"{BASE}/status/{job_id}")
    st  = r.json()
    elapsed = round(time.time() - start, 1)
    info(f"[{elapsed}s]  status={st['status']}")
    if st["status"] == "completed":
        ok("Training complete!")
        break
    if st["status"] == "failed":
        err(f"Training failed: {st.get('message')}")
    if elapsed > 300:
        err("Timed out after 5 minutes")
    time.sleep(3)

# ── 6. Results ─────────────────────────────────────────────────────────────
sep("6 / Results")
try:
    r = requests.get(f"{BASE}/results/{job_id}")
    r.raise_for_status()
    res = r.json()
    ok(f"Problem type : {res['problem_type']}")
    ok(f"Models trained: {res['total_models']}  (ok={res['successful']}, fail={res['failed']})")
    best = res["best_model"]
    ok(f"Best model   : {best['name']}")
    ok(f"Metrics      : {json.dumps(best['metrics'])}")
    print()
    print("  Full leaderboard:")
    for m in res["results"]:
        rank  = m.get("rank", "?")
        name  = m["model_name"]
        mets  = m.get("metrics", {})
        top   = next(iter(mets.items()), ("—","—"))
        print(f"    #{rank:>2}  {name:<25}  {top[0]}={top[1]}")
except Exception as e:
    err(f"Results failed: {e}")

# ── 7. Chat on results ─────────────────────────────────────────────────────
sep("7 / Chat on Results")
try:
    r = requests.post(f"{BASE}/chat", json={
        "job_id": job_id,
        "message": "Which model should I use and why?",
        "history": []
    })
    r.raise_for_status()
    ok(r.json()["reply"][:200])
except Exception as e:
    err(f"Chat (results) failed: {e}")

# ── 8. Export ──────────────────────────────────────────────────────────────
sep("8 / Export Best Model")
try:
    r = requests.post(f"{BASE}/export", json={"job_id": job_id})
    r.raise_for_status()
    fname = f"test_export_{job_id[:8]}.zip"
    with open(fname, "wb") as f:
        f.write(r.content)
    ok(f"ZIP saved → {fname}  ({len(r.content)//1024} KB)")
except Exception as e:
    err(f"Export failed: {e}")

sep("ALL TESTS PASSED ✅")
