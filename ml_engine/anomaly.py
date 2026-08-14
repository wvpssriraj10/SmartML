import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import OneClassSVM
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder

# ── Free-tier memory guardrails ───────────────────────────────────────────────
# Anomaly detection also builds O(n^2)-ish structures in places (LOF kNN graph),
# so keep the same strict caps as clustering.
MAX_ANOMALY_ROWS = 10000          # hard ceiling for any detection run
SCORE_SAMPLE = 1000               # for per-point histogram we keep all scores (capped rows)

ANOMALY_REGISTRY = {
    "Isolation Forest": {
        "model": IsolationForest,
        "params": {"contamination": 0.05, "random_state": 42, "n_jobs": 1},
        "max_rows": 10000,
        "description": "Flags rows that are easiest to separate from the rest. Fast and robust.",
    },
    "Local Outlier Factor": {
        "model": LocalOutlierFactor,
        "params": {"contamination": 0.05, "n_jobs": 1},
        "max_rows": 5000,
        "description": "Compares each row's density with its neighbors; points in sparse areas stand out.",
    },
    "One-Class SVM": {
        "model": OneClassSVM,
        "params": {"nu": 0.05, "kernel": "rbf"},
        "max_rows": 4000,
        "description": "Learns the boundary of the 'normal' region and flags rows outside it.",
    },
}


def _metadata():
    return {
        "detectors": {
            name: {
                "description": info["description"],
                "max_rows": info["max_rows"],
                "params": {**info["params"]},
            }
            for name, info in ANOMALY_REGISTRY.items()
        },
        "dim_reduction": {
            "PCA": {"description": "Projects to 2D while keeping maximum variance (RAM-safe on the free tier)."}
        },
        "max_rows": MAX_ANOMALY_ROWS,
        "default_contamination": 0.05,
        "note": "Row caps are free-tier memory guardrails; larger datasets are automatically subsampled.",
    }


def build_anomaly_matrix(df, columns=None):
    """Turn a DataFrame into a scaled numeric matrix for anomaly detection.

    Mirrors the clustering matrix: numeric columns are median-imputed and
    standard-scaled; low-cardinality categorical columns are label-encoded.
    """
    if columns:
        cols = [c for c in columns if c in df.columns]
    else:
        cols = list(df.columns)

    numeric_cols = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
    cat_candidates = [c for c in cols if not pd.api.types.is_numeric_dtype(df[c])]
    cat_cols = [c for c in cat_candidates if df[c].nunique(dropna=True) <= 20]

    X_list = []
    if numeric_cols:
        imputer = SimpleImputer(strategy="median")
        numeric = imputer.fit_transform(df[numeric_cols])
        scaler = StandardScaler()
        numeric = scaler.fit_transform(numeric)
        X_list.append(pd.DataFrame(numeric, columns=numeric_cols, index=df.index))

    for col in cat_cols:
        values = df[col].astype(str).fillna("missing")
        encoder = LabelEncoder()
        X_list.append(pd.DataFrame(encoder.fit_transform(values), columns=[col], index=df.index))

    if not X_list:
        return None, numeric_cols, cat_cols
    matrix = pd.concat(X_list, axis=1)
    return matrix, numeric_cols, cat_cols


def fit_detector(name, matrix):
    """Fit a single detector; returns scores (higher = more anomalous) and binary labels."""
    import time
    info = ANOMALY_REGISTRY[name]
    params = dict(info["params"])
    start = time.time()
    if name == "Local Outlier Factor":
        model = info["model"](**params)
        labels = model.fit_predict(matrix)
        # LOF negative_outlier_factor_: more negative = more anomalous.
        scores = -model.negative_outlier_factor_
    elif name == "One-Class SVM":
        model = info["model"](**params)
        labels = model.fit_predict(matrix)
        scores = -model.decision_function(matrix)
    else:
        model = info["model"](**params)
        model.fit(matrix)
        # IsolationForest: lower score = more anomalous.
        scores = -model.score_samples(matrix)
        labels = model.predict(matrix)
    elapsed = round(time.time() - start, 3)

    labels = np.asarray(labels)
    scores = np.asarray(scores, dtype=float)

    # Normalize scores to 0..1 for display (1 = most anomalous).
    smin, smax = float(scores.min()), float(scores.max())
    norm = scores.copy()
    if smax > smin:
        norm = (norm - smin) / (smax - smin)
    else:
        norm = np.zeros_like(norm)

    # sklearn returns 1 = inlier, -1 = outlier. Convert to 1 = anomaly, 0 = normal.
    anomaly = (labels == -1).astype(int)
    return model, norm, anomaly, scores, elapsed
