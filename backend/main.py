import os
import re
import uuid
import json
import sys
import zipfile
import io
import shutil
import boto3
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Supabase Storage (S3-compatible) client
_supabase = None
def get_supabase():
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not (url and key):
            return None
        # Supabase S3 endpoint: https://<project-ref>.supabase.co/storage/v1/s3
        endpoint = url.rstrip("/") + "/storage/v1/s3"
        _supabase = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key,
            aws_secret_access_key=key,  # Supabase uses same key for both
            region_name="auto",
        )
    return _supabase

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables from a root .env file when starting the backend.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from ml_engine.trainer import convert
from ml_engine.preprocessing import DatasetInspector
from ml_engine.cleaning import apply_cleaning_action, calculate_dataset_metrics
from ml_engine.ai_insights import generate_executive_insights, generate_pdf_report
from .database import (
    init_db, create_job, update_job, get_job, list_jobs,
    create_dataset, update_dataset, get_dataset, list_datasets, delete_dataset,
    create_user, get_user_by_email, get_user_by_id,
)
from .auth import hash_password, verify_password, create_token, verify_token
from .schemas import TrainRequest, UploadResponse, StatusResponse, ChatRequest, ChatResponse, ExportRequest, CleaningActionRequest, ClusterRequest, AnomalyRequest
from .worker import start_training, start_clustering, start_anomaly
from .llm_agent import chat_with_agent
from .exporter import generate_inference_code, generate_requirements, generate_readme
import pandas as pd


UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="SmartML Dashboard API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SmartML Dashboard", "version": "2.0.0"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(None)):
    """FastAPI dependency resolving the bearer token to a user record."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def _public_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user.get("display_name"),
        "created_at": user.get("created_at"),
    }


@app.post("/api/auth/register")
def register(email: str = Form(...), password: str = Form(...), display_name: str = Form(None)):
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid.uuid4())
    ok = create_user(user_id, email, hash_password(password), display_name)
    if not ok:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = get_user_by_id(user_id)
    return {"token": create_token(user_id), "user": _public_user(user)}


@app.post("/api/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    email = (email or "").strip().lower()
    user = get_user_by_email(email) if email else None
    if not user or not verify_password(password or "", user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": _public_user(user)}


# ─── Supabase Direct Upload ─────────────────────────────────────────────────────

@app.post("/api/upload/presign")
def presign_upload(filename: str = Form(...), content_type: str = Form(...)):
    s3 = get_supabase()
    if not s3:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    bucket = os.getenv("SUPABASE_BUCKET", "uploads")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls', '.json']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")
    key = f"uploads/{uuid.uuid4()}{ext}"
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return {"url": url, "key": key, "bucket": bucket}


# ─── Upload ───────────────────────────────────────────────────────────────────

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls', '.json']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Use CSV, Excel, or JSON.")

    job_id = str(uuid.uuid4())
    safe_name = f"{job_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        inspector = DatasetInspector(file_path)
        inspector.load()
        inspection = inspector.inspect()
        # Take a sample of the data for feature analysis
        sample_size = min(1000, len(inspector.df))
        sample_df = inspector.df.head(sample_size)
        # Convert to list of dicts
        sample = sample_df.to_dict('records')
        # Convert numpy types to Python types
        inspection['sample'] = convert(sample)
        target_candidates = inspector.suggest_target()
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to parse dataset: {str(e)}")

    preferred_names = ('target', 'label', 'class', 'output', 'result', 'outcome', 'price', 'salary', 'churn')
    suggested = next((item['column'] for name in preferred_names for item in target_candidates if name in item['column'].lower()), None)
    if not suggested and target_candidates:
        suggested = target_candidates[-1]['column']
    if suggested:
        unique_count = inspection.get('column_stats', {}).get(suggested, {}).get('unique_count', 0)
        inspection['suggested_target'] = suggested
        inspection['suggested_problem_type'] = 'classification' if suggested in inspection.get('categorical_columns', []) or unique_count <= 20 else 'regression'
        inspection.setdefault('kpis', {})['suggested_target'] = suggested

    create_job(job_id, file_path, file.filename, user_id=user["id"])
    update_job(job_id, inspection=json.dumps(convert(inspection), indent=2))

    # Also register dataset entity
    dataset_id = job_id
    metrics = calculate_dataset_metrics(inspector.df)
    create_dataset(
        dataset_id=dataset_id,
        name=file.filename.split('.')[0].replace('_', ' ').title(),
        filename=file.filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        file_type=ext.replace('.', ''),
        row_count=inspection['rows'],
        col_count=inspection['columns'],
        inspection_data=metrics,
        user_id=user["id"]
    )

    return UploadResponse(
        job_id=job_id,
        filename=file.filename,
        inspection=inspection,
        message=f"Dataset '{file.filename}' uploaded. Rows: {inspection['rows']}, Columns: {inspection['columns']}"
    )


@app.post("/api/upload/complete", response_model=UploadResponse)
async def complete_supabase_upload(
    key: str = Form(...),
    filename: str = Form(...),
    bucket: str = Form(...),
    user: dict = Depends(get_current_user),
):
    s3 = get_supabase()
    if not s3:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    if not bucket:
        bucket = os.getenv("SUPABASE_BUCKET", "uploads")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls', '.json']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    job_id = str(uuid.uuid4())
    safe_name = f"{job_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Stream download from Supabase to local file (no full memory load)
    try:
        s3.download_file(bucket, key, file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to download from Supabase: {e}")

    try:
        inspector = DatasetInspector(file_path)
        inspector.load()
        inspection = inspector.inspect()
        sample_size = min(1000, len(inspector.df))
        sample_df = inspector.df.head(sample_size)
        sample = sample_df.to_dict('records')
        inspection['sample'] = convert(sample)
        target_candidates = inspector.suggest_target()
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to parse dataset: {str(e)}")

    preferred_names = ('target', 'label', 'class', 'output', 'result', 'outcome', 'price', 'salary', 'churn')
    suggested = next((item['column'] for name in preferred_names for item in target_candidates if name in item['column'].lower()), None)
    if not suggested and target_candidates:
        suggested = target_candidates[-1]['column']
    if suggested:
        unique_count = inspection.get('column_stats', {}).get(suggested, {}).get('unique_count', 0)
        inspection['suggested_target'] = suggested
        inspection['suggested_problem_type'] = 'classification' if suggested in inspection.get('categorical_columns', []) or unique_count <= 20 else 'regression'
        inspection.setdefault('kpis', {})['suggested_target'] = suggested

    create_job(job_id, file_path, filename, user_id=user["id"])
    update_job(job_id, inspection=json.dumps(convert(inspection), indent=2))

    dataset_id = job_id
    metrics = calculate_dataset_metrics(inspector.df)
    create_dataset(
        dataset_id=dataset_id,
        name=filename.split('.')[0].replace('_', ' ').title(),
        filename=filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        file_type=ext.replace('.', ''),
        row_count=inspection['rows'],
        col_count=inspection['columns'],
        inspection_data=metrics,
        user_id=user["id"]
    )

    return UploadResponse(
        job_id=job_id,
        filename=filename,
        inspection=inspection,
        message=f"Dataset '{filename}' uploaded. Rows: {inspection['rows']}, Columns: {inspection['columns']}"
    )


# ─── DataSense Dataset Library & Cleaning API ─────────────────────────────────

@app.get("/api/datasets")
def get_datasets_list(limit: int = 50, user: dict = Depends(get_current_user)):
    datasets = list_datasets(limit, user_id=user["id"])
    for ds in datasets:
        if ds.get('cleaning_pipeline'):
            try:
                ds['cleaning_pipeline'] = json.loads(ds['cleaning_pipeline'])
            except Exception:
                ds['cleaning_pipeline'] = []
        if ds.get('inspection_data'):
            try:
                ds['inspection_data'] = json.loads(ds['inspection_data'])
            except Exception:
                ds['inspection_data'] = {}
    return {"datasets": datasets}


@app.get("/api/datasets/{dataset_id}")
def get_dataset_by_id(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if ds.get('cleaning_pipeline'):
        try:
            ds['cleaning_pipeline'] = json.loads(ds['cleaning_pipeline'])
        except Exception:
            ds['cleaning_pipeline'] = []

    file_to_load = ds.get('cleaned_file_path') or ds.get('file_path')
    if os.path.exists(file_to_load):
        try:
            inspector = DatasetInspector(file_to_load)
            inspector.load()
            metrics = calculate_dataset_metrics(inspector.df)
            ds['metrics'] = metrics
            ds['columns'] = list(inspector.df.columns)
        except Exception:
            pass

    return ds


@app.delete("/api/datasets/{dataset_id}")
def remove_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if os.path.exists(ds['file_path']):
        try:
            os.remove(ds['file_path'])
        except Exception:
            pass
    if ds.get('cleaned_file_path') and os.path.exists(ds['cleaned_file_path']):
        try:
            os.remove(ds['cleaned_file_path'])
        except Exception:
            pass
    delete_dataset(dataset_id, user_id=user["id"])
    return {"message": "Dataset deleted successfully", "id": dataset_id}


@app.get("/api/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: str, page: int = 1, page_size: int = 20, search: str = "", user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = ds.get('cleaned_file_path') or ds.get('file_path')
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df

    if search:
        mask = df.astype(str).apply(lambda row: row.str.contains(search, case=False, na=False)).any(axis=1)
        df = df[mask]

    total_rows = len(df)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    page = max(1, min(page, total_pages))

    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_rows)

    page_df = df.iloc[start_idx:end_idx].fillna("")
    records = convert(page_df.to_dict('records'))

    return {
        "dataset_id": dataset_id,
        "name": ds['name'],
        "columns": list(df.columns),
        "rows": records,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "start_row": start_idx + 1 if total_rows > 0 else 0,
        "end_row": end_idx
    }


@app.post("/api/datasets/{dataset_id}/cleaning/actions")
def apply_cleaning_step(dataset_id: str, req: CleaningActionRequest, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds['status'] == 'finalized':
        raise HTTPException(status_code=400, detail="Dataset is finalized and locked against further edits.")

    source_path = ds.get('cleaned_file_path') or ds.get('file_path')
    if not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Source file not found")

    inspector = DatasetInspector(source_path)
    inspector.load()
    df = inspector.df

    cleaned_df, step_desc = apply_cleaning_action(
        df=df,
        action=req.action,
        column=req.column,
        strategy=req.strategy,
        value=req.value,
        replace_with=req.replace_with
    )

    # Save cleaned dataframe to file
    cleaned_file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned.csv")
    cleaned_df.to_csv(cleaned_file_path, index=False)

    # Append to cleaning pipeline history
    pipeline = json.loads(ds.get('cleaning_pipeline', '[]')) if ds.get('cleaning_pipeline') else []
    step_id = f"step_{len(pipeline) + 1}"
    new_step = {
        "step_id": step_id,
        "action": req.action,
        "column": req.column,
        "strategy": req.strategy,
        "description": step_desc,
        "timestamp": datetime.now().isoformat()
    }
    pipeline.append(new_step)

    metrics = calculate_dataset_metrics(cleaned_df)

    update_dataset(
        dataset_id,
        cleaned_file_path=cleaned_file_path,
        row_count=metrics['rows'],
        col_count=metrics['cols'],
        cleaning_pipeline=json.dumps(pipeline),
        inspection_data=json.dumps(metrics)
    )

    return {
        "dataset_id": dataset_id,
        "step": new_step,
        "pipeline": pipeline,
        "metrics": metrics,
        "columns": list(cleaned_df.columns),
        "message": f"Applied cleaning action: {step_desc}"
    }


@app.post("/api/datasets/{dataset_id}/cleaning/undo")
def undo_cleaning_step(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds['status'] == 'finalized':
        raise HTTPException(status_code=400, detail="Dataset is finalized and locked.")

    pipeline = json.loads(ds.get('cleaning_pipeline', '[]')) if ds.get('cleaning_pipeline') else []
    if not pipeline:
        raise HTTPException(status_code=400, detail="No cleaning steps to undo.")

    pipeline.pop()

    # Re-apply remaining pipeline steps on raw file
    raw_path = ds['file_path']
    inspector = DatasetInspector(raw_path)
    inspector.load()
    df = inspector.df

    for step in pipeline:
        df, _ = apply_cleaning_action(
            df=df,
            action=step.get('action'),
            column=step.get('column'),
            strategy=step.get('strategy'),
            value=step.get('value'),
            replace_with=step.get('replace_with')
        )

    cleaned_file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned.csv")
    if pipeline:
        df.to_csv(cleaned_file_path, index=False)
    else:
        if os.path.exists(cleaned_file_path):
            os.remove(cleaned_file_path)
        cleaned_file_path = None

    metrics = calculate_dataset_metrics(df)

    update_dataset(
        dataset_id,
        cleaned_file_path=cleaned_file_path,
        row_count=metrics['rows'],
        col_count=metrics['cols'],
        cleaning_pipeline=json.dumps(pipeline),
        inspection_data=json.dumps(metrics)
    )

    return {
        "dataset_id": dataset_id,
        "pipeline": pipeline,
        "metrics": metrics,
        "columns": list(df.columns),
        "message": "Undid last cleaning step successfully"
    }


@app.post("/api/datasets/{dataset_id}/finalize")
def finalize_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    update_dataset(dataset_id, status='finalized')
    return {"dataset_id": dataset_id, "status": "finalized", "message": f"Dataset '{ds['name']}' has been finalized and locked."}


@app.get("/api/datasets/{dataset_id}/download")
def download_cleaned_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = ds.get('cleaned_file_path') or ds.get('file_path')
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    filename = f"{ds['name'].replace(' ', '_').lower()}_cleaned.csv"
    return StreamingResponse(
        open(file_path, "rb"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/datasets/{dataset_id}/ai-insights")
def get_dataset_ai_insights(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = ds.get('cleaned_file_path') or ds.get('file_path')
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df

    insights = generate_executive_insights(df=df, dataset_name=ds['name'])
    return {"dataset_id": dataset_id, "name": ds['name'], "insights": insights}


@app.get("/api/datasets/{dataset_id}/pdf-report")
def download_dataset_pdf_report(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = get_dataset(dataset_id, user_id=user["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = ds.get('cleaned_file_path') or ds.get('file_path')
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df

    insights = generate_executive_insights(df=df, dataset_name=ds['name'])
    pdf_bytes = generate_pdf_report(dataset_name=ds['name'], insights=insights)

    safe_name = ds['name'].replace(' ', '_').lower()
    filename = f"AI_Insights_Report_{safe_name}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )




# ─── Train ────────────────────────────────────────────────────────────────────

@app.post("/api/train")
def train_model(req: TrainRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] == 'running':
        raise HTTPException(status_code=400, detail="Training already in progress")
    if job['status'] == 'completed':
        raise HTTPException(status_code=400, detail="Training already completed. Use /api/results endpoint.")

    # Validate that the target column exists in the dataset
    inspection = json.loads(job['inspection']) if job['inspection'] else {}
    column_names = inspection.get('column_names', [])
    if req.target_column not in column_names:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{req.target_column}' not found in dataset. Available columns: {column_names}"
        )

    update_job(
        req.job_id,
        target_column=req.target_column,
        problem_type=req.problem_type,
        model_selection=req.model_selection,
        selected_models=json.dumps(req.selected_models) if req.selected_models else None,
        status='queued'
    )

    start_training(
        job_id=req.job_id,
        file_path=job['file_path'],
        target_column=req.target_column,
        problem_type=req.problem_type,
        model_selection=req.model_selection,
        selected_models=req.selected_models
    )

    return {"job_id": req.job_id, "status": "queued", "message": "Training started in background. Poll /api/status for updates."}


# ─── Clustering (Explore mode) ────────────────────────────────────────────────

@app.get("/api/cluster/meta")
def cluster_meta():
    from ml_engine.clustering import _metadata
    return _metadata()


@app.post("/api/cluster")
def cluster_run(req: ClusterRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job['file_path']):
        raise HTTPException(status_code=404, detail="Dataset file missing")
    if job['status'] == 'running':
        raise HTTPException(status_code=400, detail="A job is already running on this dataset")

    if req.n_clusters < 2 or req.n_clusters > 50:
        raise HTTPException(status_code=400, detail="n_clusters must be between 2 and 50")

    update_job(
        req.job_id,
        status='queued',
        target_column=None,
        cluster_results=None,
        anomaly_results=None,
        results=None,
        data_report=None,
        error=None,
    )

    start_clustering(
        job_id=req.job_id,
        file_path=job['file_path'],
        algorithms=req.algorithms,
        n_clusters=req.n_clusters,
        columns=req.columns,
    )

    return {"job_id": req.job_id, "status": "queued",
            "message": "Clustering started in background. Poll /api/status for updates."}


@app.get("/api/cluster/results/{job_id}")
def get_cluster_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Clustering not completed. Current status: {job['status']}")
    if not job.get('cluster_results'):
        raise HTTPException(status_code=409, detail="No clustering results stored for this job.")

    cluster_results = json.loads(job['cluster_results'])
    return {
        "job_id": job_id,
        "filename": job['original_filename'],
        "task_type": "cluster",
        **cluster_results,
    }


@app.post("/api/cluster/export")
def export_cluster_results(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Clustering must be completed before export.")
    if not job.get('cluster_results'):
        raise HTTPException(status_code=409, detail="No clustering results stored for this job.")

    cluster_results = json.loads(job['cluster_results'])
    model = req.model_name
    selected = None
    for r in cluster_results.get('results', []):
        if r['model'] == model:
            selected = r
            break
    if not selected:
        selected = (cluster_results.get('results') or [None])[0]
    if not selected:
        raise HTTPException(status_code=409, detail="No clustering model results to export.")

    # Build CSV: row_index, cluster, followed by the raw dataset row
    labels = selected.get('cluster_labels', [])
    file_path = job['file_path']
    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df
    if len(df) > len(labels):
        df = df.head(len(labels))

    import io as _io
    buf = _io.StringIO()
    df.insert(0, 'cluster', labels)
    df = df.head(len(labels))
    df.to_csv(buf, index_label='row_index')
    buf.seek(0)

    profiles_json = json.dumps(selected.get('profiles', {}), indent=2)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cluster_assignments.csv", buf.getvalue())
        zf.writestr("cluster_profiles.json", profiles_json)
    zip_buffer.seek(0)

    safe_model = re.sub(r'[^a-z0-9]+', '_', selected['model'].lower()).strip('_')
    filename = f"SmartML-clusters-{safe_model}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Anomaly Detection ────────────────────────────────────────────────────────

@app.get("/api/anomaly/meta")
def anomaly_meta():
    from ml_engine.anomaly import _metadata
    return _metadata()


@app.post("/api/anomaly")
def anomaly_run(req: AnomalyRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job['file_path']):
        raise HTTPException(status_code=404, detail="Dataset file missing")
    if job['status'] == 'running':
        raise HTTPException(status_code=400, detail="A job is already running on this dataset")

    if req.contamination < 0.01 or req.contamination > 0.5:
        raise HTTPException(status_code=400, detail="contamination must be between 0.01 and 0.5")

    update_job(
        req.job_id,
        status='queued',
        target_column=None,
        cluster_results=None,
        anomaly_results=None,
        results=None,
        data_report=None,
        error=None,
    )

    start_anomaly(
        job_id=req.job_id,
        file_path=job['file_path'],
        detectors=req.detectors,
        contamination=req.contamination,
        columns=req.columns,
    )

    return {"job_id": req.job_id, "status": "queued",
            "message": "Anomaly detection started in background. Poll /api/status for updates."}


@app.get("/api/anomaly/results/{job_id}")
def get_anomaly_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Anomaly detection not completed. Current status: {job['status']}")
    if not job.get('anomaly_results'):
        raise HTTPException(status_code=409, detail="No anomaly results stored for this job.")

    anomaly_results = json.loads(job['anomaly_results'])
    return {
        "job_id": job_id,
        "filename": job['original_filename'],
        "task_type": "anomaly",
        **anomaly_results,
    }


@app.post("/api/anomaly/export")
def export_anomaly_results(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Anomaly detection must be completed before export.")
    if not job.get('anomaly_results'):
        raise HTTPException(status_code=409, detail="No anomaly results stored for this job.")

    anomaly_results = json.loads(job['anomaly_results'])
    detector = req.model_name
    selected = None
    for r in anomaly_results.get('results', []):
        if r['detector'] == detector:
            selected = r
            break
    if not selected:
        selected = (anomaly_results.get('results') or [None])[0]
    if not selected:
        raise HTTPException(status_code=409, detail="No anomaly detector results to export.")

    labels = selected.get('anomaly_labels', [])
    scores = selected.get('scores', [])
    file_path = job['file_path']
    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df
    if len(df) > len(labels):
        df = df.head(len(labels))

    import io as _io
    buf = _io.StringIO()
    out = df.copy().head(len(labels))
    out.insert(0, 'is_anomaly', labels)
    out.insert(1, 'anomaly_score', scores)
    out.to_csv(buf, index_label='row_index')
    buf.seek(0)

    profiles_json = json.dumps(selected.get('profiles', {}), indent=2)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("anomaly_scores.csv", buf.getvalue())
        zf.writestr("anomaly_profiles.json", profiles_json)
    zip_buffer.seek(0)

    safe_model = re.sub(r'[^a-z0-9]+', '_', selected['detector'].lower()).strip('_')
    filename = f"SmartML-anomalies-{safe_model}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Status ───────────────────────────────────────────────────────────────────

@app.get("/api/status/{job_id}")
def get_status(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

# Watchdog: a worker that dies mid-processing (e.g. OOM on a constrained
    # host) leaves the job stuck at "running" forever. If nothing has updated it
    # in a while, mark it failed so clients stop polling a zombie.
    if job['status'] in ('running', 'queued') and job.get('updated_at'):
        try:
            last = datetime.fromisoformat(job['updated_at'])
            age_minutes = (datetime.now() - last).total_seconds() / 60
            if age_minutes > 5:
                update_job(job_id, status='failed', error='Worker stopped responding (likely out of memory on the host). Please retry.')
                job = get_job(job_id)
        except (ValueError, TypeError):
            pass

    is_cluster = bool(job.get('cluster_results'))
    is_anomaly = bool(job.get('anomaly_results'))

    response = {
        "job_id": job_id,
        "status": job['status'],
        "filename": job['original_filename'],
        "target_column": job['target_column'],
        "problem_type": job['problem_type'],
        "task_type": "anomaly" if is_anomaly else ("cluster" if is_cluster else "train"),
        "created_at": job['created_at'],
        "updated_at": job['updated_at']
    }
    for field in ('progress', 'logs'):
        if job.get(field):
            try:
                response[field] = json.loads(job[field])
            except Exception:
                response[field] = None if field == 'progress' else []

    if job['status'] == 'running':
        response['message'] = "Processing models..." if not (is_cluster or is_anomaly) else ("Clustering data..." if is_cluster else "Scanning for anomalies...")
    elif job['status'] == 'completed':
        response['message'] = "Processing completed" if not (is_cluster or is_anomaly) else ("Clustering completed" if is_cluster else "Anomaly scan completed")
    elif job['status'] == 'failed':
        response['message'] = job['error']

    # Include partial results count if available
    if job.get('results'):
        try:
            results = json.loads(job['results'])
            response['models_completed'] = len(results)
        except Exception:
            pass

    return response


# ─── Results ──────────────────────────────────────────────────────────────────

@app.get("/api/results/{job_id}")
def get_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Training not completed. Current status: {job['status']}")

    inspection = json.loads(job['inspection']) if job['inspection'] else {}
    data_report = json.loads(job['data_report']) if job['data_report'] else {}
    results = json.loads(job['results']) if job['results'] else []
    best_model = None
    target_classes = data_report.get('target_classes') if data_report else None
    num_classes = data_report.get('num_classes') if data_report else None

    if results:
        best = results[0]
        best_model = {
            "name": best['model_name'],
            "metrics": best['metrics'],
            "training_time": best['training_time']
        }

    return {
        "job_id": job_id,
        "filename": job['original_filename'],
        "inspection": inspection,
        "problem_type": data_report.get('problem_type') if data_report else None,
        "target_column": job['target_column'],
        "target_classes": target_classes,
        "num_classes": num_classes,
        "model_selection_strategy": data_report.get('model_selection_strategy') if data_report else None,
        "models_trained": data_report.get('models_trained', []) if data_report else [],
        "best_model": best_model,
        "results": results,
        "total_models": len(results),
        "successful": sum(1 for r in results if r.get('status') == 'completed'),
        "failed": sum(1 for r in results if r.get('status') == 'failed')
    }


# ─── Jobs List ────────────────────────────────────────────────────────────────

@app.get("/api/jobs")
def get_jobs(limit: int = 20, user: dict = Depends(get_current_user)):
    return {"jobs": list_jobs(limit, user_id=user["id"])}


@app.get("/api/jobs/{job_id}")
def get_job_details(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    inspection = json.loads(job['inspection']) if job.get('inspection') else {}
    return {
        "job_id": job_id,
        "filename": job['original_filename'],
        "status": job['status'],
        "target_column": job['target_column'],
        "problem_type": job['problem_type'],
        "inspection": inspection,
    }


# ─── Chat / LLM Agent ─────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    inspection = {}
    if job.get('inspection'):
        try:
            inspection = json.loads(job['inspection'])
        except Exception:
            pass

    # Build results context if training is done
    results_context = None
    if job['status'] == 'completed' and job.get('results'):
        try:
            results = json.loads(job['results'])
            data_report = json.loads(job['data_report']) if job.get('data_report') else {}
            best = results[0] if results else None
            results_context = {
                "status": "completed",
                "problem_type": data_report.get('problem_type'),
                "best_model": {
                    "name": best['model_name'],
                    "metrics": best['metrics'],
                    "training_time": best['training_time']
                } if best else None,
                "total_models": len(results),
                "models": [{"name": r['model_name'], "metrics": r.get('metrics', {})} for r in results[:5]]
            }
        except Exception:
            pass

    history = [{"role": m.role, "content": m.content} for m in (req.history or [])]

    response = chat_with_agent(
        message=req.message,
        inspection=inspection,
        history=history,
        results_context=results_context
    )

    return ChatResponse(
        reply=response.get("reply", "Sorry, I couldn't process that. Please try again."),
        suggested_target=response.get("suggested_target"),
        suggested_problem_type=response.get("suggested_problem_type")
    )


# ─── Export ───────────────────────────────────────────────────────────────────

@app.post("/api/export")
def export_model(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Training must be completed before export.")

    inspection = {}
    if job.get('inspection'):
        try:
            inspection = json.loads(job['inspection'])
        except Exception:
            pass

    data_report = {}
    if job.get('data_report'):
        try:
            data_report = json.loads(job['data_report'])
        except Exception:
            pass

    results = []
    if job.get('results'):
        try:
            results = json.loads(job['results'])
        except Exception:
            pass

    if not results:
        raise HTTPException(status_code=400, detail="No model results found.")

    # Pick model (best or user-specified)
    model_name = req.model_name
    selected_result = None
    if model_name:
        for r in results:
            if r['model_name'] == model_name:
                selected_result = r
                break
        if not selected_result:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found in results.")
    else:
        selected_result = results[0]
        model_name = selected_result['model_name']

    problem_type = data_report.get('problem_type', job.get('problem_type', 'classification'))
    metrics = selected_result.get('metrics', {})

    # Generate files
    artifact_dir = job.get('artifact_path')
    safe_model_name = model_name.replace(' ', '_').lower()
    artifact_path = os.path.join(artifact_dir, 'models', f'{safe_model_name}.joblib') if artifact_dir else None
    if not artifact_path or not os.path.isfile(artifact_path):
        raise HTTPException(status_code=409, detail="The trained model artifact is unavailable. Retrain this job before exporting.")
    inference_code = generate_inference_code(model_name=model_name, problem_type=problem_type, metrics=metrics)
    requirements_txt = generate_requirements()
    readme_md = generate_readme(model_name=model_name, problem_type=problem_type, metrics=metrics)

    # Pack into a ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("inference.py", inference_code)
        zf.writestr("requirements.txt", requirements_txt)
        zf.writestr("README.md", readme_md)
        zf.write(artifact_path, "model.joblib")
    zip_buffer.seek(0)

    # Prefer a friendly filename based on the original uploaded dataset name.
    orig_filename = job.get('original_filename') or job.get('file_path') or model_name
    dataset_base = os.path.splitext(orig_filename)[0]
    # Remove spaces, strip unsafe characters, and use lowercase — ensure no spaces remain
    no_space = dataset_base.replace(' ', '_')
    safe_dataset = re.sub(r'[^A-Za-z0-9_-]', '', no_space).lower()
    # Fallback to sanitized model_name if dataset name becomes empty
    if not safe_dataset:
        safe_dataset = re.sub(r'[^A-Za-z0-9_-]', '', model_name.replace(' ', '_')).lower()
    filename = f"SmartML-{safe_dataset}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Mount Frontend Static Files ──────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles

LEGACY_FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
REACT_DIST_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'code', 'dist'))
FRONTEND_DIR = REACT_DIST_DIR if os.path.isdir(REACT_DIST_DIR) else LEGACY_FRONTEND_DIR
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
