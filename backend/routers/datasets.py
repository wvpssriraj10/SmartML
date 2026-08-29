"""Datasets router — /api/datasets/*"""
import os
import json
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from ..database import (
    get_dataset, list_datasets, update_dataset, delete_dataset,
)
from ..dependencies import get_current_user
from ..schemas import CleaningActionRequest
from ml_engine.preprocessing import DatasetInspector
from ml_engine.cleaning import apply_cleaning_action, calculate_dataset_metrics
from ml_engine.ai_insights import generate_executive_insights, generate_pdf_report

UPLOAD_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'uploads')
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _load_ds(dataset_id: str, user_id: str):
    ds = get_dataset(dataset_id, user_id=user_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


# ── List / Get / Delete ──────────────────────────────────────────────────────

@router.get("")
def get_datasets_list(limit: int = 50, user: dict = Depends(get_current_user)):
    datasets = list_datasets(limit, user_id=user["id"])
    for ds in datasets:
        for field in ("cleaning_pipeline", "inspection_data"):
            if ds.get(field):
                try:
                    ds[field] = json.loads(ds[field])
                except Exception:
                    ds[field] = [] if field == "cleaning_pipeline" else {}
    return {"datasets": datasets}


@router.get("/{dataset_id}")
def get_dataset_by_id(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    if ds.get("cleaning_pipeline"):
        try:
            ds["cleaning_pipeline"] = json.loads(ds["cleaning_pipeline"])
        except Exception:
            ds["cleaning_pipeline"] = []

    file_to_load = ds.get("cleaned_file_path") or ds.get("file_path")
    if file_to_load and os.path.exists(file_to_load):
        try:
            inspector = DatasetInspector(file_to_load)
            inspector.load()
            metrics = calculate_dataset_metrics(inspector.df)
            ds["metrics"] = metrics
            ds["columns"] = list(inspector.df.columns)
        except Exception:
            pass
    return ds


@router.delete("/{dataset_id}")
def remove_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    for file in os.listdir(UPLOAD_DIR):
        if file.startswith(dataset_id):
            try:
                os.remove(os.path.join(UPLOAD_DIR, file))
            except Exception:
                pass
    delete_dataset(dataset_id, user_id=user["id"])
    return {"message": "Dataset deleted successfully", "id": dataset_id}


# ── Preview ──────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: str,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    user: dict = Depends(get_current_user),
):
    ds = _load_ds(dataset_id, user["id"])
    file_path = ds.get("cleaned_file_path") or ds.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    df = inspector.df

    if search:
        mask = (
            df.astype(str)
            .apply(lambda row: row.str.contains(search, case=False, na=False))
            .any(axis=1)
        )
        df = df[mask]

    total_rows = len(df)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    page = max(1, min(page, total_pages))
    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_rows)

    from ml_engine.trainer import convert
    records = convert(df.iloc[start_idx:end_idx].fillna("").to_dict("records"))

    return {
        "dataset_id": dataset_id,
        "name": ds["name"],
        "columns": list(df.columns),
        "rows": records,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "start_row": start_idx + 1 if total_rows > 0 else 0,
        "end_row": end_idx,
    }


# ── Cleaning ─────────────────────────────────────────────────────────────────

@router.post("/{dataset_id}/cleaning/actions")
def apply_cleaning_step(
    dataset_id: str,
    req: CleaningActionRequest,
    user: dict = Depends(get_current_user),
):
    ds = _load_ds(dataset_id, user["id"])
    if ds["status"] == "finalized":
        raise HTTPException(
            status_code=400,
            detail="Dataset is finalized and locked against further edits.",
        )
    source_path = ds.get("cleaned_file_path") or ds.get("file_path")
    if not source_path or not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Source file not found")

    inspector = DatasetInspector(source_path)
    inspector.load()
    cleaned_df, step_desc = apply_cleaning_action(
        df=inspector.df,
        action=req.action,
        column=req.column,
        strategy=req.strategy,
        value=req.value,
        replace_with=req.replace_with,
    )

    pipeline = (
        json.loads(ds.get("cleaning_pipeline", "[]"))
        if ds.get("cleaning_pipeline")
        else []
    )
    
    step_index = len(pipeline) + 1
    cleaned_file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned_{step_index}.csv")
    cleaned_df.to_csv(cleaned_file_path, index=False)

    new_step = {
        "step_id": f"step_{step_index}",
        "action": req.action,
        "column": req.column,
        "strategy": req.strategy,
        "description": step_desc,
        "timestamp": datetime.now().isoformat(),
    }
    pipeline.append(new_step)
    metrics = calculate_dataset_metrics(cleaned_df)

    update_dataset(
        dataset_id,
        cleaned_file_path=cleaned_file_path,
        row_count=metrics["rows"],
        col_count=metrics["cols"],
        cleaning_pipeline=json.dumps(pipeline),
        inspection_data=json.dumps(metrics),
    )
    return {
        "dataset_id": dataset_id,
        "step": new_step,
        "pipeline": pipeline,
        "metrics": metrics,
        "columns": list(cleaned_df.columns),
        "message": f"Applied cleaning action: {step_desc}",
    }


@router.post("/{dataset_id}/cleaning/undo")
def undo_cleaning_step(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    if ds["status"] == "finalized":
        raise HTTPException(status_code=400, detail="Dataset is finalized and locked.")

    pipeline = (
        json.loads(ds.get("cleaning_pipeline", "[]"))
        if ds.get("cleaning_pipeline")
        else []
    )
    if not pipeline:
        raise HTTPException(status_code=400, detail="No cleaning steps to undo.")

    pipeline.pop()
    
    undone_step_index = len(pipeline) + 1
    undone_file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned_{undone_step_index}.csv")
    if os.path.exists(undone_file_path):
        os.remove(undone_file_path)
        
    old_cleaned_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned.csv")
    if os.path.exists(old_cleaned_path):
        os.remove(old_cleaned_path)

    if pipeline:
        step_index = len(pipeline)
        cleaned_file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_cleaned_{step_index}.csv")
        if not os.path.exists(cleaned_file_path):
            inspector = DatasetInspector(ds["file_path"])
            inspector.load()
            df = inspector.df
            for step in pipeline:
                df, _ = apply_cleaning_action(
                    df=df,
                    action=step.get("action"),
                    column=step.get("column"),
                    strategy=step.get("strategy"),
                    value=step.get("value"),
                    replace_with=step.get("replace_with"),
                )
            df.to_csv(cleaned_file_path, index=False)
        else:
            inspector = DatasetInspector(cleaned_file_path)
            inspector.load()
            df = inspector.df
    else:
        cleaned_file_path = None
        inspector = DatasetInspector(ds["file_path"])
        inspector.load()
        df = inspector.df

    metrics = calculate_dataset_metrics(df)
    update_dataset(
        dataset_id,
        cleaned_file_path=cleaned_file_path,
        row_count=metrics["rows"],
        col_count=metrics["cols"],
        cleaning_pipeline=json.dumps(pipeline),
        inspection_data=json.dumps(metrics),
    )
    return {
        "dataset_id": dataset_id,
        "pipeline": pipeline,
        "metrics": metrics,
        "columns": list(df.columns),
        "message": "Undid last cleaning step successfully",
    }


@router.post("/{dataset_id}/finalize")
def finalize_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    update_dataset(dataset_id, status="finalized")
    return {
        "dataset_id": dataset_id,
        "status": "finalized",
        "message": f"Dataset '{ds['name']}' has been finalized and locked.",
    }


# ── Download ─────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/download")
def download_cleaned_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    file_path = ds.get("cleaned_file_path") or ds.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    filename = f"{ds['name'].replace(' ', '_').lower()}_cleaned.csv"

    # Use a generator to guarantee the file handle is closed after streaming.
    def _iter_file(path: str):
        with open(path, "rb") as fh:
            yield from fh

    return StreamingResponse(
        _iter_file(file_path),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── AI Insights / PDF ─────────────────────────────────────────────────────────

@router.get("/{dataset_id}/ai-insights")
def get_dataset_ai_insights(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    file_path = ds.get("cleaned_file_path") or ds.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    insights = generate_executive_insights(df=inspector.df, dataset_name=ds["name"])
    return {"dataset_id": dataset_id, "name": ds["name"], "insights": insights}


@router.get("/{dataset_id}/pdf-report")
def download_dataset_pdf_report(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = _load_ds(dataset_id, user["id"])
    file_path = ds.get("cleaned_file_path") or ds.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    inspector = DatasetInspector(file_path)
    inspector.load()
    insights = generate_executive_insights(df=inspector.df, dataset_name=ds["name"])
    pdf_bytes = generate_pdf_report(dataset_name=ds["name"], insights=insights)

    safe_name = ds["name"].replace(" ", "_").lower()
    filename = f"AI_Insights_Report_{safe_name}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
