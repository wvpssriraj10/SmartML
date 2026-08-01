import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler, MinMaxScaler
from sklearn.impute import SimpleImputer
import os
import warnings
warnings.filterwarnings('ignore')


class DatasetInspector:
    def __init__(self, file_path):
        self.file_path = file_path
        self.df = None
        self.report = {}

    def load(self):
        ext = os.path.splitext(self.file_path)[1].lower()
        if ext == '.csv':
            self.df = pd.read_csv(self.file_path)
        elif ext in ['.xlsx', '.xls']:
            self.df = pd.read_excel(self.file_path)
        elif ext == '.json':
            self.df = pd.read_json(self.file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
        return self

    def inspect(self):
        df = self.df
        self.report['rows'] = len(df)
        self.report['columns'] = len(df.columns)
        self.report['column_names'] = list(df.columns)
        self.report['missing_values'] = df.isnull().sum().to_dict()
        self.report['dtypes'] = {col: str(dtype) for col, dtype in df.dtypes.items()}
        
        # Classify columns robustly
        numeric_cols = []
        categorical_cols = []
        datetime_cols = []
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                numeric_cols.append(col)
            elif pd.api.types.is_datetime64_any_dtype(df[col]) or 'date' in col.lower() or 'time' in col.lower():
                datetime_cols.append(col)
            else:
                categorical_cols.append(col)

        self.report['numeric_columns'] = numeric_cols
        self.report['categorical_columns'] = categorical_cols
        self.report['datetime_columns'] = datetime_cols
        self.report['duplicate_rows'] = int(df.duplicated().sum())

        # ─── Detailed Column Statistics ───────────────────────────────────────
        col_stats = {}
        for col in df.columns:
            non_null = df[col].dropna()
            total = len(df)
            nulls = total - len(non_null)
            unique_count = df[col].nunique()
            
            stats = {
                'null_count': int(nulls),
                'null_pct': round((nulls / total) * 100, 2) if total > 0 else 0,
                'unique_count': int(unique_count),
            }

            if pd.api.types.is_numeric_dtype(df[col]):
                stats['min'] = float(non_null.min()) if len(non_null) > 0 else None
                stats['max'] = float(non_null.max()) if len(non_null) > 0 else None
                stats['mean'] = float(non_null.mean()) if len(non_null) > 0 else None
                stats['median'] = float(non_null.median()) if len(non_null) > 0 else None
                stats['std'] = float(non_null.std()) if len(non_null) > 1 else 0.0
            else:
                if len(non_null) > 0:
                    top_val = non_null.mode().iloc[0] if not non_null.mode().empty else None
                    top_freq = int(non_null.value_counts().iloc[0]) if top_val is not None else 0
                    stats['top_value'] = str(top_val)
                    stats['top_freq'] = top_freq
                    stats['top_pct'] = round((top_freq / len(non_null)) * 100, 2)
                else:
                    stats['top_value'] = None
                    stats['top_freq'] = 0
                    stats['top_pct'] = 0.0

            col_stats[col] = stats
        self.report['column_stats'] = col_stats

        # ─── Top 3-5 Dataset KPIs ─────────────────────────────────────────────
        total_cells = len(df) * len(df.columns)
        total_missing = sum(self.report['missing_values'].values())
        self.report['kpis'] = {
            'data_quality_score': round((1 - (total_missing / total_cells)) * 100, 1) if total_cells > 0 else 100.0,
            'missing_cells_pct': round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0,
            'duplicate_pct': round((self.report['duplicate_rows'] / len(df)) * 100, 2) if len(df) > 0 else 0.0,
            'numeric_ratio': round((len(numeric_cols) / len(df.columns)) * 100, 1) if len(df.columns) > 0 else 0.0,
        }

        # ─── Preferred Graphs/Charts for top columns ─────────────────────────
        charts = []
        # Choose top 3-5 columns to generate charts for (prefer target or columns with high information)
        chart_cols = list(df.columns[:5])
        for col in chart_cols:
            non_null = df[col].dropna()
            if len(non_null) == 0:
                continue

            unique_vals = df[col].nunique()
            if pd.api.types.is_numeric_dtype(df[col]) and unique_vals > 10:
                # Numeric histogram
                try:
                    counts, bins = np.histogram(non_null, bins=10)
                    bin_labels = [f"{round(bins[i],2)} - {round(bins[i+1],2)}" for i in range(len(counts))]
                    charts.append({
                        'column': col,
                        'type': 'histogram',
                        'labels': bin_labels,
                        'values': [int(c) for c in counts],
                        'description': f"Distribution of {col}"
                    })
                except Exception:
                    pass
            else:
                # Categorical/Discrete bar chart (top 8 values)
                val_counts = non_null.value_counts().head(8)
                charts.append({
                    'column': col,
                    'type': 'bar',
                    'labels': [str(k) for k in val_counts.index],
                    'values': [int(v) for v in val_counts.values],
                    'description': f"Top values of {col}"
                })
        self.report['charts'] = charts

        # ─── Correlation Matrix (for numeric columns) ────────────────────────
        numeric_cols = self.report['numeric_columns']
        if len(numeric_cols) > 1:
            corr_df = df[numeric_cols].corr()
            # Convert to list of lists with column names
            corr_matrix = {
                "columns": numeric_cols,
                "data": corr_df.values.tolist()
            }
            self.report['correlation_matrix'] = corr_matrix
        else:
            self.report['correlation_matrix'] = None

        # ─── Data Preview (First 100 Rows) ─────────────────────────────────────
        self.report['preview_headers'] = list(df.columns)
        preview_data = []
        for _, row in df.head(100).iterrows():
            row_vals = []
            for val in row:
                if pd.isna(val):
                    row_vals.append(None)
                elif isinstance(val, (np.integer, np.floating)):
                    row_vals.append(val.item())
                else:
                    row_vals.append(str(val))
            preview_data.append(row_vals)
        self.report['preview_rows'] = preview_data
        self.report['total_values_count'] = int(df.size)

        return self.report

    def suggest_target(self):
        df = self.df
        candidates = []
        for col in df.columns:
            n_unique = df[col].nunique()
            col_type = str(df[col].dtype)
            if n_unique == 1:
                continue
            if df[col].isnull().sum() / len(df) > 0.5:
                continue
            candidates.append({
                'column': col,
                'unique_values': n_unique,
                'dtype': col_type,
                'null_ratio': round(float(df[col].isnull().sum() / len(df)), 3)
            })
        return candidates


class Preprocessor:
    def __init__(self, df, target_column, problem_type=None):
        self.df = df.copy()
        if target_column not in self.df.columns:
            raise ValueError(f"Target column '{target_column}' not found in DataFrame. Available columns: {list(self.df.columns)}")
        self.target_column = target_column
        self.problem_type = problem_type
        self.encoders = {}
        self.scaler = None
        self.imputer = None
        self.numeric_columns = []
        self.categorical_columns = []
        self.feature_names = []
        self.used_columns = []

    def detect_problem_type(self):
        y = self.df[self.target_column]
        if not pd.api.types.is_numeric_dtype(y) or y.nunique() <= 20:
            self.problem_type = 'classification'
        else:
            self.problem_type = 'regression'
        return self.problem_type

    def clean(self):
        df = self.df.copy()
        # Drop rows where target column is null
        df = df.dropna(subset=[self.target_column])
        df = df.drop_duplicates()

        # Group target classes for classification if too many
        if not pd.api.types.is_numeric_dtype(df[self.target_column]) or df[self.target_column].nunique() <= 20:
            # Classification
            n_unique = df[self.target_column].nunique()
            if n_unique > 20:
                print(f"[SmartML] Target '{self.target_column}' has {n_unique} classes. Grouping top 19 classes and mapping others to 'Other'.")
                top_classes = df[self.target_column].value_counts().index[:19]
                df[self.target_column] = df[self.target_column].apply(lambda val: val if val in top_classes else 'Other')

        cols_to_drop = []
        for col in df.columns:
            if df[col].isnull().sum() / len(df) > 0.8:
                cols_to_drop.append(col)
        df = df.drop(columns=cols_to_drop)
        self.used_columns = [c for c in df.columns if c != self.target_column]
        self.df = df
        return self

    def preprocess(self, test_size=0.2, random_state=42):
        df = self.df.copy()
        
        # Subsample if dataset is too large to ensure fast AutoML training
        if len(df) > 5000:
            print(f"[SmartML] Subsampling dataset from {len(df)} to 5000 rows for fast model training.")
            df = df.sample(n=5000, random_state=random_state)

        y = df[self.target_column]
        X = df.drop(columns=[self.target_column])

        # Identify numeric vs categorical feature columns robustly
        numeric_cols = []
        categorical_cols = []
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)

        if not pd.api.types.is_numeric_dtype(y):
            target_encoder = LabelEncoder()
            y = pd.Series(target_encoder.fit_transform(y), index=y.index)
            self.encoders['__target__'] = target_encoder
        
        # Handle stratify only if number of classes is reasonable and minimum class count >= 2
        stratify_y = None
        if self.problem_type == 'classification':
            class_counts = y.value_counts()
            if len(class_counts) < 10 and class_counts.min() >= 2:
                stratify_y = y

        X_train_raw, X_test_raw, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify_y
        )
        # Fit transforms strictly on the training partition to prevent test-set leakage.
        self.numeric_columns = numeric_cols
        self.categorical_columns = categorical_cols
        X_train = self.fit_transform_features(X_train_raw)
        X_test = self.transform_features(X_test_raw)

        return {
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test,
            'feature_names': self.feature_names,
            'problem_type': self.problem_type,
            'target_classes': list(np.unique(y)) if self.problem_type == 'classification' else None,
            'num_classes': len(np.unique(y)) if self.problem_type == 'classification' else None
        }

    def fit_transform_features(self, X):
        X_processed = pd.DataFrame(index=X.index)
        if self.numeric_columns:
            self.imputer = SimpleImputer(strategy='median')
            numeric = pd.DataFrame(self.imputer.fit_transform(X[self.numeric_columns]), columns=self.numeric_columns, index=X.index)
            self.scaler = StandardScaler()
            X_processed = pd.concat([X_processed, pd.DataFrame(self.scaler.fit_transform(numeric), columns=self.numeric_columns, index=X.index)], axis=1)
        for col in self.categorical_columns:
            values = X[col].astype(str).fillna('missing')
            encoder = LabelEncoder()
            X_processed[col] = encoder.fit_transform(values)
            self.encoders[col] = encoder
        self.feature_names = X_processed.columns.tolist()
        return X_processed.reindex(columns=self.feature_names, fill_value=0)

    def transform_features(self, X):
        X = X.copy()
        X_processed = pd.DataFrame(index=X.index)
        if self.numeric_columns:
            numeric = X.reindex(columns=self.numeric_columns)
            numeric = pd.DataFrame(self.imputer.transform(numeric), columns=self.numeric_columns, index=X.index)
            X_processed = pd.concat([X_processed, pd.DataFrame(self.scaler.transform(numeric), columns=self.numeric_columns, index=X.index)], axis=1)
        for col in self.categorical_columns:
            values = X[col].astype(str).fillna('missing') if col in X else pd.Series('missing', index=X.index)
            classes = self.encoders[col].classes_
            mapping = {value: idx for idx, value in enumerate(classes)}
            X_processed[col] = values.map(mapping).fillna(-1).astype(int)
        return X_processed.reindex(columns=self.feature_names, fill_value=0)

    def export_artifact(self, model):
        """Return only joblib-serializable state required by a standalone predictor."""
        return {
            'model': model,
            'target_column': self.target_column,
            'problem_type': self.problem_type,
            'feature_names': self.feature_names,
            'numeric_columns': self.numeric_columns,
            'categorical_columns': self.categorical_columns,
            'imputer': self.imputer,
            'scaler': self.scaler,
            'encoders': {key: value for key, value in self.encoders.items() if key != '__target__'},
        }
