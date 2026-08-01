import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OUTPUT = PUBLIC / "code.zip"

EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", ".venv-1",
    "autopilot_ai_21.preview.companyagent.com",
    "backend/__pycache__", "ml_engine/__pycache__",
    "uploads", "artifacts", "code/scripts"
}

EXCLUDE_FILES = {
    "smartml.db", "code.zip", "package-lock.json", "bun.lock"
}

EXCLUDE_EXT = {".pyc", ".pyo", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff2"}

def should_include(path: Path, root: Path) -> bool:
    rel = path.relative_to(root).as_posix()
    if path.name in EXCLUDE_FILES:
        return False
    if path.suffix in EXCLUDE_EXT:
        return False
    for d in EXCLUDE_DIRS:
        if d in rel.split("/"):
            return False
    return True

def create_zip():
    os.makedirs(PUBLIC, exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in ROOT.rglob("*"):
            if not file_path.is_file():
                continue
            if not should_include(file_path, ROOT):
                continue
            arcname = file_path.relative_to(ROOT).as_posix()
            zf.write(file_path, arcname)
            count += 1
    print(f"Created {OUTPUT} with {count} files ({OUTPUT.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    create_zip()
