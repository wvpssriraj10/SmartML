import json

import pytest

import backend.database as db
from backend import auth


@pytest.fixture
def fresh_db(monkeypatch, tmp_path):
    test_db = tmp_path / "test_auth.db"
    monkeypatch.setattr(db, "DB", "sqlite")
    monkeypatch.setattr(db, "DB_PATH", str(test_db))
    db.init_db()
    yield db


class TestPasswordHashing:
    def test_hash_and_verify(self):
        h = auth.hash_password("hunter2")
        assert auth.verify_password("hunter2", h)
        assert not auth.verify_password("wrong", h)
        assert not auth.verify_password("hunter2", "not-a-hash")

    def test_salts_are_unique(self):
        assert auth.hash_password("same") != auth.hash_password("same")

    def test_verify_empty_password(self):
        h = auth.hash_password("hunter2")
        assert not auth.verify_password("", h)


class TestTokens:
    def test_roundtrip(self):
        token = auth.create_token("user-123")
        assert auth.verify_token(token) == "user-123"

    def test_tampered_token_rejected(self):
        token = auth.create_token("user-123")
        body, sig = token.split(".", 1)
        bad = body[:-2] + ("xx" if not body.endswith("xx") else "yy") + "." + sig
        assert auth.verify_token(bad) is None

    def test_garbage_rejected(self):
        assert auth.verify_token("") is None
        assert auth.verify_token("not.a.token") is None
        assert auth.verify_token("a.b.c") is None

    def test_different_users_distinct(self):
        assert auth.create_token("a") != auth.create_token("b")


class TestUserCrud:
    def test_create_and_get_by_email(self, fresh_db):
        assert fresh_db.create_user("u1", "a@b.com", auth.hash_password("pw1234"))
        user = fresh_db.get_user_by_email("a@b.com")
        assert user["id"] == "u1"
        assert user["email"] == "a@b.com"

    def test_duplicate_email_fails(self, fresh_db):
        assert fresh_db.create_user("u1", "a@b.com", "h")
        assert not fresh_db.create_user("u2", "a@b.com", "h")

    def test_get_by_id(self, fresh_db):
        fresh_db.create_user("u1", "a@b.com", "h", display_name="Alice")
        user = fresh_db.get_user_by_id("u1")
        assert user["display_name"] == "Alice"
        assert fresh_db.get_user_by_id("nope") is None


class TestUserScoping:
    def test_jobs_scoped_by_user(self, fresh_db):
        fresh_db.create_job("j1", "/tmp/a.csv", "a.csv", user_id="u1")
        fresh_db.create_job("j2", "/tmp/b.csv", "b.csv", user_id="u2")
        assert fresh_db.get_job("j1", user_id="u1") is not None
        assert fresh_db.get_job("j1", user_id="u2") is None
        assert fresh_db.get_job("j1") is not None  # unscoped still works
        assert len(fresh_db.list_jobs(10, user_id="u1")) == 1

    def test_datasets_scoped_by_user(self, fresh_db):
        fresh_db.create_dataset("d1", "a", "a.csv", "/tmp/a.csv", user_id="u1")
        fresh_db.create_dataset("d2", "b", "b.csv", "/tmp/b.csv", user_id="u2")
        assert fresh_db.get_dataset("d1", user_id="u1") is not None
        assert fresh_db.get_dataset("d1", user_id="u2") is None
        assert len(fresh_db.list_datasets(10, user_id="u1")) == 1

    def test_delete_scoped_only(self, fresh_db):
        fresh_db.create_dataset("d1", "a", "a.csv", "/tmp/a.csv", user_id="u1")
        fresh_db.create_job("j1", "/tmp/a.csv", "a.csv", dataset_id="d1", user_id="u1")
        fresh_db.delete_dataset("d1", user_id="u2")  # not owner -> no-op
        assert fresh_db.get_dataset("d1", user_id="u1") is not None
        fresh_db.delete_dataset("d1", user_id="u1")
        assert fresh_db.get_dataset("d1", user_id="u1") is None
