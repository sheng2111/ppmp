# Deploying the Backend to Render (Web Service)

This guide deploys the FastAPI backend to [Render](https://render.com) as a **Web Service**. The repo already contains the deployment files (`render.yaml` blueprint, `backend/runtime.txt`, pinned `requirements.txt`).

---

## 1. Prerequisites

- A GitHub account with this repository pushed to it.
- A MongoDB database. Two easy options:
  - **[MongoDB Atlas](https://www.mongodb.com/atlas)** (free M0 tier) — copy the connection string (`mongodb+srv://user:pass@cluster/...`).
  - **Render Managed MongoDB** — create it in Render, then copy its Internal Database URL.
- The frontend deployed URL (e.g. `https://ppmp-mauve.vercel.app`) for CORS.

> ⚠️ Before pushing to GitHub, make sure `.env` files are **not** committed. They were removed from tracking and `.gitignore` now excludes them — but if your repo was ever public with a `.env`, **rotate those keys** (Supabase, MongoDB) now.

---

## 2. Push to GitHub

```bash
cd "C:\OJT files\ppmp-system"
git add -A
git commit -m "Prepare backend for Render deployment"
git remote add origin https://github.com/<your-username>/ppmp-system.git   # first time only
git branch -M main
git push -u origin main
```

---

## 3. Deploy via Blueprint (recommended — uses `render.yaml`)

1. Sign in to [Render](https://render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repo.
4. Render reads `render.yaml` and pre-fills the **ppmp-backend** web service:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check: `GET /health`
5. Render will ask for the value of `MONGO_URL` (marked `sync: false`) — paste your MongoDB connection string.
6. Click **Apply** and wait for the deploy. When the build succeeds, the service gets a URL like `https://ppmp-backend.onrender.com`.

---

## 4. Manual deploy (alternative)

1. **New +** → **Web Service** → connect repo.
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
3. **Environment variables** (under the *Environment* tab):

   | Key | Value |
   |-----|-------|
   | `MONGO_URL` | `mongodb+srv://...` (Atlas) or Render Mongo internal URL |
   | `DB_NAME` | `ppmp_system` |
   | `SECRET_KEY` | any long random string (generated automatically by the blueprint) |
   | `CORS_ORIGINS` | your frontend URL, e.g. `https://ppmp-mauve.vercel.app` |

4. Click **Create Web Service**, then **Deploy**.

---

## 5. Verify

- Open `https://<your-service>.onrender.com/health` → `{"status": "ok"}`
- Open `https://<your-service>.onrender.com/docs` → Swagger UI
- Test a CORS request from your deployed frontend. If the browser blocks it, set `CORS_ORIGINS` to the exact frontend origin (no trailing slash).

---

## 6. Notes

- **Free tier**: the instance sleeps after ~15 min of inactivity and takes a few seconds to wake on the first request. The built-in `/health` check keeps it warm on paid plans.
- **MongoDB access**: if using Atlas, allow access from anywhere (`0.0.0.0/0`) or add Render's outbound IPs so the service can connect.
- **Seeding / admin**: after the first successful boot, you can run one-off scripts against the same database locally (or via a temporary instance) to seed fee categories, PPMPS codes, etc.:
  ```bash
  cd backend
  python scripts/seed_fee_categories.py
  python scripts/seed_ppmps_codes.py
  python ensure_admin.py
  ```
- **Local development still works**: `python run.py` starts the API on `http://localhost:8000` with auto-reload; the CORS middleware always allows localhost.

---

## Environment variables used by the app

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGO_URL` | yes | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | no | `ppmp_system` | MongoDB database name |
| `SECRET_KEY` | no | dev default | Future token/session signing secret |
| `CORS_ORIGINS` | no | `https://ppmp-mauve.vercel.app` | Comma-separated allowed browser origins |
