from dotenv import load_dotenv
load_dotenv('.env')
import backend.database as db

c = db.get_connection()
rows = c.execute(
    "SELECT id, status, error, created_at FROM jobs WHERE created_at > %s ORDER BY created_at",
    ("2026-08-18T22:33:00",),
).fetchall()
for r in rows:
    print(r)
c.close()