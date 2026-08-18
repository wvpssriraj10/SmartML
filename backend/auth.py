"""Self-contained auth: PBKDF2 password hashing + HMAC-signed bearer tokens.

Deliberately dependency-free (stdlib only) so the free-tier backend doesn't
need extra packages. Secrets come from the SMARTML_SECRET env var, falling back
to a per-install secret file so tokens stay valid across restarts.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

_PBKDF2_ITERATIONS = 210_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _secret():
    env = os.getenv("SMARTML_SECRET")
    if env:
        return env.encode("utf-8")
    secret_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".secret.key")
    if os.path.exists(secret_file):
        with open(secret_file, "r", encoding="utf-8") as f:
            return f.read().strip().encode("utf-8")
    key = secrets.token_hex(32)
    try:
        with open(secret_file, "w", encoding="utf-8") as f:
            f.write(key)
    except Exception:
        pass
    return key.encode("utf-8")


def hash_password(password: str) -> str:
    """Return 'pbkdf2$iterations$salt_hex$hash_hex'."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "pbkdf2${}${}${}".format(
        _PBKDF2_ITERATIONS,
        salt.hex(),
        digest.hex(),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, hash_hex = stored.split("$")
        if scheme != "pbkdf2":
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(digest, expected)
    except (ValueError, TypeError):
        return False


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def create_token(user_id: str) -> str:
    payload = {"uid": user_id, "exp": int(time.time()) + _TOKEN_TTL_SECONDS}
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(token: str) -> str | None:
    """Return the user_id if the token is valid and unexpired, else None."""
    try:
        body, sig = token.split(".", 1)
        expected = _b64encode(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, sig):
            return None
        payload = json.loads(_b64decode(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("uid")
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
