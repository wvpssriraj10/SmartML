"""Chat & Export router — /api/chat, /api/export"""
import io
import json
import os
import re
import zipfile

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from ..database import get_job
from ..dependencies import get_current_user
from ..schemas import ChatRequest, ChatResponse, ExportRequest
from ..llm_agent import chat_with_agent
from ..exporter import generate_inference_code, generate_requirements, generate_readme
from ml_engine.preprocessing import DatasetInspector

router = APIRouter(tags=["chat_export"])


@router.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    inspection = {}
    if job.get("inspection"):
        try:
            inspection = json.loads(job["inspection"])
        except Exception:
            pass

    results_context = None
    if job["status"] == "completed" and job.get("results"):
        try:
            results = json.loads(job["results"])
            data_report = json.loads(job["data_report"]) if job.get("data_report") else {}
            best = results[0] if results else None
            results_context = {
                "status": "completed",
                "problem_type": data_report.get("problem_type"),
                "best_model": {
                    "name": best["model_name"],
                    "metrics": best["metrics"],
                    "training_time": best["training_time"],
                } if best else None,
                "total_models": len(results),
                "models": [{"name": r["model_name"], "metrics": r.get("metrics", {})}
                           for r in results[:5]],
            }
        except Exception:
            pass

    history = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    response = chat_with_agent(
        message=req.message,
        inspection=inspection,
        history=history,
        results_context=results_context,
    )
    return ChatResponse(
        reply=response.get("reply", "Sorry, I couldn't process that."),
        suggested_target=response.get("suggested_target"),
        suggested_problem_type=response.get("suggested_problem_type"),
    )


@router.post("/api/export")
def export_model(req: ExportRequest, user: dict = Depends(get_current_user)):
    job = get_job(req.job_id, user_id=user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Training must be completed before export.")

    data_report = {}
    if job.get("data_report"):
        try:
            data_report = json.loads(job["data_report"])
        except Exception:
            pass

    results = []
    if job.get("results"):
        try:
            results = json.loads(job["results"])
        except Exception:
            pass

    if not results:
        raise HTTPException(status_code=400, detail="No model results found.")

    model_name = req.model_name
    if model_name:
        selected_result = next((r for r in results if r["model_name"] == model_name), None)
        if not selected_result:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found.")
    else:
        selected_result = results[0]
        model_name = selected_result["model_name"]

    problem_type = data_report.get("problem_type", job.get("problem_type", "classification"))
    metrics = selected_result.get("metrics", {})

    artifact_dir = job.get("artifact_path")
    safe_model_name = model_name.replace(" ", "_").lower()
    artifact_path = (
        os.path.join(artifact_dir, "models", f"{safe_model_name}.joblib")
        if artifact_dir else None
    )
    if not artifact_path or not os.path.isfile(artifact_path):
        raise HTTPException(
            status_code=409,
            detail="The trained model artifact is unavailable. Retrain before exporting.",
        )

    inference_code = generate_inference_code(
        model_name=model_name, problem_type=problem_type, metrics=metrics)
    requirements_txt = generate_requirements()
    readme_md = generate_readme(
        model_name=model_name, problem_type=problem_type, metrics=metrics)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("inference.py", inference_code)
        zf.writestr("requirements.txt", requirements_txt)
        zf.writestr("README.md", readme_md)
        zf.write(artifact_path, "model.joblib")
    zip_buffer.seek(0)

    orig_filename = job.get("original_filename") or model_name
    dataset_base = os.path.splitext(orig_filename)[0]
    safe_dataset = re.sub(r"[^A-Za-z0-9_-]", "",
                          dataset_base.replace(" ", "_")).lower() or re.sub(
        r"[^A-Za-z0-9_-]", "", model_name.replace(" ", "_")).lower()
    filename = f"SmartML-{safe_dataset}.zip"

    return StreamingResponse(
        zip_buffer, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"})
