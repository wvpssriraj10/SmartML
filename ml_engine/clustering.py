import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder

# ── Free-tier memory guardrails ───────────────────────────────────────────────
# Clustering algorithms get a *stricter* row cap than supervised training because
# several of them build O(n^2) distance structures. Agglomerative at full
# dataset width will OOM a 512 MB host, so each algorithm declares a cap and the
# trainer honours it by subsampling when it would be exceeded.
MAX_CLUSTER_ROWS = 10000          # hard ceiling for any clustering run
METRIC_SAMPLE = 1000              # silhouette is O(n²): score on a sample

CLUSTERING_REGISTRY = {
    "K-Means": {
        "model": KMeans,
        "params": {"n_clusters": 5, "n_init": 10, "random_state": 42},
        "max_rows": 5000,
        "description": "Partitions points into K groups by minimizing within-cluster distance. Fast and simple.",
    },
    "PCA": {
        "model": None,
        "params": {},
        "max_rows": 5000,
        "description": "Shrinks the data to its two most informative dimensions, then groups the points there (PCA + K-Means). Fast, and great for spotting structure at a glance.",
    },
    "Agglomerative": {
        "model": AgglomerativeClustering,
        "params": {},
        "max_rows": 3000,
        "description": "Builds a tree of merges and cuts it at K clusters; good for nested structure.",
    },
    "Gaussian Mixture": {
        "model": GaussianMixture,
        "params": {"n_components": 5, "random_state": 42},
        "max_rows": 5000,
        "description": "Soft-clusters using a mixture of Gaussians; each point gets membership probabilities.",
    },
}

DIM_REDUCTION = {
    "PCA": {
        "model": PCA,
        "params": {"n_components": 2, "random_state": 42},
        "description": "Projects to 2D while keeping maximum variance (RAM-safe on the free tier).",
    },
}


def _metadata():
    return {
        "algorithms": {
            name: {
                "description": info["description"],
                "max_rows": info["max_rows"],
                "params": {**info["params"]},
            }
            for name, info in CLUSTERING_REGISTRY.items()
        },
        "dim_reduction": {
            name: {"description": info["description"]}
            for name, info in DIM_REDUCTION.items()
        },
        "max_rows": MAX_CLUSTER_ROWS,
        "note": "Row caps are free-tier memory guardrails; larger datasets are automatically subsampled.",
    }


def build_cluster_matrix(df, columns=None):
    """Turn a DataFrame into a scaled numeric matrix suitable for clustering.

    Numeric columns are median-imputed then standard-scaled. Low-cardinality
    categorical columns are label-encoded (or dropped when they are high
    cardinality, e.g. free text).
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

    encoders = {}
    for col in cat_cols:
        values = df[col].astype(str).fillna("missing")
        encoder = LabelEncoder()
        X_list.append(pd.DataFrame(encoder.fit_transform(values), columns=[col], index=df.index))
        encoders[col] = list(encoder.classes_)

    if not X_list:
        return None, {}, numeric_cols, cat_cols, {}

    matrix = pd.concat(X_list, axis=1)
    return matrix, encoders, numeric_cols, cat_cols, {}


def cluster_profiles(df, labels, feature_columns, n_clusters):
    """Per-cluster summaries: size, feature means, top categorical value."""
    labels = np.asarray(labels)
    profiles = {}
    for k in sorted(set(labels.tolist())):
        mask = labels == k
        size = int(mask.sum())
        row = {"cluster": int(k), "size": size, "share": round(size / len(labels), 4),
               "features": {}}
        subset = df[mask]
        for col in feature_columns:
            col_data = subset[col]
            if col_data is None:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                row["features"][col] = round(float(col_data.mean()), 4)
            else:
                row["features"][col] = str(col_data.mode().iloc[0]) if not col_data.mode().empty else "missing"
        profiles[k] = row
    return profiles


def fit_clustering(name, matrix, n_clusters=None):
    """Fit a single clustering algorithm; returns estimator, labels, elapsed."""
    import time
    info = CLUSTERING_REGISTRY[name]
    params = dict(info["params"])
    needs_k = name in ("K-Means", "Agglomerative", "Gaussian Mixture", "PCA")
    if needs_k and n_clusters:
        if name == "Agglomerative":
            params = {"metric": "euclidean", "linkage": "ward"}
        if name == "K-Means":
            params["n_clusters"] = n_clusters
        elif name == "Agglomerative":
            params["n_clusters"] = n_clusters
        elif name == "Gaussian Mixture":
            params["n_components"] = n_clusters

    if name == "PCA":
        # PCA alone does not assign groups; use it as "PCA + K-Means": project
        # the data onto its 2 most informative dimensions, then cluster there.
        n_dim = min(2, matrix.shape[1])
        pca = PCA(n_components=n_dim, random_state=42)
        coords = pca.fit_transform(matrix)
        kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        start = time.time()
        labels = kmeans.fit_predict(coords)
        elapsed = round(time.time() - start, 3)
        return kmeans, np.asarray(labels), elapsed, None

    model = info["model"](**params)
    start = time.time()
    labels = model.fit_predict(matrix) if name != "Gaussian Mixture" else model.fit(matrix).predict(matrix)
    elapsed = round(time.time() - start, 3)

    if name == "Gaussian Mixture":
        probs = model.predict_proba(matrix)
    else:
        probs = None
    return model, np.asarray(labels), elapsed, probs