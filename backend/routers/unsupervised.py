"""Clustering & Anomaly router — /api/cluster/*, /api/anomaly/*"""
import io
import json
import os
import re
import zipfile

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from ..database import get_job, update_job
from ..dependencies import get_current_user
from ..schemas import ClusterRequest, AnomalyRequest, ExportRequest
from ..worker import start_clustering, start_anomaly
from ml_engine.preprocessing import DatasetInspector

router = APIRouter(tags=["unsupervised"])


# ── Clustering ────────────────────────────────────────────────────────────────

@router.get("/api/cluster/meta")
def cluster_meta():
    from ml_engine.clustering import _metadata
    return _metadata()


@router.post("/api/cluster")
def cluster_run(req: ClusterRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job["file_path"]):
        raise HTTPException(status_code=404, detail="Dataset file missing")
    if job["status"] == "running":
        raise HTTPException(status_code=400, detail="A job is already running on this dataset")
    if not (2 <= req.n_clusters <= 50):
        raise HTTPException(status_code=400, detail="n_clusters must be between 2 and 50")

    update_job(req.job_id, status="queued", target_column=None,
               cluster_results=None, anomaly_results=None,
               results=None, data_report=None, error=None)
    start_clustering(job_id=req.job_id, file_path=job["file_path"],
                     algorithms=req.algorithms, n_clusters=req.n_clusters,
                     columns=req.columns)
    return {"job_id": req.job_id, "status": "queued",
            "message": "Clustering started. Poll /api/status for updates."}


@router.get("/api/cluster/results/{job_id}")
def get_cluster_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Not completed. Status: {job['status']}")
    if not job.get("cluster_results"):
        raise HTTPException(status_code=409, detail="No clustering results for this job.")

    return {"job_id": job_id, "filename": job["original_filename"],
            "task_type": "cluster", **json.loads(job["cluster_results"])}


@router.post("/api/cluster/export")
def export_cluster_results(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Clustering must be completed before export.")
    if not job.get("cluster_results"):
        raise HTTPException(status_code=409, detail="No clustering results to export.")

    cluster_results = json.loads(job["cluster_results"])
    results_list = cluster_results.get("results", [])
    selected = next((r for r in results_list if r["model"] == req.model_name), None)
    if not selected:
        selected = results_list[0] if results_list else None
    if not selected:
        raise HTTPException(status_code=409, detail="No clustering model results to export.")

    labels = selected.get("cluster_labels", [])
    inspector = DatasetInspector(job["file_path"])
    inspector.load()
    df = inspector.df.head(len(labels)).copy()
    df.insert(0, "cluster", labels)

    buf = io.StringIO()
    df.to_csv(buf, index_label="row_index")
    buf.seek(0)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cluster_assignments.csv", buf.getvalue())
        zf.writestr("cluster_profiles.json",
                    json.dumps(selected.get("profiles", {}), indent=2))
    zip_buffer.seek(0)

    safe_model = re.sub(r"[^a-z0-9]+", "_", selected["model"].lower()).strip("_")
    return StreamingResponse(
        zip_buffer, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=SmartML-clusters-{safe_model}.zip"})


# ── Anomaly ───────────────────────────────────────────────────────────────────

@router.get("/api/anomaly/meta")
def anomaly_meta():
    from ml_engine.anomaly import _metadata
    return _metadata()


@router.post("/api/anomaly")
def anomaly_run(req: AnomalyRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job["file_path"]):
        raise HTTPException(status_code=404, detail="Dataset file missing")
    if job["status"] == "running":
        raise HTTPException(status_code=400, detail="A job is already running on this dataset")
    if not (0.01 <= req.contamination <= 0.5):
        raise HTTPException(status_code=400, detail="contamination must be between 0.01 and 0.5")

    update_job(req.job_id, status="queued", target_column=None,
               cluster_results=None, anomaly_results=None,
               results=None, data_report=None, error=None)
    start_anomaly(job_id=req.job_id, file_path=job["file_path"],
                  detectors=req.detectors, contamination=req.contamination,
                  columns=req.columns)
    return {"job_id": req.job_id, "status": "queued",
            "message": "Anomaly detection started. Poll /api/status for updates."}


@router.get("/api/anomaly/results/{job_id}")
def get_anomaly_results(job_id: str, user: dict = Depends(get_current_user)):
    job = get_job(job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Not completed. Status: {job['status']}")
    if not job.get("anomaly_results"):
        raise HTTPException(status_code=409, detail="No anomaly results for this job.")

    return {"job_id": job_id, "filename": job["original_filename"],
            "task_type": "anomaly", **json.loads(job["anomaly_results"])}


@router.post("/api/anomaly/export")
def export_anomaly_results(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Anomaly detection must be completed before export.")
    if not job.get("anomaly_results"):
        raise HTTPException(status_code=409, detail="No anomaly results to export.")

    anomaly_results = json.loads(job["anomaly_results"])
    results_list = anomaly_results.get("results", [])
    selected = next((r for r in results_list if r["detector"] == req.model_name), None)
    if not selected:
        selected = results_list[0] if results_list else None
    if not selected:
        raise HTTPException(status_code=409, detail="No anomaly detector results to export.")

    labels = selected.get("anomaly_labels", [])
    scores = selected.get("scores", [])
    inspector = DatasetInspector(job["file_path"])
    inspector.load()
    out = inspector.df.head(len(labels)).copy()
    out.insert(0, "is_anomaly", labels)
    out.insert(1, "anomaly_score", scores)

    buf = io.StringIO()
    out.to_csv(buf, index_label="row_index")
    buf.seek(0)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("anomaly_scores.csv", buf.getvalue())
        zf.writestr("anomaly_profiles.json",
                    json.dumps(selected.get("profiles", {}), indent=2))
    zip_buffer.seek(0)

    safe_model = re.sub(r"[^a-z0-9]+", "_", selected["detector"].lower()).strip("_")
    return StreamingResponse(
        zip_buffer, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=SmartML-anomalies-{safe_model}.zip"})
