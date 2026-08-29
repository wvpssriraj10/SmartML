# SmartML — Progress Notes

Simple English notes so anyone (not just me) can follow where we are and why.

## What this project is

SmartML is a web app where you upload a dataset and it trains machine
learning models for you automatically, then lets you download the trained
model. It runs on Render's free hosting plan, which is limited (512 MB RAM).

## Current status: all three modes built

The app has three full workflows you pick on the first screen:

- **Predict (supervised)** — upload data → clean → train → results → export.
- **Explore (clustering)** — groups similar rows together on its own, no
  target column needed. Good for finding patterns.
- **Detect (anomalies)** — finds unusual rows that look out of place
  (e.g. fraud, errors, weird entries).

Backends (Phases 1 & 2) and frontends (Phases 3 & 4) for all three modes are
done, and the polish phase (Phase 5) is complete.

## Date & progress log

| Date | What happened |
|------|---------------|
| (today) | **Phase 0 done (UI foundation).** Added a mode-picker screen with 3 cards: **Predict**, **Explore**, **Detect**. `Predict` continues the existing 7-step workflow exactly as before. The chosen mode is remembered in the browser. |
| (today) | **Phase 1 done (backend clustering).** The server can group your data: pick an algorithm (K-Means, PCA, Agglomerative, Gaussian Mixture) and a cluster count, and it runs in the background. Returns cluster labels, a 2D PCA view, quality scores (silhouette etc.), and per-cluster summaries. Downloadable ZIP with assignment CSV + profile JSON. Memory is safe on Render's free tier via row caps + sampling. |
| (today) | **Phase 2 done (backend anomaly detection).** The server can scan your data with Isolation Forest, Local Outlier Factor, or One-Class SVM. Returns a 0–1 anomaly score per row, 1/0 flags, typical-vs-unusual profiles, and 2D plot points. Downloadable ZIP with `anomaly_scores.csv` + `anomaly_profiles.json`. Same row-cap/sampling safety. |
| (today) | **Phase 3 done (frontend Explore).** Full clustering UI in the browser: `ClusterConfigStep` (algorithm picker with plain-language analogies + group count), `ClusterTrainStep` (live progress with collapsible technical logs), `ClusterResultsStep` (plain-English verdict, scatter map, group sizes, per-group profiles), `ClusterVisualizeStep` (compare view with parallel coordinates + auto-generated group names), `ClusterExportStep` (download). Chat narrates progress like training does. |
| (today) | **Phase 4 done (frontend Detect).** Full anomaly UI in the browser: `AnomalyConfigStep` (detector picker with plain-language analogies + sensitivity slider), `AnomalyTrainStep` (live progress), `AnomalyResultsStep` (plain-English verdict, score histogram, flagged rows table, typical-vs-unusual profiles), `AnomalyVisualizeStep` (2D map of rows with flagged vs normal and score-heat views), `AnomalyExportStep` (download). Verified end-to-end against the live backend. |
| (today) | **Phase 5 done (polish).** Chosen mode now persists in the browser on every change. The chat's suggested-question chips adapt to the active mode (predict / explore / detect). Removed dead "placeholder route" config now that all three modes are real. |
| (today) | **Clustering methods updated.** Replaced **DBSCAN** with **PCA** in the clustering method list (K-Means, PCA, Agglomerative, Gaussian Mixture). PCA alone can't assign groups, so it's implemented as PCA + K-Means: compress the data to its 2 most important dimensions, then group the points there. Updated the backend registry, the plain-language explainers, and the running-status stories. |
| (today) | **Light/dark theme toggle added.** New Sun/Moon button in the top bar switches between the dark and light palettes. Choice is saved in the browser and applied on load (no flash). Backgrounds, glass panels, grid lines, scrollbar, and borders are now theme-aware variables, and text uses high-contrast tokens in both themes so nothing blends together. |
| (today) | **Improvement round done (tests + auth + cancellation/stall UX + CSS split).** Added a real pytest suite (120 tests) covering the database layer, login/register, preprocessing, cleaning, model training, metrics, exporters, and trainers. Added per-user accounts: register/login with a token, and each user's uploaded datasets are stored and isolated separately. Added the ability to **cancel** a running training job, **retry** a failed job, a stall detector that notices when the server stops responding, and a hard timeout on status polls. Fixed a slow status poll (the server was sending the whole inspection blob every 2 seconds over a fresh remote DB connection — now it sends a small lightweight status row). Split the giant `styles.css` into theme tokens, base styles, keyframes, and utilities. |
| (today) | **CI is green.** GitHub Actions CI (`.github/workflows/ci.yml`) now actually works: it installs pytest, runs only the unit tests in `tests/` (the old root-level `test_api.py` integration script needed a live server, so it's excluded), and tells pytest to look at the repo root so `backend` and `ml_engine` import correctly. All three CI jobs pass: frontend build + python tests on Python 3.10 and 3.11. |
| (today) | **Crumple & Toss satisfying delete.** Deleting a dataset in the library no longer pops a plain confirm box. Clicking the trash icon now: glows the row red/pink and scales it 1.02x → crumples it into a little paper ball (300ms) → tosses it in a parabola (translate + rotate, with a `sin`-based hop) into a small trash bin bottom-right → the bin squashes and puffs 2-3 dust particles → the storage meter/row fades out. A small **UNDO** toast appears for 3 seconds; clicking it restores the row. The real DELETE API call is delayed until the toast window closes, so undo is fully functional. All motion uses GPU-friendly transforms and `cubic-bezier(0.22, 1, 0.36, 1)` easing. |

### Design decisions

- **No shared ExportStep base class.** The Predict export generates charts and artifacts in the browser and is rich and bespoke; the Explore/Detect exports just download a backend-built ZIP. Forcing a common base would add abstraction without real reuse, so each stays simple and purpose-built.
- **No new routes needed.** All three modes live as steps inside the single `/` route, so `routeTree.gen.js` needs no regeneration.

## What changed (files)

| File | Why |
|------|-----|
| `notes.md` (this file) | Plain-English progress log — keep it updated as we go. |
| `code/src/lib/ml-modes.js` | One shared place defining the 3 modes: label, tagline, description, icon, accent color, and the list of workflow steps each mode uses. |
| `code/src/components/smartml/ModeSelector.jsx` | The 3 clickable cards on the first screen. |
| `code/src/routes/index.jsx` | Main app wiring: mode picker, per-mode step routing, cluster + anomaly handlers, polling, download, chat integration. |
| `ml_engine/clustering.py` | The algorithm "menu": definitions (params + RAM row-caps) for K-Means, PCA, Agglomerative, Gaussian Mixture, plus feature preprocessing. |
| `ml_engine/cluster_trainer.py` | Clustering worker brain: caps rows, runs each algorithm, scores separation, builds 2D points + per-cluster summaries. |
| `ml_engine/anomaly.py` | Anomaly detector "menu": Isolation Forest, Local Outlier Factor, One-Class SVM, plus matrix building and a shared `fit_detector` that normalizes scores to 0–1. |
| `ml_engine/anomaly_trainer.py` | Anomaly worker brain: runs each detector, builds typical-vs-unusual profiles and 2D plot points, summarizes flagged counts. |
| `ml_engine/cluster_trainer.py` | Also got a PCA fix so single-column/all-text datasets (like the Olist orders CSV) no longer crash. |
| `backend/database.py` | Added `cluster_results` and `anomaly_results` columns to the jobs table (auto-migrations) so output can be saved/fetched. |
| `backend/worker.py` | Background "clustering worker" + "anomaly worker" threads, mirroring model training. |
| `backend/main.py` | New endpoints: `/api/cluster/meta`, `/api/cluster`, `/api/cluster/results/{job_id}`, `/api/cluster/export`, `/api/anomaly/meta`, `/api/anomaly`, `/api/anomaly/results/{job_id}`, `/api/anomaly/export`. |
| `backend/schemas.py` | Request shapes for clustering and anomaly jobs. |
| `code/src/lib/cluster-names.js` | Auto-names each cluster from its typical values (e.g. "High spenders"). |
| `code/src/components/smartml/ClusterConfigStep.jsx` | Clustering setup screen with plain-language analogies and a group-count slider. |
| `code/src/components/smartml/ClusterTrainStep.jsx` | Live clustering progress with collapsible technical logs. |
| `code/src/components/smartml/ClusterResultsStep.jsx` | Plain-English verdict, scatter map, group sizes, per-group profiles. |
| `code/src/components/smartml/ClusterVisualizeStep.jsx` | Compare view: parallel coordinates, per-feature highlight bars, auto-generated group names. |
| `code/src/components/smartml/ClusterExportStep.jsx` | Cluster download screen. |
| `code/src/components/smartml/AnomalyConfigStep.jsx` | Anomaly setup screen with detector analogies + sensitivity slider. |
| `code/src/components/smartml/AnomalyTrainStep.jsx` | Live anomaly scan progress. |
| `code/src/components/smartml/AnomalyResultsStep.jsx` | Score histogram, flagged-rows table, typical-vs-unusual profiles, plain-English verdict. |
| `code/src/components/smartml/AnomalyVisualizeStep.jsx` | 2D map of rows: flagged vs normal, plus score-heat view. |
| `code/src/components/smartml/AnomalyExportStep.jsx` | Anomaly download screen. |
| `code/src/components/smartml/ChatFab.jsx` | Floating assistant; suggested-question chips now adapt to the active mode (predict / explore / detect). |
| `code/src/components/smartml/Navbar.jsx` | Top bar; now has the Sun/Moon light-dark theme toggle with browser persistence. |
| `code/src/styles.css` | Theme system: dark palette on `:root`, light palette under `.light`, plus theme-aware glass panels, grid lines, scrollbar, and a smooth color transition. |
| `code/src/styles/tokens.css` | All design tokens (colors, spacing, typography, radii) as CSS variables — the single source of truth for the theme. |
| `code/src/styles/base.css` | Element-level base styles (body, buttons, inputs, glass panels, scrollbar). |
| `code/src/styles/keyframes.css` | All animations (shimmer, pulse, fade, scan) as named keyframes. |
| `code/src/styles/utilities.css` | Reusable utility classes (flex helpers, text styles, badge/dot helpers). `styles.css` now just imports these four files. |
| `tests/` | Full pytest unit suite (120 tests): `test_database.py`, `test_auth.py`, `test_models.py`, `test_trainer.py`, `test_preprocessing.py`, `test_cleaning.py`, `test_metrics.py`, `test_anomaly.py`, `test_clustering.py`, `test_exporter.py`, `test_ai_insights.py`, `test_unsupervised_trainers.py` + `conftest.py` fixtures. |
| `backend/database.py` | Added user accounts (users table), per-user dataset ownership, job cancellation flags, and a lightweight `get_job_status()` that avoids sending huge inspection blobs on every poll. |
| `backend/auth.py` | Login/register endpoints with token signing, plus dependency for protected routes. |
| `backend/main.py` | Auth-protected upload; new `/api/auth/register`, `/api/auth/login`; cancel endpoint; status endpoint now uses the lightweight status query. |
| `backend/worker.py` | Cancellation support: every worker checks a cancel flag between steps and stops cleanly. |
| `pytest.ini` | Tells pytest to run only `tests/` and to add the repo root to the import path so `backend` and `ml_engine` resolve. |
| `.github/workflows/ci.yml` | GitHub Actions CI: builds the frontend, installs pytest + requirements, runs the unit tests on Python 3.10 and 3.11. |
| `code/src/lib/crumple-delete.js` | The "Crumple & Toss" physics helper: `playCrumpleToss` (select → crumple → arc toss → land), `lerp`, and dust-particle spawning. |
| `code/src/components/smartml/UploadLibraryStep.jsx` | Dataset library delete now uses the satisfying animation + delayed commit + 3-second UNDO toast (portal overlay with bin/ball/toast). |
| `code/src/styles/base.css` + `keyframes.css` | Added the delete-animation classes (`.dl-selecting`, `.dl-gone`, `.dl-ball`, `.dl-bin`, `.dl-particle`, `.dl-toast`) and keyframes (`dl-crumple`, `dl-bin-squash`, `dl-poof`). |

### Why this way

- All three modes share the same job/queue/polling machinery, so the UX is consistent.
- Every screen uses plain-language copy + analogies so non-technical users can follow what the model did.
- Row caps + automatic sampling keep everything safe on Render's free 512 MB plan.

### Next up
All phases from the plan (0–5) are complete, the improvement round is done, and CI is green. Any future work is open-ended: e.g. UMAP/t-SNE options, threshold sliders, deeper per-mode chat guidance, or code-splitting the frontend bundle (currently ~1.35 MB).