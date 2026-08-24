"""
SmartML Dashboard — FastAPI application entry point.

All route logic lives in backend/routers/. This file only wires together
the lifespan, middleware, and sub-routers so it stays easy to read.
"""
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Bootstrap ─────────────────────────────────────────────────────────────────

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from .database import init_db  # noqa: E402 — must come after sys.path insert
from .routers import auth, upload, datasets, training, unsupervised, chat_export  # noqa: E402

UPLOAD_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    yield


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(title="SmartML Dashboard API", version="2.1.0", lifespan=lifespan)

# CORS — restrict to the configured frontend origin in production.
# Falls back to wildcard with credentials disabled when no env var is set.
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins if _allowed_origins else ["*"],
    allow_credentials=bool(_allowed_origins),   # only send cookies to known origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(unsupervised.router)
app.include_router(chat_export.router)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SmartML Dashboard", "version": "2.1.0"}


# ── Static frontend ───────────────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles  # noqa: E402

_LEGACY = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
_REACT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "code", "dist"))
_FRONTEND_DIR = _REACT if os.path.isdir(_REACT) else _LEGACY
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")


# ── Dev entry-point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
