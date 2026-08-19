import json

import pytest

import backend.database as db


@pytest.fixture
def fresh_db(monkeypatch, tmp_path):
    """Point the database layer at a throwaway SQLite file."""
    test_db = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB", "sqlite")
    monkeypatch.setattr(db, "DB_PATH", str(test_db))
    db.init_db()
    yield db


class TestDatasets:
    def test_create_and_get(self, fresh_db):
        fresh_db.create_dataset("d1", "iris", "iris.csv", "/tmp/iris.csv", file_size=10, row_count=150, col_count=5)
        row = fresh_db.get_dataset("d1")
        assert row["id"] == "d1"
        assert row["name"] == "iris"
        assert row["status"] == "in_progress"
        assert row["row_count"] == 150
        assert row["cleaning_pipeline"] == "[]"

    def test_get_missing_returns_none(self, fresh_db):
        assert fresh_db.get_dataset("nope") is None

    def test_update_dataset(self, fresh_db):
        fresh_db.create_dataset("d1", "iris", "iris.csv", "/tmp/iris.csv")
        fresh_db.update_dataset("d1", status="cleaned", row_count=149)
        row = fresh_db.get_dataset("d1")
        assert row["status"] == "cleaned"
        assert row["row_count"] == 149

    def test_inspection_data_roundtrip(self, fresh_db):
        inspection = {"rows": 150, "columns": 5}
        fresh_db.create_dataset("d1", "iris", "iris.csv", "/tmp/iris.csv", inspection_data=inspection)
        row = fresh_db.get_dataset("d1")
        assert json.loads(row["inspection_data"]) == inspection

    def test_list_datasets_ordered(self, fresh_db):
        fresh_db.create_dataset("d1", "old", "old.csv", "/tmp/old.csv")
        fresh_db.update_dataset("d1", status="cleaned")
        fresh_db.create_dataset("d2", "new", "new.csv", "/tmp/new.csv")
        rows = fresh_db.list_datasets()
        assert rows[0]["id"] == "d2"

    def test_delete_dataset_cascades_jobs(self, fresh_db):
        fresh_db.create_dataset("d1", "iris", "iris.csv", "/tmp/iris.csv")
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv", dataset_id="d1")
        fresh_db.delete_dataset("d1")
        assert fresh_db.get_dataset("d1") is None
        assert fresh_db.get_job("j1") is None


class TestJobs:
    def test_create_and_get(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        row = fresh_db.get_job("j1")
        assert row["id"] == "j1"
        assert row["status"] == "uploaded"

    def test_update_job(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        fresh_db.update_job("j1", status="completed", results=json.dumps([{"model_name": "x"}]))
        row = fresh_db.get_job("j1")
        assert row["status"] == "completed"
        assert json.loads(row["results"]) == [{"model_name": "x"}]

    def test_append_log_sets_updated_at(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        fresh_db.append_job_log("j1", "hello", "info")
        row = fresh_db.get_job("j1")
        logs = json.loads(row["logs"])
        assert len(logs) == 1
        assert logs[0]["message"] == "hello"
        assert logs[0]["level"] == "info"
        assert row["updated_at"] >= row["created_at"]

    def test_append_log_with_progress(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        fresh_db.append_job_log("j1", "training", "info", {"percent": 50})
        row = fresh_db.get_job("j1")
        assert json.loads(row["progress"]) == {"percent": 50}

    def test_logs_bounded_to_100(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        for i in range(150):
            fresh_db.append_job_log("j1", f"msg {i}", "info")
        row = fresh_db.get_job("j1")
        assert len(json.loads(row["logs"])) == 100


class TestCancellation:
    def test_cancel_defaults_to_zero(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        assert fresh_db.is_cancelled("j1") is False

    def test_request_cancel_sets_flag(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/iris.csv", "iris.csv")
        fresh_db.request_cancel("j1")
        assert fresh_db.is_cancelled("j1") is True

    def test_is_cancelled_missing_job(self, fresh_db):
        assert fresh_db.is_cancelled("nope") is False
