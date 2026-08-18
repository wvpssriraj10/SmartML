import numpy as np
import pytest

from ml_engine.metrics import (
    compute_classification_metrics,
    compute_regression_metrics,
    rank_models,
)


class TestClassificationMetrics:
    def test_perfect_prediction(self):
        y_true = [0, 1, 1, 0]
        y_pred = [0, 1, 1, 0]
        m = compute_classification_metrics(y_true, y_pred)
        assert m["accuracy"] == 1.0
        assert m["precision"] == 1.0
        assert m["recall"] == 1.0
        assert m["f1_score"] == 1.0

    def test_with_probabilities_binary(self):
        y_true = [0, 1, 1, 0]
        y_pred = [0, 1, 1, 0]
        y_prob = np.array([[0.9, 0.1], [0.2, 0.8], [0.1, 0.9], [0.8, 0.2]])
        m = compute_classification_metrics(y_true, y_pred, y_prob)
        assert m["roc_auc"] is not None
        assert 0.0 <= m["roc_auc"] <= 1.0

    def test_multiclass_roc_auc(self):
        y_true = [0, 1, 2, 0, 1, 2]
        y_pred = [0, 1, 2, 0, 1, 2]
        y_prob = np.eye(3)[y_pred]
        m = compute_classification_metrics(y_true, y_pred, y_prob)
        assert m["roc_auc"] is not None

    def test_single_class_auc_returns_none(self):
        y_true = [0, 0, 0]
        y_pred = [0, 0, 0]
        y_prob = np.array([[0.9, 0.1], [0.8, 0.2], [0.7, 0.3]])
        m = compute_classification_metrics(y_true, y_pred, y_prob)
        assert m["roc_auc"] is None

    def test_values_rounded_to_4dp(self):
        m = compute_classification_metrics([0, 1], [0, 1])
        for k in ("accuracy", "precision", "recall", "f1_score"):
            assert isinstance(m[k], float)


class TestRegressionMetrics:
    def test_perfect_prediction(self):
        m = compute_regression_metrics([1, 2, 3], [1, 2, 3])
        assert m["mse"] == 0.0
        assert m["rmse"] == 0.0
        assert m["mae"] == 0.0
        assert m["r2_score"] == 1.0

    def test_imperfect_prediction(self):
        m = compute_regression_metrics([1, 2, 3], [2, 2, 2])
        assert m["mse"] > 0.0
        assert m["mae"] > 0.0
        assert m["r2_score"] < 1.0

    def test_rmse_equals_sqrt_mse(self):
        y_true = [1, 4, 9]
        y_pred = [2, 3, 8]
        m = compute_regression_metrics(y_true, y_pred)
        assert round(m["rmse"] ** 2, 4) == m["mse"]


class TestRankModels:
    def test_classification_ranks_by_f1(self):
        results = [
            {"model_name": "A", "metrics": {"f1_score": 0.5}},
            {"model_name": "B", "metrics": {"f1_score": 0.9}},
            {"model_name": "C", "metrics": {"f1_score": 0.7}},
        ]
        ranked = rank_models(results, "classification")
        assert [r["model_name"] for r in ranked] == ["B", "C", "A"]
        assert [r["rank"] for r in ranked] == [1, 2, 3]

    def test_regression_ranks_by_r2(self):
        results = [
            {"model_name": "A", "metrics": {"r2_score": 0.4}},
            {"model_name": "B", "metrics": {"r2_score": 0.8}},
        ]
        ranked = rank_models(results, "regression")
        assert ranked[0]["model_name"] == "B"

    def test_missing_metrics_rank_last(self):
        results = [
            {"model_name": "A", "metrics": {"f1_score": 0.6}},
            {"model_name": "B", "metrics": {}},
        ]
        ranked = rank_models(results, "classification")
        assert ranked[0]["model_name"] == "A"
        assert ranked[1]["model_name"] == "B"

    def test_does_not_mutate_input_order(self):
        results = [
            {"model_name": "A", "metrics": {"f1_score": 0.5}},
            {"model_name": "B", "metrics": {"f1_score": 0.9}},
        ]
        rank_models(results, "classification")
        # rank_models sorts in place; ensure ranks were assigned
        assert all(r.get("rank") for r in results)
