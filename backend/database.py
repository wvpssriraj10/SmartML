import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'smartml.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS datasets (
            id TEXT PRIMARY KEY,
            name TEXT,
            filename TEXT,
            file_path TEXT,
            cleaned_file_path TEXT,
            file_size INTEGER DEFAULT 0,
            file_type TEXT,
            status TEXT DEFAULT 'in_progress',
            row_count INTEGER DEFAULT 0,
            col_count INTEGER DEFAULT 0,
            cleaning_pipeline TEXT DEFAULT '[]',
            inspection_data TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            dataset_id TEXT,
            status TEXT DEFAULT 'pending',
            file_path TEXT,
            original_filename TEXT,
            target_column TEXT,
            problem_type TEXT,
            model_selection TEXT DEFAULT 'smart',
            selected_models TEXT,
            inspection TEXT,
            results TEXT,
            data_report TEXT,
            best_model_name TEXT,
            best_model_metrics TEXT,
            artifact_path TEXT,
            progress TEXT,
            logs TEXT,
            error TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    conn.commit()

    # ── Migrations: add columns to existing DBs ──────────────────────────
    existing = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
    migrations = [
        ("dataset_id",         "ALTER TABLE jobs ADD COLUMN dataset_id TEXT"),
        ("best_model_name",    "ALTER TABLE jobs ADD COLUMN best_model_name TEXT"),
        ("best_model_metrics", "ALTER TABLE jobs ADD COLUMN best_model_metrics TEXT"),
        ("artifact_path",      "ALTER TABLE jobs ADD COLUMN artifact_path TEXT"),
        ("progress",           "ALTER TABLE jobs ADD COLUMN progress TEXT"),
        ("logs",               "ALTER TABLE jobs ADD COLUMN logs TEXT"),
    ]
    for col, sql in migrations:
        if col not in existing:
            conn.execute(sql)
    conn.commit()
    conn.close()


def create_dataset(dataset_id, name, filename, file_path, file_size=0, file_type='csv', row_count=0, col_count=0, inspection_data=None):
    conn = get_connection()
    now = datetime.now().isoformat()
    conn.execute(
        '''INSERT INTO datasets (id, name, filename, file_path, file_size, file_type, status, row_count, col_count, cleaning_pipeline, inspection_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, '[]', ?, ?, ?)''',
        (dataset_id, name, filename, file_path, file_size, file_type, row_count, col_count, json.dumps(inspection_data) if isinstance(inspection_data, dict) else inspection_data, now, now)
    )
    conn.commit()
    conn.close()


def update_dataset(dataset_id, **kwargs):
    conn = get_connection()
    now = datetime.now().isoformat()
    kwargs['updated_at'] = now
    set_clause = ', '.join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [dataset_id]
    conn.execute(f'UPDATE datasets SET {set_clause} WHERE id = ?', values)
    conn.commit()
    conn.close()


def get_dataset(dataset_id):
    conn = get_connection()
    row = conn.execute('SELECT * FROM datasets WHERE id = ?', (dataset_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def list_datasets(limit=50):
    conn = get_connection()
    rows = conn.execute('SELECT * FROM datasets ORDER BY updated_at DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_dataset(dataset_id):
    conn = get_connection()
    conn.execute('DELETE FROM datasets WHERE id = ?', (dataset_id,))
    conn.execute('DELETE FROM jobs WHERE dataset_id = ?', (dataset_id,))
    conn.commit()
    conn.close()


def create_job(job_id, file_path, original_filename, dataset_id=None):
    conn = get_connection()
    now = datetime.now().isoformat()
    conn.execute(
        'INSERT INTO jobs (id, dataset_id, file_path, original_filename, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (job_id, dataset_id, file_path, original_filename, 'uploaded', now, now)
    )
    conn.commit()
    conn.close()


def update_job(job_id, **kwargs):
    conn = get_connection()
    now = datetime.now().isoformat()
    kwargs['updated_at'] = now
    set_clause = ', '.join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [job_id]
    conn.execute(f'UPDATE jobs SET {set_clause} WHERE id = ?', values)
    conn.commit()
    conn.close()


def get_job(job_id):
    conn = get_connection()
    row = conn.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def list_jobs(limit=20):
    conn = get_connection()
    rows = conn.execute('SELECT id, dataset_id, original_filename, status, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def append_job_log(job_id, message, level='info', progress=None):
    """Append a bounded, UI-friendly log entry and optionally update progress."""
    conn = get_connection()
    row = conn.execute('SELECT logs FROM jobs WHERE id = ?', (job_id,)).fetchone()
    logs = json.loads(row['logs']) if row and row['logs'] else []
    logs.append({
        'timestamp': datetime.now().isoformat(),
        'level': level,
        'message': message,
    })
    # Avoid unbounded SQLite rows for long-running jobs.
    logs = logs[-100:]
    values = [json.dumps(logs), datetime.now().isoformat()]
    sql = 'UPDATE jobs SET logs = ?, updated_at = ?'
    if progress is not None:
        sql += ', progress = ?'
        values.append(json.dumps(progress))
    values.append(job_id)
    conn.execute(sql + ' WHERE id = ?', values)
    conn.commit()
    conn.close()
