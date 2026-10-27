# Ajaia Docs

Lightweight collaborative document editor (Next.js + TypeScript frontend, FastAPI backend).

> Work in progress. Full README is written at the end.

## Layout

```
apps/web   Next.js (App Router, TypeScript, Tailwind)
apps/api   FastAPI (Python), SQLAlchemy, pytest
```

## Local setup

### API (http://localhost:8000)

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m app.seed          # creates tables + seeded users
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
.\.venv\Scripts\python -m pytest -q         # tests
```

macOS/Linux: use `.venv/bin/python` instead.

### Web (http://localhost:3000)

```powershell
cd apps/web
npm install
npm run dev
```

The web app proxies `/api/*` to `API_URL` (default `http://127.0.0.1:8000`).

## Seeded users

| Email | Name |
|---|---|
| alice@ajaia.test | Alice Anderson |
| bob@ajaia.test | Bob Brown |
| carol@ajaia.test | Carol Chen |
