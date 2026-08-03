# SmartML — End-to-End AutoML Dashboard

SmartML takes a raw CSV/Excel/JSON file and turns it into a trained, benchmarked machine learning model — no code required. Upload a dataset, clean it in a visual studio, explore it, and let the engine train and rank 10+ models automatically, complete with AI-generated insights and a downloadable inference bundle.

Built as a full-stack, persistent-dataset application (not a single-session demo) — you can leave mid-workflow and resume later.

## Features

- **Upload & Dataset Library** — CSV/Excel/JSON ingestion with per-dataset status tracking (in-progress vs. finalized), stored and resumable across sessions
- **Data Cleaning Studio** — column-level cleaning pipeline: missing value handling, outlier capping, duplicate removal, categorical encoding, with full undo history
- **Visualization** — bivariate chart builder (bar, line, scatter, histogram, pie, heatmap) rendered with Recharts
- **AutoML Training** — trains and ranks up to 11 models per problem type (Logistic/Ridge Regression, Decision Tree, Random Forest, Gradient Boosting, XGBoost, LightGBM, SVM, KNN, Neural Net, Naive Bayes) with a "smart" model-priority selector based on dataset size
- **AI Insights** — LLM-generated dataset narrative, executive summary, business risk scoring, and anomaly detection table (Gemini / OpenRouter, with a rule-based fallback when no API key is set)
- **PDF Reporting** — one-click export of the AI insights as a shareable PDF report (ReportLab)
- **Conversational Assistant** — in-app chat agent that explains the dataset, suggests a target column and problem type, and answers questions about model results
- **Deployable Export** — download a standalone inference script + trained model artifact + requirements.txt for the winning model

## Tech Stack

**Frontend** — React 19, TanStack Router/Start, Vite, Tailwind CSS 4, Radix UI / shadcn primitives, Recharts, React Hook Form + Zod

**Backend** — FastAPI, Uvicorn, SQLite (via a lightweight database layer), Pydantic

**ML / Data** — scikit-learn, XGBoost, LightGBM, pandas, NumPy, joblib

**AI Layer** — Google Gemini API / OpenRouter for insights and chat

**Reporting** — ReportLab (PDF generation)

## Architecture

```
├── code/          # React frontend (TanStack Start) — routes: upload, preview,
│                  #   cleaning, visualization, feature-analysis, ai-insights, predictions
├── backend/       # FastAPI app — dataset CRUD, cleaning actions, training jobs,
│                  #   chat endpoint, PDF/export endpoints
├── ml_engine/     # Model registry, preprocessing, training, metrics, AI insights generation
└── requirements.txt
```

Datasets are persistent objects (`dataset_id`), not transient session state — cleaning steps, training jobs, and results are stored and can be revisited.

## API Overview

| Endpoint | Purpose |
|---|---|
| `POST /api/upload` | Upload a dataset |
| `GET /api/datasets` / `GET /api/datasets/{id}` | List / inspect datasets |
| `GET /api/datasets/{id}/preview` | Paginated row browser |
| `POST /api/datasets/{id}/cleaning/actions` | Apply a cleaning step |
| `POST /api/datasets/{id}/cleaning/undo` | Undo last cleaning step |
| `POST /api/datasets/{id}/finalize` | Lock a cleaned dataset |
| `GET /api/datasets/{id}/ai-insights` | Generate AI insights |
| `GET /api/datasets/{id}/pdf-report` | Export insights as PDF |
| `POST /api/train` | Kick off AutoML training job |
| `GET /api/status/{job_id}` / `GET /api/results/{job_id}` | Track / fetch training results |
| `POST /api/chat` | Query the AI assistant |
| `POST /api/export` | Export deployable inference bundle |

## Getting Started

**Prerequisites:** Node 18+, Python 3.10+

```bash
# 1. Clone the repo
git clone https://github.com/wvpssriraj10/SmartML.git
cd SmartML

# 2. Backend setup
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # add your GEMINI_API_KEY / OPENROUTER_API_KEY (optional — falls back to rule-based responses)
python -m backend.main

# 3. Frontend setup (separate terminal)
cd code
npm install
npm run dev
```

Backend runs on FastAPI's default port; frontend runs via Vite dev server. Check `.env.example` for required/optional environment variables.

## License

MIT — see [LICENSE](LICENSE).
