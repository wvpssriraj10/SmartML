# SmartML — Unsupervised Learning Extension: Phased Plan

## Overview
Add two new modes alongside existing **Predict (Supervised)**:
- **🔍 Explore (Clustering)** — K-Means, DBSCAN, Hierarchical + PCA/UMAP 2D viz
- **🚨 Detect (Anomaly Detection)** — Isolation Forest, Local Outlier Factor + scoring

---

## Phase 0: Foundation (1-2 hours)

### 0.1 Mode Selector UI
- **File:** `code/src/routes/index.jsx` (new `mode` state, step 0 before upload)
- **Component:** `ModeSelector.jsx` — 3 cards: Predict / Explore / Detect
- **Routing:** Store `mode` in state, branch workflow:
  - `predict` → existing 7-step flow
  - `explore` → new clustering flow
  - `detect` → new anomaly flow

### 0.2 Shared Types & Constants
- **File:** `code/src/lib/ml-modes.js`
  ```js
  export const ML_MODES = {
    predict: { label: "Predict a target", icon: Target, steps: [...] },
    explore: { label: "Explore patterns / clusters", icon: GitBranch, steps: [...] },
    detect:  { label: "Detect anomalies", icon: AlertTriangle, steps: [...] },
  };
  ```

---

## Phase 1: Backend — Clustering (2-3 days)

### 1.1 ML Engine Extensions
**File:** `ml_engine/clustering.py` (new)
```python
CLUSTERING_REGISTRY = {
    "K-Means":           {"model": KMeans,          "params": {"n_clusters": 8, "random_state": 42, "n_init": 10}},
    "DBSCAN":            {"model": DBSCAN,          "params": {"eps": 0.5, "min_samples": 5}},
    "Agglomerative":     {"model": AgglomerativeClustering, "params": {"n_clusters": 8}},
    "Gaussian Mixture":  {"model": GaussianMixture, "params": {"n_components": 8, "random_state": 42}},
}

DIM_REDUCTION = {
    "PCA":     {"model": PCA,     "params": {"n_components": 2, "random_state": 42}},
    "UMAP":    {"model": UMAP,    "params": {"n_components": 2, "random_state": 42}},  # optional dep
    "t-SNE":   {"model": TSNE,    "params": {"n_components": 2, "random_state": 42}},  # slow, maybe skip
}
```

### 1.2 Trainer
**File:** `ml_engine/cluster_trainer.py` (new)
- `ClusterTrainer.run()` — preprocess → dim reduction → fit multiple clustering algos
- Metrics: Silhouette, Calinski-Harabasz, Davies-Bouldin (no labels needed)
- Returns: cluster labels, 2D embeddings, per-model metrics, cluster profiles

### 1.3 API Endpoints
**File:** `backend/main.py`
```
POST /api/cluster           # start clustering job
GET  /api/cluster/status/{job_id}
GET  /api/cluster/results/{job_id}
POST /api/cluster/export    # ZIP with cluster assignments + viz
```

### 1.4 Database
- New `clustering_jobs` table (or extend `jobs` with `task_type` column)
- Store: embeddings (npy), labels, metrics, cluster summaries

---

## Phase 2: Backend — Anomaly Detection (1-2 days)

### 2.1 ML Engine
**File:** `ml_engine/anomaly.py` (new)
```python
ANOMALY_REGISTRY = {
    "Isolation Forest":  {"model": IsolationForest, "params": {"contamination": 0.05, "random_state": 42, "n_jobs": 1}},
    "Local Outlier Factor": {"model": LocalOutlierFactor, "params": {"contamination": 0.05, "n_jobs": 1}},
    "One-Class SVM":     {"model": OneClassSVM,     "params": {"nu": 0.05, "kernel": "rbf"}},
}
```

### 2.2 Trainer & API
- `AnomalyTrainer.run()` — preprocess → fit detectors → anomaly scores + binary flags
- Endpoints: `/api/anomaly`, `/api/anomaly/status`, `/api/anomaly/results`, `/api/anomaly/export`

---

## Phase 3: Frontend — Explore Flow (2-3 days)

### 3.1 Steps (Clustering)
| Step | Component | Purpose |
|------|-----------|---------|
| 1 | `UploadStep` | Reuse existing |
| 2 | `CleaningStep` | Reuse existing (optional for unsupervised) |
| 3 | `ClusterConfigStep` | Select algos, n_clusters range, dim reduction (PCA/UMAP) |
| 4 | `ClusterTrainStep` | Live polling (reuse TrainingStep UI) |
| 5 | `ClusterResultsStep` | **NEW**: 2D scatter (colored by cluster), silhouette bar, cluster profile cards (size, feature means), cluster naming helper |
| 6 | `ClusterVisualizeStep` | Pairwise feature plots per cluster, parallel coordinates |
| 7 | `ExportStep` | ZIP: cluster_assignments.csv, embeddings.npy, cluster_profiles.json, PNGs |

### 3.2 Key Components (new)
- `code/src/components/smartml/ClusterConfigStep.jsx`
- `code/src/components/smartml/ClusterResultsStep.jsx` (Recharts Scatter + cluster cards)
- `code/src/components/smartml/ClusterVisualizeStep.jsx`

---

## Phase 4: Frontend — Detect Flow (1-2 days)

### 4.1 Steps (Anomaly)
| Step | Component |
|------|-----------|
| 1-2 | Reuse Upload + Cleaning |
| 3 | `AnomalyConfigStep` — contamination %, algo selection |
| 4 | `AnomalyTrainStep` — polling |
| 5 | `AnomalyResultsStep` — **NEW**: anomaly score histogram, flagged rows table, feature contribution (SHAP-like for IF), threshold slider |
| 6 | `AnomalyVisualizeStep` — 2D scatter (normal vs anomaly), parallel coords |
| 7 | Export — anomaly_scores.csv, flagged_rows.csv, PNGs |

---

## Phase 5: Polish & Integration (1 day)

- Mode selector persists choice in localStorage
- Sidebar chat adapts messages per mode
- Shared `ExportStep` base class for all three modes
- Update `routeTree.gen.js` with new routes
- Update documentation

---

## Effort Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 0: Foundation | 0.5 day | — |
| 1: Backend Clustering | 2-3 days | scikit-learn, (optional) umap-learn |
| 2: Backend Anomaly | 1-2 days | scikit-learn |
| 3: Frontend Explore | 2-3 days | Recharts, existing UI components |
| 4: Frontend Detect | 1-2 days | Recharts |
| 5: Polish | 0.5 day | — |
| **Total** | **~7-10 days** | |

---

## Quick Win (Day 1)

If you want something visible fast:
1. Add `ModeSelector` (Phase 0)
2. Implement **K-Means + PCA only** in backend (simplified Phase 1)
3. Build `ClusterResultsStep` with 2D scatter + cluster cards (Phase 3)
4. Skip DBSCAN, Hierarchical, Anomaly for v1

This gives a working "Explore" mode in ~2 days.