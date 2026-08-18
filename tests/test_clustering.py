import numpy as np
import pandas as pd
import pytest

from ml_engine.clustering import (
    CLUSTERING_REGISTRY,
    build_cluster_matrix,
    cluster_profiles,
    fit_clustering,
)


class TestBuildClusterMatrix:
    def test_numeric_scaled(self, iris_df):
        matrix, encoders, numeric_cols, cat_cols, _ = build_cluster_matrix(iris_df)
        assert matrix is not None
        assert list(matrix.columns) == list(iris_df.columns)
        assert "target" in numeric_cols
        # standard-scaled: means ~ 0, std ~ 1
        assert abs(matrix["sepal length (cm)"].mean()) < 0.01
        assert abs(matrix["sepal length (cm)"].std() - 1.0) < 0.01

    def test_categorical_low_cardinality_encoded(self, dirty_df):
        matrix, encoders, _, cat_cols, _ = build_cluster_matrix(dirty_df)
        assert "cat" in matrix.columns
        assert "cat" in cat_cols
        # 4 values after NaN -> 'missing': a, b, missing, c
        assert set(matrix["cat"].unique()) <= set(range(4))

    def test_high_cardinality_cat_dropped(self):
        base = pd.DataFrame(
            {
                "num": [1.0, 2.0, 3.0],
                "free_text": ["x" * 50, "y" * 50, "z" * 50],
            }
        )
        rows = [base.copy() for _ in range(20)]
        df2 = pd.concat(rows, ignore_index=True)  # 60 rows
        df2["high_card"] = [f"val_{i % 30}" for i in range(len(df2))]  # 30 uniques > 20
        matrix, _, _, cat_cols, _ = build_cluster_matrix(df2)
        assert matrix is not None
        assert "high_card" not in matrix.columns

    def test_no_usable_columns_returns_none(self):
        df = pd.DataFrame({"a": [f"u{i}" for i in range(100)], "b": [f"v{i}" for i in range(100)]})
        matrix, _, _, _, _ = build_cluster_matrix(df)
        assert matrix is None


class TestClusterProfiles:
    def test_builds_profiles(self, iris_df):
        labels = np.array([0] * 50 + [1] * 50 + [2] * 50)
        profiles = cluster_profiles(iris_df, labels, list(iris_df.columns), 3)
        assert len(profiles) == 3
        assert profiles[0]["size"] == 50
        assert profiles[0]["share"] == pytest.approx(50 / 150, abs=0.001)
        assert "sepal length (cm)" in profiles[0]["features"]


class TestFitClustering:
    def test_kmeans(self, iris_df):
        matrix, _, _, _, _ = build_cluster_matrix(iris_df)
        model, labels, elapsed, probs = fit_clustering("K-Means", matrix, n_clusters=3)
        assert len(labels) == len(iris_df)
        assert set(labels) <= set(range(3))
        assert elapsed >= 0
        assert probs is None

    def test_agglomerative(self, iris_df):
        matrix, _, _, _, _ = build_cluster_matrix(iris_df)
        model, labels, elapsed, _ = fit_clustering("Agglomerative", matrix, n_clusters=3)
        assert len(labels) == len(iris_df)

    def test_gaussian_mixture_returns_probs(self, iris_df):
        matrix, _, _, _, _ = build_cluster_matrix(iris_df)
        model, labels, elapsed, probs = fit_clustering("Gaussian Mixture", matrix, n_clusters=3)
        assert len(labels) == len(iris_df)
        assert probs is not None
        assert probs.shape == (len(iris_df), 3)

    def test_pca_variant(self, iris_df):
        matrix, _, _, _, _ = build_cluster_matrix(iris_df)
        model, labels, elapsed, _ = fit_clustering("PCA", matrix, n_clusters=3)
        assert len(labels) == len(iris_df)

    def test_unknown_algorithm_raises(self, iris_df):
        matrix, _, _, _, _ = build_cluster_matrix(iris_df)
        with pytest.raises(KeyError):
            fit_clustering("Not A Thing", matrix)
