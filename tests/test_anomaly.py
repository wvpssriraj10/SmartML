import numpy as np
import pandas as pd
import pytest

from ml_engine.anomaly import (
    ANOMALY_REGISTRY,
    build_anomaly_matrix,
    fit_detector,
)


class TestBuildAnomalyMatrix:
    def test_numeric_scaled(self, iris_df):
        matrix, numeric_cols, cat_cols = build_anomaly_matrix(iris_df)
        assert matrix is not None
        assert list(matrix.columns) == list(iris_df.columns)
        assert "sepal length (cm)" in numeric_cols
        assert abs(matrix["sepal length (cm)"].mean()) < 0.01

    def test_categorical_encoded(self, dirty_df):
        matrix, _, cat_cols = build_anomaly_matrix(dirty_df)
        assert "cat" in matrix.columns
        assert "cat" in cat_cols

    def test_no_usable_columns_returns_none(self):
        df = pd.DataFrame({"a": [f"u{i}" for i in range(100)], "b": [f"v{i}" for i in range(100)]})
        matrix, _, _ = build_anomaly_matrix(df)
        assert matrix is None


class TestFitDetector:
    @pytest.fixture
    def matrix(self, iris_df):
        return build_anomaly_matrix(iris_df)[0]

    def test_isolation_forest(self, matrix):
        model, norm, anomaly, raw, elapsed = fit_detector("Isolation Forest", matrix)
        assert len(norm) == len(matrix)
        assert len(anomaly) == len(matrix)
        assert set(anomaly) <= {0, 1}
        # normalized scores in [0,1]
        assert norm.min() >= 0.0 and norm.max() <= 1.0

    def test_local_outlier_factor(self, matrix):
        model, norm, anomaly, raw, _ = fit_detector("Local Outlier Factor", matrix)
        assert len(norm) == len(matrix)
        assert set(anomaly) <= {0, 1}

    def test_one_class_svm(self, matrix):
        model, norm, anomaly, raw, _ = fit_detector("One-Class SVM", matrix)
        assert len(norm) == len(matrix)
        assert set(anomaly) <= {0, 1}

    def test_constant_scores_all_zero(self):
        X = np.ones((10, 2))
        model, norm, anomaly, raw, _ = fit_detector("Isolation Forest", X)
        assert (norm == 0).all()

    def test_unknown_detector_raises(self, matrix):
        with pytest.raises(KeyError):
            fit_detector("Not A Thing", matrix)
