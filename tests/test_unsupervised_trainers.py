import pytest

from ml_engine.cluster_trainer import ClusterTrainer
from ml_engine.anomaly_trainer import AnomalyTrainer


class TestClusterTrainer:
    def test_kmeans_iris(self, iris_csv):
        trainer = ClusterTrainer(
            file_path=iris_csv,
            algorithms=["K-Means"],
            n_clusters=3,
        )
        summary = trainer.run()
        assert summary["summary"]["algorithms_run"] == 1
        assert summary["summary"]["rows_analyzed"] == 150
        assert not summary["summary"]["rows_capped"]
        result = summary["results"][0]
        assert result["model"] == "K-Means"
        assert result["status"] == "completed"
        assert result["n_clusters_found"] == 3
        assert len(result["cluster_labels"]) == 150
        assert result["metrics"]["silhouette"] is not None
        assert len(result["profiles"]) == 3
        assert len(result["points"]) == 150
        assert "metadata" in summary

    def test_unknown_algorithm_filtered(self, iris_csv):
        trainer = ClusterTrainer(
            file_path=iris_csv,
            algorithms=["K-Means", "Not Real"],
            n_clusters=3,
        )
        summary = trainer.run()
        assert summary["summary"]["algorithms_run"] == 1

    def test_progress_callback(self, iris_csv):
        events = []
        trainer = ClusterTrainer(
            file_path=iris_csv,
            algorithms=["K-Means"],
            n_clusters=3,
            progress_callback=lambda e: events.append(e),
        )
        trainer.run()
        assert len(events) >= 2


class TestAnomalyTrainer:
    def test_isolation_forest_iris(self, iris_csv):
        trainer = AnomalyTrainer(
            file_path=iris_csv,
            detectors=["Isolation Forest"],
            contamination=0.05,
        )
        summary = trainer.run()
        assert summary["summary"]["detectors_run"] == 1
        assert summary["summary"]["rows_analyzed"] == 150
        result = summary["results"][0]
        assert result["detector"] == "Isolation Forest"
        assert result["status"] == "completed"
        assert len(result["scores"]) == 150
        assert len(result["anomaly_labels"]) == 150
        assert len(result["points"]) == 150
        assert result["n_flagged"] >= 0
        assert "normal" in result["profiles"]
        assert "flagged" in result["profiles"]

    def test_unknown_detector_filtered(self, iris_csv):
        trainer = AnomalyTrainer(
            file_path=iris_csv,
            detectors=["Isolation Forest", "Not Real"],
        )
        summary = trainer.run()
        assert summary["summary"]["detectors_run"] == 1
