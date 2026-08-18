import numpy as np
import pytest

from ml_engine.models import MODEL_REGISTRY, get_smart_models, train_model


class TestGetSmartModels:
    def test_small_classification_priority(self):
        models = get_smart_models(
            {"problem_type": "classification", "n_rows": 100, "n_features": 10, "n_classes": 2}
        )
        assert list(models.keys()) == [
            "Logistic Regression",
            "Decision Tree",
            "Random Forest",
            "Naive Bayes",
        ]

    def test_medium_classification_priority(self):
        models = get_smart_models(
            {"problem_type": "classification", "n_rows": 10000, "n_features": 10, "n_classes": 2}
        )
        # 10000 rows hits the fallback branch -> registry key order, capped to 4
        assert list(models.keys()) == [
            "Logistic Regression",
            "Ridge Classifier",
            "Decision Tree",
            "Random Forest",
        ]

    def test_large_classification_priority(self):
        models = get_smart_models(
            {"problem_type": "classification", "n_rows": 60000, "n_features": 10, "n_classes": 2}
        )
        assert models["LightGBM"] is not None

    def test_small_regression_priority(self):
        models = get_smart_models(
            {"problem_type": "regression", "n_rows": 100, "n_features": 10, "n_classes": 2}
        )
        assert list(models.keys())[0] == "Ridge Regression"
        assert "Logistic Regression" not in models

    def test_all_models_key_exists(self):
        models = get_smart_models(
            {"problem_type": "classification", "n_rows": 10, "n_features": 5, "n_classes": 3}
        )
        for name in models:
            assert name in MODEL_REGISTRY["classification"]

    def test_max_models_capped_at_four(self):
        models = get_smart_models(
            {"problem_type": "classification", "n_rows": 100000, "n_features": 50, "n_classes": 5}
        )
        assert len(models) <= 4

    def test_unknown_problem_type_defaults_to_classification(self):
        models = get_smart_models({"n_rows": 100})
        assert "Logistic Regression" in models


class TestTrainModel:
    def test_fits_and_reports_time(self):
        X = np.array([[0, 0], [1, 1], [0, 1], [1, 0]])
        y = np.array([0, 1, 0, 1])
        info = MODEL_REGISTRY["classification"]["Logistic Regression"]
        result = train_model(info, X, y, "Logistic Regression")
        assert hasattr(result["model"], "predict")
        assert result["name"] == "Logistic Regression"
        assert result["training_time"] >= 0
