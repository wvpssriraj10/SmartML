import pytest

from ml_engine.pipeline import run_pipeline
from ml_engine.trainer import Trainer, _subsample_for_training


class TestSubsample:
    def test_small_df_returned_unchanged(self, iris_df):
        df, orig = _subsample_for_training(iris_df, "target")
        assert orig is None
        assert len(df) == 150

    def test_large_df_subsampled(self, iris_df):
        big = iris_df
        for _ in range(100):
            big = big.append(big) if hasattr(big, "append") else big
        # build a genuinely large frame
        import pandas as pd

        big = pd.concat([iris_df] * 200, ignore_index=True)
        df, orig = _subsample_for_training(big, "target")
        assert orig == len(big)
        assert len(df) <= 15000
        assert len(df) < len(big)


class TestTrainerEndToEnd:
    def test_classification_iris(self, iris_csv):
        trainer = Trainer(
            file_path=iris_csv,
            target_column="target",
            problem_type="classification",
            model_selection="smart",
        )
        summary = trainer.run()
        assert summary["data_report"]["problem_type"] == "classification"
        assert summary["successful"] == 4
        assert summary["failed"] == 0
        assert summary["total_models_trained"] == 4
        assert summary["best_model"]["name"] in {"Logistic Regression", "Decision Tree", "Random Forest", "Naive Bayes"}
        assert "f1_score" in summary["best_model"]["metrics"]
        # results ranked best-first
        ranks = [r["rank"] for r in summary["results"]]
        assert ranks == sorted(ranks)
        assert summary["data_report"]["model_selection_strategy"] == "smart_auto_pick"

    def test_manual_model_selection(self, iris_csv):
        trainer = Trainer(
            file_path=iris_csv,
            target_column="target",
            problem_type="classification",
            model_selection="manual",
            selected_models=["Decision Tree"],
        )
        summary = trainer.run()
        assert summary["total_models_trained"] == 1
        assert summary["results"][0]["model_name"] == "Decision Tree"
        assert summary["data_report"]["model_selection_strategy"] == "user_selected"

    def test_all_models_limited(self, iris_csv):
        trainer = Trainer(
            file_path=iris_csv,
            target_column="target",
            problem_type="classification",
            model_selection="all",
        )
        summary = trainer.run()
        assert summary["data_report"]["model_selection_strategy"] == "all_models_limited"
        assert summary["total_models_trained"] <= 4

    def test_progress_callback_fired(self, iris_csv):
        events = []

        def cb(event):
            events.append(event)

        trainer = Trainer(
            file_path=iris_csv,
            target_column="target",
            problem_type="classification",
            model_selection="smart",
            progress_callback=cb,
        )
        trainer.run()
        assert len(events) > 0
        assert any(e.get("percent") == 100 for e in events)

    def test_regression(self, tmp_path):
        import pandas as pd
        from sklearn.datasets import load_diabetes

        dia = load_diabetes()
        df = pd.DataFrame(dia.data, columns=dia.feature_names)
        df["target"] = dia.target
        csv_path = tmp_path / "diabetes.csv"
        df.to_csv(csv_path, index=False)
        trainer = Trainer(
            file_path=str(csv_path),
            target_column="target",
            problem_type="regression",
            model_selection="smart",
        )
        summary = trainer.run()
        assert summary["data_report"]["problem_type"] == "regression"
        assert summary["successful"] >= 1
        assert "r2_score" in summary["best_model"]["metrics"]


class TestPipeline:
    def test_run_pipeline_returns_summary(self, iris_csv):
        summary = run_pipeline(
            iris_csv,
            target_column="target",
            problem_type="classification",
            model_selection="smart",
        )
        assert summary["successful"] == 4
