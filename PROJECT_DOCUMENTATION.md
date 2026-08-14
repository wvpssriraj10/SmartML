# SmartML Dashboard — Project Documentation

## 1. Project Overview

**SmartML Dashboard** is a free-tier AutoML platform that lets users upload a dataset, clean it, configure training, train multiple models, visualize results, and export a production-ready project bundle — all in a guided 7-step chat-driven workflow.

**Live URLs:**
- Frontend: `https://smartml-three.vercel.app`
- Backend: `https://smartml-backend.onrender.com`
- Repository: `https://github.com/wvpssriraj10/SmartML` (branch: `main`)

---

## 2. System Architecture & Flowchart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMARTML WORKFLOW (7 STEPS)                        │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌────────┐    ┌─────────┐
  │ UPLOAD  │───▶│ CLEANING │───▶│ CONFIGURE │───▶│ TRAIN  │───▶│ RESULTS │
  │ Dataset │    │ Pipeline │    │ Target/   │    │ 4 Models│    │ Leader- │
  │ + Inspect│    │ (Impute, │    │ Problem   │    │ (LR, DT,│    │ board   │
  │         │    │  Encode, │    │ Type      │    │  RF, NB)│    │ + Insight│
  └─────────┘    │  Outlier)│    └───────────┘    └────────┘    └────┬────┘
                 └──────────┘                                          │
                                                                        ▼
  ┌─────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
  │ EXPORT  │◀───│ VISUALIZE  │◀───│  (wait)  │    │         │    │         │
  │ ZIP:    │    │ Charts +   │    │          │    │         │    │         │
  │ code,   │    │ Explorer   │    │          │    │         │    │         │
  │ model,  │    │ (Bar/Line/ │    │          │    │         │    │         │
  │ docs,   │    │  Scatter/  │    │          │    │         │    │         │
  │ charts  │    │  Pie/Hist) │    │          │    │         │    │         │
  └─────────┘    └────────────┘    └──────────┘    └─────────┘    └─────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

  POST /api/upload
       │
       ▼
  DatasetInspector.inspect()  ──▶ schema, stats, suggested target, quality score
       │
       ▼
  POST /api/train (job_id, target, problem_type, model_selection)
       │
       ▼
  Trainer.run()  (background thread)
       │
       ├─▶ Preprocessor.clean()        # applies user's cleaning pipeline
       ├─▶ Preprocessor.preprocess()   # fit imputer/scaler/encoders on TRAIN split only
       ├─▶ get_smart_models()          # picks top 4 models for dataset profile
       ├─▶ train_model() × 4           # each model trained, metrics computed
       ├─▶ _prune_models()             # keeps only best in memory (RAM cap)
       ├─▶ _persist_model_artifact()   # saves .joblib per model
       └─▶ _save_best_artifact()       # saves champion as model.joblib
       │
       ▼
  GET /api/status/{job_id}  ──▶ polls every 2s: progress%, logs, current_model
       │
       ▼
  GET /api/results/{job_id} ──▶ ranked models, metrics, best_model explanation
       │
       ▼
  POST /api/export            ──▶ ZIP: inference.py, requirements.txt, README.md,
                                 model.joblib, metrics.json, 6 PNG charts
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React 18 + TanStack Router | 18.x / 1.x |
| **Build** | Vite | 6.4.3 |
| **Styling** | Tailwind CSS v4 (CSS-first) | 4.x |
| **Charts** | Recharts | 2.x |
| **State** | React hooks (useState, useRef, useEffect) | — |
| **Export** | JSZip + file-saver + html2canvas | latest |
| **Backend** | FastAPI + Uvicorn | 0.115 / 0.30 |
| **ML** | scikit-learn, XGBoost, LightGBM | 1.5 / 2.0 / 4.3 |
| **Serialization** | joblib | 1.4 |
| **Database** | SQLite (local) + Supabase (optional) | — |
| **Deploy** | Vercel (frontend) + Render Free Tier (backend) | — |

---

## 4. Features Implemented

### 4.1 7-Step Guided Workflow
1. **Dataset** — Drag-drop CSV/Excel/JSON → instant inspection (schema, missing %, quality score, suggested target)
2. **Cleaning** — Column-wise actions: missing (mean/median/mode/constant), outliers (cap/remove), encoding (one-hot/label), value replace, drop column; undo/redo pipeline; preview
3. **Configure** — Target column dropdown, problem type (auto/classification/regression), model strategy
4. **Train** — Live polling (2s): circular progress, elapsed timer, model roster (4 models), live logs, stall warning
5. **Results** — Champion hero, leaderboard (bar chart), metric rationale, "why this model won" explainer
6. **Visualize** — 6 chart types, X/Y axis selectors, histogram, pie, quick stats (min/max/avg)
7. **Export** — One-click ZIP: `inference.py`, `requirements.txt`, `README.md`, `model.joblib`, `metrics.json`, **6 PNG charts** (confusion matrix, ROC, feature importance, residuals, residuals histogram, training curves)

### 4.2 Free-Tier Optimizations
- **4-model cap** (Logistic Regression, Decision Tree, Random Forest, Naive Bayes)
- **15k row training limit** (stratified subsample for larger datasets)
- **Memory pruning** — only best model kept in RAM during training
- **Worker watchdog** — marks job failed if no progress for 5 min (catches OOM)
- **Direct upload fallback** — presigned URL 503 → multipart direct to backend

### 4.3 Chat Assistant (Sidebar)
- Context-aware messages at each step
- Explains actions, suggests next moves
- LLM agent endpoint (`/api/chat`) for Q&A (optional)

---

## 5. Problems Faced & Solutions

| # | Problem | Root Cause | Solution |
|---|---------|------------|----------|
| **1** | **"Something went wrong" error screen at ~50% training** | `routeTree.gen.js` was stale (never regenerated since initial commit). `/training` route not registered → TanStack router threw into ErrorComponent. | Regenerated `routeTree.gen.js` with all 10 routes (Index, Upload, Uploads, Cleaning, Preview, Training, AiInsights, Visualization, FeatureAnalysis, Predictions). Added manual route registration to deploy checklist. |
| **2** | **ResultsStep crash: `Cannot read properties of null (reading 'toFixed')`** | Guard checked `!== undefined` but metric was explicitly `null` (failed/partial models). `.toFixed(4)` on `null` crashed render. | Changed guard to `!= null` (catches both `null` and `undefined`) in `ResultsStep.jsx:115` and `TrainingStep.jsx:185`. |
| **3** | **Model roster showing 10+ models instead of 4** | Polling logic dynamically added any model name from backend logs that matched `KNOWN_MODEL` whitelist (13 models). Backend's `get_smart_models` picks different 4 per dataset. | Hard-coded roster to `MODEL_NAMES` (4 models) in both pollers (`index.jsx` and `TrainingStepWithPoll.jsx`). Ignores log entries for other models. |
| **4** | **Backend training OOM / worker death on free tier (512 MB)** | Large datasets + multiple fitted models + artifacts exceeded RAM. | • `MAX_TRAIN_ROWS = 15000` with stratified subsampling<br>• `_prune_models()` keeps only current best in memory<br>• `n_jobs=1`, `nthread=1` on all estimators<br>• 5-min watchdog marks stalled jobs failed |
| **5** | **Export ZIP missing PNG charts** | Backend `/api/export` only bundled code/docs/model. `html2canvas` failed to capture Recharts SVG (off-screen rendering, fixed timeout). | Moved chart generation to **frontend** (`ExportStep`):<br>• Render Recharts in hidden container<br>• Wait for SVG `width/height > 0`<br>• `html2canvas` with `foreignObjectRendering: true`<br>• JSZip merges backend ZIP + generated PNGs + `metrics.json` |
| **6** | **PowerShell `Invoke-WebRequest -Form` not available** (couldn't test live upload) | Windows PowerShell 5.1 lacks `-Form` param. | Used `curl.exe -F` for multipart upload testing. |
| **7** | **New Session button not resetting state** | User on stale cached bundle. | Verified `handleNewSession` clears all state + intervals + chat. Hard-refresh (`Ctrl+Shift+R`) loads new bundle. |
| **8** | **Tailwind v4 `ease-expo` classes generated no CSS** | Utilities were only CSS variables, not `@utility` classes. | Added `@utility ease-expo`, `ease-out-expo`, `ease-spring` in `styles.css`. |

---

## 6. Key Code Locations

| Feature | File |
|---------|------|
| Main workflow (7 steps) | `code/src/routes/index.jsx` |
| Home-wizard training poll | `code/src/routes/index.jsx:262` (`startPollingTraining`) |
| `/training` route poll | `code/src/components/smartml/TrainingStepWithPoll.jsx` |
| Cleaning pipeline UI | `code/src/components/smartml/CleaningStep.jsx` |
| Results + champion insight | `code/src/components/smartml/ResultsStep.jsx` |
| Visualization explorer | `code/src/components/smartml/VisualizationStep.jsx` |
| Export (charts + ZIP) | `code/src/components/smartml/ExportStep.jsx` |
| Backend trainer | `ml_engine/trainer.py` |
| Model registry & smart pick | `ml_engine/models.py` (`get_smart_models`) |
| Backend export endpoint | `backend/main.py` (`/api/export`) |
| Route tree (manual) | `code/src/routeTree.gen.js` |

---

## 7. Deployment Checklist

- [ ] `npm run build` passes locally
- [ ] `routeTree.gen.js` updated if new routes added
- [ ] `git push origin main` → Vercel auto-deploys frontend
- [ ] Render auto-deploys backend from `main`
- [ ] Verify `https://smartml-three.vercel.app` loads new bundle hash
- [ ] Test full flow: upload → clean → configure → train → results → visualize → export
- [ ] Confirm ZIP contains: `inference.py`, `requirements.txt`, `README.md`, `model.joblib`, `metrics.json`, `*.png`

---

## 8. Future Improvements

1. **Model cards** — persist per-model artifacts for comparison download
2. **Hyperparameter UI** — expose key params (n_estimators, max_depth, C) in Configure step
3. **Drift monitoring** — schedule re-evaluation on new data
4. **Team workspaces** — Supabase auth + shared projects
5. **ONNX export** — `inference.py` → ONNX for edge deployment
6. **Better chart data** — fetch actual confusion matrix/ROC from backend instead of synthetic
7. **Code splitting** — lazy-load heavy steps (Visualize, Export) to reduce initial bundle
8. **Unit tests** — Vitest for frontend, pytest for backend/trainer

---

## 9. Credits

Built by **Sriraj** — full-stack AutoML on free tier.
Inspired by plant-sim motion design, TanStack Router patterns, and the constraint that **512 MB teaches you to prune**.