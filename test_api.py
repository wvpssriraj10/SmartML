"""
SmartML Dashboard - End-to-End API Test
Run this AFTER starting the server:
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

The API now requires auth, so this script registers a throwaway account,
then exercises the full flow end to end: upload -> chat -> train -> poll
-> results -> chat -> export, plus job cancellation.

Usage:
    python test_api.py
    python test_api.py iris       # uses test_iris.csv
    python test_api.py <csv_path> # uses your own file
"""
import sys
import time
import json
import uuid
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:8000/api"
CSV  = sys.argv[1] if len(sys.argv) > 1 else "test_iris.csv"
if CSV == "iris":
    CSV = "test_iris.csv"

EMAIL    = f"e2e-{uuid.uuid4().hex[:8]}@smartml.test"
PASSWORD = "smartml-e2e-test-123"

def sep(title=""):
    print(f"\n{'─'*50}")
    if title:
        print(f"  {title}")
        print('─'*50)

def ok(msg):   print(f"  ✅  {msg}")
def err(msg):  print(f"  ❌  {msg}"); sys.exit(1)
def info(msg): print(f"  ℹ️   {msg}")

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def poll_until(job_id, token, target, timeout=300, poll_every=3):
    start = time.time()
    while True:
        r = requests.get(f"{BASE}/status/{job_id}", headers=auth(token), timeout=15)
        r.raise_for_status()
        st = r.json()
        elapsed = round(time.time() - start, 1)
        info(f"[{elapsed}s]  status={st['status']}")
        if st["status"] == target:
            return st
        if st["status"] in ("failed", "cancelled") and st["status"] != target:
            err(f"Job ended as '{st['status']}' while waiting for '{target}': {st.get('message')}")
        if elapsed > timeout:
            err(f"Timed out after {timeout}s waiting for '{target}'")
        time.sleep(poll_every)

# ── 1. Health ──────────────────────────────────────────────────────────────
sep("1 / Health Check")
try:
    r = requests.get(f"{BASE}/health", timeout=5)
    r.raise_for_status()
    ok(r.json())
except Exception as e:
    err(f"Server not reachable: {e}")

# ── 2. Auth (register a throwaway account) ─────────────────────────────────
sep("2 / Register / Login")
try:
    r = requests.post(f"{BASE}/auth/register", data={"email": EMAIL, "password": PASSWORD}, timeout=15)
    if r.status_code == 409:
        info("Account already exists, logging in instead")
        r = requests.post(f"{BASE}/auth/login", data={"email": EMAIL, "password": PASSWORD}, timeout=15)
    r.raise_for_status()
    data = r.json()
    TOKEN = data["token"]
    ok(f"Logged in as {data['user']['email']}")
except Exception as e:
    err(f"Auth failed: {e}")

# ── 3. Upload ──────────────────────────────────────────────────────────────
sep("3 / Upload Dataset")
try:
    with open(CSV, "rb") as f:
        r = requests.post(f"{BASE}/upload", files={"file": (CSV, f, "text/csv")}, headers=auth(TOKEN), timeout=60)
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

# ── 4. Chat / LLM Agent ────────────────────────────────────────────────────
sep("4 / Chat (LLM Agent)")
try:
    r = requests.post(f"{BASE}/chat", headers=auth(TOKEN), json={
        "job_id": job_id,
        "message": "What should I predict with this dataset?",
        "history": []
    }, timeout=120)
    r.raise_for_status()
    chat = r.json()
    ok(f"Reply     : {chat['reply'][:120]}…")
    ok(f"Suggested target      : {chat.get('suggested_target')}")
    ok(f"Suggested problem_type: {chat.get('suggested_problem_type')}")
    suggested_target = chat.get("suggested_target") or insp["column_names"][-1]
    suggested_type   = chat.get("suggested_problem_type") or "classification"
except Exception as e:
    err(f"Chat failed: {e}")

# ── 5. Train ───────────────────────────────────────────────────────────────
sep("5 / Start Training")
try:
    r = requests.post(f"{BASE}/train", headers=auth(TOKEN), json={
        "job_id": job_id,
        "target_column": suggested_target,
        "problem_type": suggested_type,
        "model_selection": "smart"
    }, timeout=30)
    r.raise_for_status()
    ok(r.json())
except Exception as e:
    err(f"Train failed: {e}")

# ── 6. Poll Status ─────────────────────────────────────────────────────────
sep("6 / Polling Status")
poll_until(job_id, TOKEN, "completed", timeout=300)
ok("Training complete!")

# ── 7. Results ─────────────────────────────────────────────────────────────
sep("7 / Results")
try:
    r = requests.get(f"{BASE}/results/{job_id}", headers=auth(TOKEN), timeout=30)
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

# ── 8. Chat on results ─────────────────────────────────────────────────────
sep("8 / Chat on Results")
try:
    r = requests.post(f"{BASE}/chat", headers=auth(TOKEN), json={
        "job_id": job_id,
        "message": "Which model should I use and why?",
        "history": []
    }, timeout=120)
    r.raise_for_status()
    ok(r.json()["reply"][:200])
except Exception as e:
    err(f"Chat (results) failed: {e}")

# ── 9. Export ──────────────────────────────────────────────────────────────
sep("9 / Export Best Model")
try:
    r = requests.post(f"{BASE}/export", headers=auth(TOKEN), json={"job_id": job_id}, timeout=60)
    r.raise_for_status()
    fname = f"test_export_{job_id[:8]}.zip"
    with open(fname, "wb") as f:
        f.write(r.content)
    ok(f"ZIP saved → {fname}  ({len(r.content)//1024} KB)")
except Exception as e:
    err(f"Export failed: {e}")

# ── 10. Cancellation ───────────────────────────────────────────────────────
sep("10 / Job Cancellation")
try:
    with open(CSV, "rb") as f:
        r = requests.post(f"{BASE}/upload", files={"file": (CSV, f, "text/csv")}, headers=auth(TOKEN), timeout=60)
    r.raise_for_status()
    cancel_job_id = r.json()["job_id"]

    r = requests.post(f"{BASE}/train", headers=auth(TOKEN), json={
        "job_id": cancel_job_id,
        "target_column": suggested_target,
        "problem_type": suggested_type,
        "model_selection": "all"
    }, timeout=30)
    r.raise_for_status()
    info("Training started; cancelling immediately…")

    r = requests.post(f"{BASE}/jobs/{cancel_job_id}/cancel", headers=auth(TOKEN), timeout=30)
    r.raise_for_status()
    cancel_res = r.json()
    if cancel_res["status"] != "cancelled":
        info(f"Cancel returned '{cancel_res['status']}' instead of 'cancelled' (training may have finished first).")
    poll_until(cancel_job_id, TOKEN, "cancelled", timeout=60, poll_every=2)
    ok("Job cancelled cleanly.")
except Exception as e:
    err(f"Cancellation failed: {e}")

sep("ALL TESTS PASSED ✅")