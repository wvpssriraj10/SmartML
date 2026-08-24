"""Upload router — /api/upload, /api/upload/presign, /api/upload/complete"""
import os
import uuid
import json

import boto3
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends

from ..database import create_job, update_job, create_dataset
from ..dependencies import get_current_user
from ..schemas import UploadResponse
from ml_engine.trainer import convert
from ml_engine.preprocessing import DatasetInspector
from ml_engine.cleaning import calculate_dataset_metrics

UPLOAD_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'uploads')
)

# 100 MB hard cap – protects the free-tier server from OOM on huge files.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls', '.json'}

router = APIRouter(tags=["upload"])


# ── Supabase S3 client (lazy singleton) ──────────────────────────────────────

_supabase = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not (url and key):
            return None
        endpoint = url.rstrip("/") + "/storage/v1/s3"
        _supabase = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key,
            aws_secret_access_key=key,
            region_name="auto",
        )
    return _supabase


# ── Shared helper ─────────────────────────────────────────────────────────────

def _inspect_and_register(file_path: str, filename: str, user_id: str) -> dict:
    """Parse the uploaded file, build inspection data, create DB records, and return
    the UploadResponse payload dict."""
    try:
        inspector = DatasetInspector(file_path)
        inspector.load()
        inspection = inspector.inspect()
        sample = inspector.df.head(min(1000, len(inspector.df))).to_dict("records")
        inspection["sample"] = convert(sample)
        target_candidates = inspector.suggest_target()
    except Exception as e:
        # Clean up the file so orphaned uploads don't accumulate.
        try:
            os.remove(file_path)
        except OSError:
            pass
        raise HTTPException(status_code=422, detail=f"Failed to parse dataset: {e}")

    preferred = ("target", "label", "class", "output", "result", "outcome",
                 "price", "salary", "churn")
    suggested = next(
        (item["column"] for name in preferred
         for item in target_candidates if name in item["column"].lower()),
        None,
    )
    if not suggested and target_candidates:
        suggested = target_candidates[-1]["column"]
    if suggested:
        unique_count = (
            inspection.get("column_stats", {}).get(suggested, {}).get("unique_count", 0)
        )
        inspection["suggested_target"] = suggested
        inspection["suggested_problem_type"] = (
            "classification"
            if suggested in inspection.get("categorical_columns", []) or unique_count <= 20
            else "regression"
        )
        inspection.setdefault("kpis", {})["suggested_target"] = suggested

    job_id = str(uuid.uuid4())
    create_job(job_id, file_path, filename, user_id=user_id)
    update_job(job_id, inspection=json.dumps(convert(inspection), indent=2))

    metrics = calculate_dataset_metrics(inspector.df)
    create_dataset(
        dataset_id=job_id,
        name=filename.split(".")[0].replace("_", " ").title(),
        filename=filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        file_type=os.path.splitext(filename)[1].lstrip("."),
        row_count=inspection["rows"],
        col_count=inspection["columns"],
        inspection_data=metrics,
        user_id=user_id,
    )

    return {
        "job_id": job_id,
        "filename": filename,
        "inspection": inspection,
        "message": (
            f"Dataset '{filename}' uploaded. "
            f"Rows: {inspection['rows']}, Columns: {inspection['columns']}"
        ),
    }


# ── Direct upload ─────────────────────────────────────────────────────────────

@router.post("/api/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {ext}. Use CSV, Excel, or JSON.",
        )

    # Read with a size cap — avoids reading a 1 GB file fully into memory.
    chunk = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(chunk) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File exceeds the {MAX_UPLOAD_BYTES // 1024 // 1024} MB upload limit. "
                "Use a smaller dataset or the Supabase direct-upload flow."
            ),
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Write synchronously — the file is already in memory (≤100 MB).
    with open(file_path, "wb") as fh:
        fh.write(chunk)

    payload = _inspect_and_register(file_path, file.filename, user["id"])
    return UploadResponse(**payload)


# ── Supabase presign ──────────────────────────────────────────────────────────

@router.post("/api/upload/presign")
def presign_upload(filename: str = Form(...), content_type: str = Form(...)):
    s3 = _get_supabase()
    if not s3:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")
    bucket = os.getenv("SUPABASE_BUCKET", "uploads")
    key = f"uploads/{uuid.uuid4()}{ext}"
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return {"url": url, "key": key, "bucket": bucket}


# ── Supabase complete ─────────────────────────────────────────────────────────

@router.post("/api/upload/complete", response_model=UploadResponse)
async def complete_supabase_upload(
    key: str = Form(...),
    filename: str = Form(...),
    bucket: str = Form(None),
    user: dict = Depends(get_current_user),
):
    s3 = _get_supabase()
    if not s3:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    bucket = bucket or os.getenv("SUPABASE_BUCKET", "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    try:
        s3.download_file(bucket, key, file_path)
    except Exception as e:
        raise HTTPException(
            status_code=422, detail=f"Failed to download from Supabase: {e}"
        )

    payload = _inspect_and_register(file_path, filename, user["id"])
    return UploadResponse(**payload)
