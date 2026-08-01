import sqlite3
import json

conn = sqlite3.connect('smartml.db')
conn.row_factory = sqlite3.Row
rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 5").fetchall()
for r in rows:
    d = dict(r)
    print("JOB:", d['id'])
    print("  File:", d['original_filename'])
    print("  Status:", d['status'])
    print("  Target:", d['target_column'])
    print("  Problem:", d['problem_type'])
    if d['results']:
        try:
            res = json.loads(d['results'])
            print("  Results count:", len(res))
            for m in res:
                print(f"    - {m['model_name']}: status={m.get('status')}, error={m.get('error')}")
        except Exception as e:
            print("  Results parsing failed:", e)
    if d['error']:
        print("  Error:", d['error'])
conn.close()
