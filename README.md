# PPMP System — Project Procurement Management Plan

A full-stack web system for managing PPMPs (as used in Philippine gov/academic procurement under RA 9184).

---

## 🗂️ Project Structure

```
ppmp-system/
├── frontend/          ← React + TypeScript + Tailwind CSS
│   └── src/
│       ├── types/         ← TypeScript interfaces (PPMP, PPMPItem, etc.)
│       ├── services/      ← Axios API calls (api.ts)
│       ├── context/       ← Auth state (AuthContext.tsx)
│       ├── pages/         ← Dashboard, PPMPForm, PPMPDetail, PPMPList
│       └── components/
│           └── layout/    ← Sidebar + Layout wrapper
│
└── backend/           ← Python FastAPI + SQLAlchemy
    └── app/
        ├── main.py        ← FastAPI app entry point
        ├── database.py    ← SQLAlchemy setup
        ├── core/          ← Config (JWT settings, DB URL)
        ├── models/        ← SQLAlchemy ORM models
        ├── routers/       ← API routes (auth, ppmp)
        └── exports/       ← Excel export with openpyxl
```

---

## 🚀 Setup Instructions

### Backend (Python + FastAPI)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and edit env file
cp .env.example .env

# Run the server
python run.py
# → API available at http://localhost:8000
# → Swagger docs at http://localhost:8000/docs
```

### Frontend (React + TypeScript)

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:8000" > .env

# Start development server
npm start
# → App available at http://localhost:3000
```

---

## 🗄️ Database

Default: **SQLite** (zero config, file `ppmp.db` auto-created)

To switch to **PostgreSQL**:
1. Edit `.env`: `DATABASE_URL=postgresql://user:password@localhost/ppmp_db`
2. Create the database in PostgreSQL
3. Restart backend (tables auto-created via SQLAlchemy)

---

## 🔐 First Time Setup

1. Start backend
2. Register a user via Swagger UI (`POST /auth/register`) or the register form
3. Login at `http://localhost:3000/login`

---

## 📋 Features

| Feature | Status |
|---------|--------|
| User login / JWT auth | ✅ |
| Create PPMP with header | ✅ |
| Add/edit/delete items | ✅ |
| Monthly schedule (Qty + Amount) | ✅ |
| Auto-compute totals (Q1/Q2/Q3) | ✅ |
| Export to Excel (.xlsx) | ✅ |
| Dashboard with stats | ✅ |
| Revision tracking | ✅ |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| State | React Context + TanStack Query |
| Backend | Python 3 + FastAPI |
| ORM | SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (python-jose) + bcrypt |
| Excel Export | openpyxl |
| API Client | Axios |

---

## 📄 Next Steps to Build

1. **PPMPList page** — table of all PPMPs with search/filter
2. **PPMPForm page** — form to create/edit PPMP + items with monthly schedule grid
3. **PPMPDetail page** — read-only view + export buttons
4. **Database schema migration** — use Alembic for production
5. **Deployment** — Railway (backend) + Netlify/Vercel (frontend)
