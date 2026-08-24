"""Training router — /api/train, /api/status, /api/results, /api/jobs"""
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from ..database import (
    get_job, update_job, get_job_status, list_jobs,
    request_cancel, append_job_log,
)
from ..dependencies import get_current_user
from ..schemas import TrainRequest
from ..worker import start_training

router = APIRouter(tags=["training"])


@router.post("/api/train")
def train_model(req: TrainRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] == "running":
        raise HTTPException(status_code=400, detail="Training already in progress")
    if job["status"] == "completed":
        raise HTTPException(status_code=400, detail="Training already completed.")

    inspection = json.loads(job["inspection"]) if job["inspection"] else {}
    column_names = inspection.get("column_names", [])
    if req.target_column not in column_names:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{req.target_column}' not found. Available: {column_names}",
        )

    update_job(
        req.job_id,
        target_column=req.target_column,
        problem_type=req.problem_type,
        model_selection=req.model_selection,
        selected_models=json.dumps(req.selected_models) if req.selected_models else None,
        status="queued",
    )
    start_training(
        job_id=req.job_id,
        file_path=job["file_path"],
        target_column=req.target_column,
        problem_type=req.problem_type,
        model_selection=req.model_selection,
        selected_models=req.selected_models,
    )
    return {"job_id": req.job_id, "status": "queued",
            "message": "Training started. Poll /api/status for updates."}


@router.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] in ("completed", "cancelled", "failed"):
        return {"job_id": job_id, "status": job["status"], "message": "Nothing to cancel."}
    request_cancel(job_id)
    update_job(job_id, status="cancelled", error="Cancelled by user.")
    append_job_log(job_id, "Cancellation requested.", "warning")
    return {"job_id": job_id, "status": "cancelled",
            "message": "Cancellation requested. Worker stops after current step."}


@router.get("/api/status/{job_id}")
def get_status(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job_status(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] in ("running", "queued") and job.get("updated_at"):
        try:
            last = datetime.fromisoformat(job["updated_at"])
            if (datetime.now() - last).total_seconds() / 60 > 5:
                update_job(job_id, status="failed",
                           error="Worker stopped responding. Please retry.")
                job = get_job_status(job_id)
        except (ValueError, TypeError):
            pass

    is_cluster = bool(job.get("cluster_results"))
    is_anomaly = bool(job.get("anomaly_results"))
    response = {
        "job_id": job_id,
        "status": job["status"],
        "filename": job["original_filename"],
        "target_column": job["target_column"],
        "problem_type": job["problem_type"],
        "task_type": "anomaly" if is_anomaly else ("cluster" if is_cluster else "train"),
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
    }
    for field in ("progress", "logs"):
        if job.get(field):
            try:
                response[field] = json.loads(job[field])
            except Exception:
                response[field] = None if field == "progress" else []

    if job["status"] == "running":
        response["message"] = "Clustering..." if is_cluster else ("Anomaly scan..." if is_anomaly else "Processing models...")
    elif job["status"] == "completed":
        response["message"] = "Completed"
    elif job["status"] == "failed":
        response["message"] = job.get("error", "Unknown error")

    if job.get("results"):
        try:
            response["models_completed"] = len(json.loads(job["results"]))
        except Exception:
            pass
    return response


@router.get("/api/results/{job_id}")
def get_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Not completed. Status: {job['status']}")

    data_report = json.loads(job["data_report"]) if job["data_report"] else {}
    results = json.loads(job["results"]) if job["results"] else []
    best_model = None
    if results:
        best = results[0]
        best_model = {"name": best["model_name"], "metrics": best["metrics"],
                      "training_time": best["training_time"]}

    return {
        "job_id": job_id,
        "filename": job["original_filename"],
        "inspection": json.loads(job["inspection"]) if job["inspection"] else {},
        "problem_type": data_report.get("problem_type"),
        "target_column": job["target_column"],
        "target_classes": data_report.get("target_classes"),
        "num_classes": data_report.get("num_classes"),
        "model_selection_strategy": data_report.get("model_selection_strategy"),
        "models_trained": data_report.get("models_trained", []),
        "best_model": best_model,
        "results": results,
        "total_models": len(results),
        "successful": sum(1 for r in results if r.get("status") == "completed"),
        "failed": sum(1 for r in results if r.get("status") == "failed"),
    }


@router.get("/api/jobs")
def get_jobs(limit: int = 20, user: dict = Depends(get_current_user)):
    return {"jobs": list_jobs(limit, user_id=user["id"])}


@router.get("/api/jobs/{job_id}")
def get_job_details(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "filename": job["original_filename"],
        "status": job["status"],
        "target_column": job["target_column"],
        "problem_type": job["problem_type"],
        "inspection": json.loads(job["inspection"]) if job.get("inspection") else {},
    }
