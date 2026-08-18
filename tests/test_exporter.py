import pytest

from backend.exporter import (
    generate_inference_code,
    generate_readme,
    generate_requirements,
)


class TestInferenceCode:
    def test_contains_model_metadata(self):
        code = generate_inference_code("Random Forest", "classification", {"f1_score": 0.95})
        assert "Random Forest" in code
        assert "classification" in code
        assert "f1_score" in code

    def test_compiles_as_python(self):
        code = generate_inference_code("Ridge Regression", "regression", {"r2_score": 0.8})
        compile(code, "<inference>", "exec")

    def test_contains_preprocess_and_predict_functions(self):
        code = generate_inference_code("Logistic Regression", "classification", {"accuracy": 1.0})
        assert "def preprocess(" in code
        assert "def predict(" in code


class TestReadme:
    def test_lists_metrics(self):
        readme = generate_readme("SVM", "classification", {"f1_score": 0.9, "accuracy": 0.88})
        assert "SVM" in readme
        assert "classification" in readme
        assert "**f1_score**: 0.9" in readme
        assert "**accuracy**: 0.88" in readme


class TestRequirements:
    def test_has_core_deps(self):
        reqs = generate_requirements()
        assert "pandas" in reqs
        assert "scikit-learn" in reqs
        assert "joblib" in reqs
