# SmartML Dashboard

This repository contains the SmartML dashboard frontend and backend components.

Structure
- `code/` — frontend (Vite + React)
- `backend/` — API, workers, and server
- `ml_engine/` — ML training and pipeline code
- `uploads/`, `artifacts/` — user files and model artifacts

Quick local setup

1. Install dependencies

- Node (recommended 18+)

```bash
# frontend
cd code
npm install

# optional: Python backend environment
cd ..
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Run frontend

```bash
cd code
npm run dev
```

3. Run backend (if applicable)

```bash
# from repo root
python -m backend.main  # or run your preferred launcher
```

Create a GitHub repository and push

- On GitHub: create a new repo (public or private).
- Locally:

```bash
# from repo root
git init
git add .
git commit -m "chore: initial repo"
# replace <REMOTE_URL> with your GitHub HTTPS/SSH url
git remote add origin <REMOTE_URL>
git branch -M main
git push -u origin main
```

CI (GitHub Actions)

We add a basic CI workflow that builds the frontend and runs tests (if present).

License

This project includes an `LICENSE` file (MIT) by default. Change as needed.

If you want, I can:
- Initialize the repo and push (you'll need to provide the remote URL or grant access)
- Create org/repo on GitHub using a token (you must provide a token)
- Add more workflows (linting, releases, publishing)
