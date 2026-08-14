import numpy as np
from .preprocessing import DatasetInspector
from .clustering import (
    CLUSTERING_REGISTRY, MAX_CLUSTER_ROWS, METRIC_SAMPLE, _metadata,
    build_cluster_matrix, cluster_profiles, fit_clustering,
)
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score


def convert(obj):
    if isinstance(obj, dict):
        return {k: convert(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


class ClusterTrainer:
    def __init__(self, file_path, algorithms=None, n_clusters=5, columns=None,
                 progress_callback=None):
        self.file_path = file_path
        self.algorithms = algorithms or ["K-Means"]
        # Only run algorithms that exist in the registry
        self.algorithms = [a for a in self.algorithms if a in CLUSTERING_REGISTRY]
        self.n_clusters = n_clusters
        self.columns = columns
        self.progress_callback = progress_callback
        self.report = {}

    def _report(self, message, completed=0, total=0, model=None, level='info'):
        if self.progress_callback:
            self.progress_callback({
                'message': message, 'completed': completed, 'total': total,
                'percent': round((completed / total) * 100) if total else 0,
                'model': model, 'level': level,
            })

    def run(self):
        inspector = DatasetInspector(self.file_path)
        inspector.load()
        inspection = inspector.inspect()

        df = inspector.df.copy()
        original_rows = len(df)

        # ── Cap: never cluster more than the free-tier memory ceiling ─────
        if len(df) > MAX_CLUSTER_ROWS:
            df = df.sample(n=MAX_CLUSTER_ROWS, random_state=42).reset_index(drop=True)

        self._report(f"Preparing features for {len(df):,} rows…", 0, len(self.algorithms))

        matrix, _, _, _, _ = build_cluster_matrix(df, self.columns)
        if matrix is None:
            raise ValueError("No usable numeric features found for clustering. "
                             "Add numeric columns or low-cardinality categories.")

        feature_columns = [c for c in (self.columns or list(df.columns)) if c in df.columns]
        self.feature_names = matrix.columns.tolist()

        results = []
        total = len(self.algorithms)
        for idx, name in enumerate(self.algorithms):
            info = CLUSTERING_REGISTRY[name]
            cap = min(info['max_rows'], len(matrix))
            sub_df = df
            sub_matrix = matrix
            if len(matrix) > cap:
                sub_idx = np.random.RandomState(42).choice(len(matrix), size=cap, replace=False)
                sub_matrix = matrix.iloc[sub_idx].reset_index(drop=True)
                sub_df = df.iloc[sub_idx].reset_index(drop=True)
            self._report(f"{name}: fitting on {len(sub_matrix)} rows…", idx, total, name)
            item = self._fit_one(name, sub_matrix, sub_df, feature_columns)
            self._report(f"{name} complete.", idx + 1, total, name, 'success')
            results.append(item)

        self.report['summary'] = {
            'algorithms_run': total,
            'rows_analyzed': len(matrix),
            'original_rows': original_rows,
            'rows_capped': original_rows > len(matrix),
            'subsample_note': (
                f"Dataset reduced from {original_rows} to {len(matrix)} rows "
                "to stay within the free-tier memory limit."
            ) if original_rows > len(matrix) else None,
        }
        self.report['results'] = results
        self.report['metadata'] = _metadata()
        return convert(self.report)

    def _fit_one(self, name, matrix, sub_df, feature_columns):
        model, labels, elapsed, probs = fit_clustering(name, matrix, self.n_clusters)
        unique_labels = sorted(set(int(l) for l in labels))
        n_found = len(unique_labels)
        label_positions = {lbl: i for i, lbl in enumerate(unique_labels)}

        # ── Clustering quality metrics ────────────────────────────────────
        metrics = {}
        try:
            # Silhouette is O(n²): score it on a bounded sample.
            if len(matrix) > METRIC_SAMPLE:
                sample_idx = np.random.RandomState(0).choice(len(labels), size=METRIC_SAMPLE, replace=False)
                sample_matrix = matrix.iloc[sample_idx]
                sample_labels = labels[sample_idx]
            else:
                sample_matrix = matrix
                sample_labels = labels
            if len(set(sample_labels.tolist())) >= 2:
                metrics['silhouette'] = round(float(silhouette_score(sample_matrix, sample_labels)), 4)
        except Exception:
            metrics['silhouette'] = None

        try:
            if n_found >= 2:
                metrics['calinski_harabasz'] = round(float(calinski_harabasz_score(matrix, labels)), 2)
            else:
                metrics['calinski_harabasz'] = None
        except Exception:
            metrics['calinski_harabasz'] = None

        try:
            if n_found >= 2:
                metrics['davies_bouldin'] = round(float(davies_bouldin_score(matrix, labels)), 4)
            else:
                metrics['davies_bouldin'] = None
        except Exception:
            metrics['davies_bouldin'] = None

        # ── Per-cluster profiles using ORIGINAL values ────────────────────
        profiles = cluster_profiles(sub_df, labels, feature_columns, n_found)

        # ── 2D embedding for THIS algorithm (aligned with its labels) ─────
        # PCA needs at least 2 features; single-feature matrices fall back to
        # a constant x-axis so the plot still renders.
        n_dim = min(2, matrix.shape[1])
        if n_dim < 2:
            emb = np.zeros((len(matrix), 2), dtype=float)
            emb[:, 0] = matrix.iloc[:, 0].to_numpy()
        else:
            pca = PCA(n_components=2, random_state=42)
            emb = pca.fit_transform(matrix)
        points = []
        for i in range(len(labels)):
            points.append({
                'x': round(float(emb[i, 0]), 4),
                'y': round(float(emb[i, 1]), 4),
                'cluster': int(labels[i]),
                'row': int(i),
            })

        probs_list = None
        if probs is not None:
            probs_list = [round(float(p.max()), 4) for p in probs]

        return {
            'model': name,
            'status': 'completed',
            'elapsed_sec': elapsed,
            'n_clusters_configured': self.n_clusters,
            'n_clusters_found': n_found,
            'cluster_labels': [int(l) for l in labels],
            'cluster_membership_max': probs_list,
            'cluster_sizes': {int(lbl): int((labels == lbl).sum()) for lbl in unique_labels},
            'label_positions': label_positions,
            'metrics': metrics,
            'profiles': profiles,
            'points': points,
            'notes': _cluster_note(name, self.n_clusters, n_found),
            'silhouette_recommendation': _recommendation(metrics),
        }

    def summarize(self):
        return self.report


def _cluster_note(name, configured, found):
    if found >= 2:
        return None
    extra = " Try a higher K (more clusters) or a different algorithm." if name in ("K-Means", "Agglomerative", "PCA") else ""
    return f"This run produced only {found} cluster{'' if found == 1 else 's'}.{extra}"


def _recommendation(metrics):
    sil = metrics.get('silhouette')
    if sil is None:
        return None
    if sil >= 0.6:
        return "Separation is strong — clusters are well defined."
    if sil >= 0.3:
        return "Separation is moderate; consider tuning K or features."
    return "Separation is weak — clusters overlap. Try fewer clusters, scaling, or different features."


# keep unused closure-free reference for imports
__all__ = ['ClusterTrainer']