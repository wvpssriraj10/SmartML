import numpy as np
from .preprocessing import DatasetInspector
from .anomaly import (
    ANOMALY_REGISTRY, MAX_ANOMALY_ROWS, _metadata,
    build_anomaly_matrix, fit_detector,
)
from sklearn.decomposition import PCA


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


class AnomalyTrainer:
    def __init__(self, file_path, detectors=None, contamination=0.05, columns=None,
                 progress_callback=None):
        self.file_path = file_path
        self.detectors = detectors or ["Isolation Forest"]
        self.detectors = [d for d in self.detectors if d in ANOMALY_REGISTRY]
        self.contamination = contamination
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

        if len(df) > MAX_ANOMALY_ROWS:
            df = df.sample(n=MAX_ANOMALY_ROWS, random_state=42).reset_index(drop=True)

        self._report(f"Preparing features for {len(df):,} rows…", 0, len(self.detectors))

        matrix, _, _ = build_anomaly_matrix(df, self.columns)
        if matrix is None:
            raise ValueError("No usable numeric features found for anomaly detection. "
                             "Add numeric columns or low-cardinality categories.")

        feature_columns = [c for c in (self.columns or list(df.columns)) if c in df.columns]

        # 2D embedding shared across detectors (same projection, different labels).
        n_dim = min(2, matrix.shape[1])
        if n_dim < 2:
            emb = np.zeros((len(matrix), 2), dtype=float)
            emb[:, 0] = matrix.iloc[:, 0].to_numpy()
        else:
            pca = PCA(n_components=2, random_state=42)
            emb = pca.fit_transform(matrix)

        results = []
        total = len(self.detectors)
        for idx, name in enumerate(self.detectors):
            info = ANOMALY_REGISTRY[name]
            cap = min(info['max_rows'], len(matrix))
            sub_df = df
            sub_matrix = matrix
            if len(matrix) > cap:
                sub_idx = np.random.RandomState(42).choice(len(matrix), size=cap, replace=False)
                sub_matrix = matrix.iloc[sub_idx].reset_index(drop=True)
                sub_df = df.iloc[sub_idx].reset_index(drop=True)
                sub_emb = emb[sub_idx]
            else:
                sub_emb = emb
            self._report(f"{name}: scanning {len(sub_matrix)} rows…", idx, total, name)
            item = self._fit_one(name, sub_matrix, sub_df, feature_columns, sub_emb)
            self._report(f"{name} complete.", idx + 1, total, name, 'success')
            results.append(item)

        self.report['summary'] = {
            'detectors_run': total,
            'rows_analyzed': len(matrix),
            'original_rows': original_rows,
            'rows_capped': original_rows > len(matrix),
            'contamination': self.contamination,
            'flagged_count': int(sum(r['n_flagged'] for r in results)),
            'subsample_note': (
                f"Dataset reduced from {original_rows} to {len(matrix)} rows "
                "to stay within the free-tier memory limit."
            ) if original_rows > len(matrix) else None,
        }
        self.report['results'] = results
        self.report['metadata'] = _metadata()
        return convert(self.report)

    def _fit_one(self, name, matrix, sub_df, feature_columns, emb):
        model, scores, anomaly, raw_scores, elapsed = fit_detector(name, matrix)
        n = len(scores)
        n_flagged = int(anomaly.sum())
        rate = round(n_flagged / n, 4) if n else 0

        points = []
        for i in range(n):
            points.append({
                'x': round(float(emb[i, 0]), 4),
                'y': round(float(emb[i, 1]), 4),
                'score': round(float(scores[i]), 4),
                'anomaly': int(anomaly[i]),
                'row': int(i),
            })

        flagged_rows = [i for i in range(n) if anomaly[i] == 1]

        profiles = self._profiles(sub_df, anomaly, feature_columns)

        return {
            'detector': name,
            'status': 'completed',
            'elapsed_sec': elapsed,
            'contamination': self.contamination,
            'n_flagged': n_flagged,
            'flagged_rate': rate,
            'anomaly_labels': [int(a) for a in anomaly],
            'scores': [round(float(s), 4) for s in scores],
            'flagged_rows': flagged_rows,
            'profiles': profiles,
            'points': points,
            'notes': self._note(name, n_flagged, n),
        }

    def _profiles(self, df, anomaly, feature_columns):
        """Compare typical values of flagged vs normal rows."""
        anomaly = np.asarray(anomaly)
        normal_mask = anomaly == 0
        flagged_mask = anomaly == 1
        out = {}
        for group_key, mask, label in (
            ('normal', normal_mask, 'Typical'),
            ('flagged', flagged_mask, 'Unusual'),
        ):
            size = int(mask.sum())
            features = {}
            if size == 0:
                out[group_key] = {'group': label, 'size': size, 'share': 0.0, 'features': features}
                continue
            subset = df[mask]
            for col in feature_columns:
                if col not in subset.columns or col not in df.columns:
                    continue
                col_data = subset[col]
                if pd_is_numeric(df, col):
                    features[col] = round(float(col_data.mean()), 4)
                else:
                    features[col] = str(col_data.mode().iloc[0]) if not col_data.mode().empty else "missing"
            out[group_key] = {
                'group': label,
                'size': size,
                'share': round(size / len(df), 4),
                'features': features,
            }
        return out

    def _note(self, name, n_flagged, n):
        if n_flagged == 0:
            return "No rows stood out. Consider lowering the threshold to catch more."
        pct = round(n_flagged / n * 100, 1) if n else 0
        return f"{name} flagged {n_flagged} rows ({pct}%) as unusual. Review the 'Unusual' profile to see why."


def pd_is_numeric(df, col):
    import pandas as pd
    return pd.api.types.is_numeric_dtype(df[col])


__all__ = ['AnomalyTrainer']
