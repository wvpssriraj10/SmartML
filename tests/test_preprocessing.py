import pandas as pd
import pytest

from ml_engine.preprocessing import DatasetInspector, Preprocessor


class TestDatasetInspector:
    def test_loads_csv(self, iris_csv):
        inspector = DatasetInspector(iris_csv)
        inspector.load()
        assert len(inspector.df) > 0

    def test_unsupported_format_raises(self, tmp_path):
        bogus = tmp_path / "data.txt"
        bogus.write_text("a,b\n1,2\n")
        with pytest.raises(ValueError):
            DatasetInspector(str(bogus)).load()

    def test_inspect_report_keys(self, iris_csv):
        inspector = DatasetInspector(iris_csv)
        inspector.load()
        report = inspector.inspect()
        assert report["rows"] == 150
        assert report["columns"] == 5
        assert "sepal length (cm)" in report["column_names"]
        assert report["missing_values"]["target"] == 0
        assert report["duplicate_rows"] == 1
        assert "sepal length (cm)" in report["numeric_columns"]
        assert report["kpis"]["missing_cells_pct"] == 0.0
        assert report["correlation_matrix"]["columns"] == [
            "sepal length (cm)",
            "sepal width (cm)",
            "petal length (cm)",
            "petal width (cm)",
            "target",
        ]
        assert len(report["preview_rows"]) == 100  # preview capped at 100 rows
        assert report["total_values_count"] == 750

    def test_inspect_detects_missing_and_categorical(self, dirty_csv):
        inspector = DatasetInspector(dirty_csv)
        inspector.load()
        report = inspector.inspect()
        assert report["missing_values"]["num"] == 1
        assert report["missing_values"]["cat"] == 1
        assert "cat" in report["categorical_columns"]
        stats = report["column_stats"]["num"]
        assert stats["null_count"] == 1
        assert stats["null_pct"] == 20.0
        assert stats["min"] == 1.0
        assert stats["max"] == 100.0

    def test_suggest_target(self, iris_csv):
        inspector = DatasetInspector(iris_csv)
        inspector.load()
        candidates = inspector.suggest_target()
        names = [c["column"] for c in candidates]
        assert "target" in names

    def test_all_numeric_datetime_categorical(self):
        df = pd.DataFrame(
            {
                "num": [1.0, 2.0],
                "dt": pd.to_datetime(["2020-01-01", "2020-01-02"]),
                "txt": ["x", "y"],
            }
        )
        inspector = DatasetInspector.__new__(DatasetInspector)
        inspector.df = df
        inspector.report = {}
        report = inspector.inspect()
        assert "num" in report["numeric_columns"]
        assert "dt" in report["datetime_columns"]
        assert "txt" in report["categorical_columns"]


class TestPreprocessor:
    def test_missing_target_raises(self, iris_df):
        with pytest.raises(ValueError):
            Preprocessor(iris_df, "does_not_exist")

    def test_detect_classification_small_uniques(self):
        df = pd.DataFrame({"x": [1, 2, 3], "y": ["a", "b", "c"]})
        pp = Preprocessor(df, "y")
        assert pp.detect_problem_type() == "classification"

    def test_detect_regression_many_uniques(self):
        df = pd.DataFrame({"x": list(range(1, 26)), "y": list(range(100, 10000, 390))[:25]})
        pp = Preprocessor(df, "y")
        assert pp.detect_problem_type() == "regression"

    def test_clean_drops_duplicates_and_target_nulls(self):
        df = pd.DataFrame(
            {
                "x": [1, 1, 2, None],
                "target": [0, 0, None, 1],
            }
        )
        pp = Preprocessor(df, "target")
        pp.clean()
        assert len(pp.df) == 2  # drops target-null row and the duplicate

    def test_preprocess_classification_splits(self, iris_df):
        pp = Preprocessor(iris_df, "target", "classification")
        pp.clean()
        data = pp.preprocess()
        assert data["problem_type"] == "classification"
        # iris has 1 duplicate row, clean() drops it -> 149 rows, 80/20 split
        assert len(data["X_train"]) == 119
        assert len(data["X_test"]) == 30
        assert len(data["feature_names"]) == 4
        assert data["num_classes"] == 3
        assert data["target_classes"] == [0, 1, 2]

    def test_preprocess_regression(self):
        df = pd.DataFrame({"x": [1, 2, 3, 4, 5], "y": [10, 20, 30, 40, 50]})
        pp = Preprocessor(df, "y", "regression")
        pp.clean()
        data = pp.preprocess()
        assert data["problem_type"] == "regression"
        assert len(data["X_train"]) == 4
        assert len(data["X_test"]) == 1

    def test_fit_transform_consistency(self, iris_df):
        pp = Preprocessor(iris_df, "target", "classification")
        pp.clean()
        data = pp.preprocess()
        # feature names identical on train and test
        assert list(data["X_train"].columns) == list(data["X_test"].columns)

    def test_export_artifact_structure(self, iris_df):
        pp = Preprocessor(iris_df, "target", "classification")
        pp.clean()
        data = pp.preprocess()
        artifact = pp.export_artifact(model="dummy")
        assert artifact["target_column"] == "target"
        assert artifact["problem_type"] == "classification"
        assert artifact["feature_names"] == data["feature_names"]
        assert "__target__" not in artifact["encoders"]
