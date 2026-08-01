from pydantic import BaseModel
from typing import Optional, List


class TrainRequest(BaseModel):
    job_id: str
    target_column: str
    problem_type: Optional[str] = None
    model_selection: str = 'smart'
    selected_models: Optional[List[str]] = None


class TrainResponse(BaseModel):
    job_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[dict] = None
    error: Optional[str] = None


class UploadResponse(BaseModel):
    job_id: str
    filename: str
    inspection: dict
    message: str


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    job_id: str
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str
    suggested_target: Optional[str] = None
    suggested_problem_type: Optional[str] = None


class ExportRequest(BaseModel):
    job_id: str
    model_name: Optional[str] = None  # If None, use best model


class CleaningActionRequest(BaseModel):
    action: str  # 'drop_duplicates' | 'handle_missing' | 'handle_outliers' | 'encode' | 'drop_column' | 'replace_values'
    column: Optional[str] = None
    strategy: Optional[str] = None  # e.g. 'mean' | 'median' | 'mode' | 'cap' | 'one_hot' | 'label'
    value: Optional[str] = None
    replace_with: Optional[str] = None


class DatasetResponse(BaseModel):
    id: str
    name: str
    filename: str
    file_size: int
    file_type: str
    status: str  # 'in_progress' | 'finalized'
    row_count: int
    col_count: int
    cleaning_pipeline: List[dict]
    inspection_data: Optional[dict] = None
    created_at: str
    updated_at: str

