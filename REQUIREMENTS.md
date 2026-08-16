# PPMP System — Requirements

This document lists every dependency required to run the **frontend** and **backend** of the PPMP System, with the exact pinned versions that are known to work together (taken from the currently installed, verified environment).

---

## System Requirements

| Tool | Minimum Version |
|------|-----------------|
| Python | 3.13+ (3.13.12 verified) |
| Node.js | 20+ (required by Vite 8) |
| MongoDB | 4.4+ (default: `mongodb://localhost:27017`) |
| npm | 10+ |

---

## Backend — Python (FastAPI)

Location: `backend/requirements.txt`

```text
fastapi==0.136.3
uvicorn[standard]==0.49.0
beanie==1.25.0
motor==3.3.2
pymongo==4.6.1
python-dotenv==1.2.2
python-multipart==0.0.32
openpyxl==3.1.5
reportlab==5.0.0
pydantic==2.13.4
```

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.136.3 | Web framework / API |
| uvicorn[standard] | 0.49.0 | ASGI server (`run.py`) |
| beanie | 1.25.0 | Async ODM on top of Motor (MongoDB documents) |
| motor | 3.3.2 | Async MongoDB driver |
| pymongo | 4.6.1 | MongoDB driver / `bson.ObjectId` |
| python-dotenv | 1.2.2 | Loads `.env` configuration |
| python-multipart | 0.0.32 | File uploads (`UploadFile`) / form parsing |
| openpyxl | 3.1.5 | Excel `.xlsx` export |
| reportlab | 5.0.0 | PDF export |
| pydantic | 2.13.4 | Validation / schemas (required by FastAPI + Beanie) |

### Install

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Linux/macOS
pip install -r requirements.txt
cp .env.example .env         # then edit MONGO_URL / DB_NAME / SECRET_KEY
python run.py                # API at http://localhost:8000
```

### Environment variables (`.env`)

```ini
MONGO_URL=mongodb://localhost:27017
DB_NAME=ppmp_system
SECRET_KEY=your-very-secret-key-change-this
```

---

## Backend — Node (legacy/optional)

Location: `backend/package.json` — only used if legacy JS export helpers are kept; the active Excel/PDF exports are implemented in Python (openpyxl/reportlab).

```json
{
  "dependencies": {
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.8",
    "xlsx": "^0.18.5"
  }
}
```

| Package | Version | Purpose |
|---------|---------|---------|
| jspdf | ^4.2.1 | PDF generation (JS) |
| jspdf-autotable | ^5.0.8 | PDF tables (JS) |
| xlsx | ^0.18.5 | Spreadsheet parsing (JS) |

### Install (only if needed)

```bash
cd backend
npm install
```

---

## Frontend — React (TypeScript + Vite)

Location: `frontend/package.json` — exact versions below are what is locked and verified in `frontend/package-lock.json`.

### Runtime dependencies

```json
{
  "@supabase/supabase-js": "2.108.2",
  "@tailwindcss/vite": "4.3.1",
  "axios": "1.18.1",
  "exceljs": "4.4.0",
  "file-saver": "2.0.5",
  "jspdf": "4.2.1",
  "jspdf-autotable": "5.0.8",
  "lucide-react": "1.23.0",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "react-router-dom": "7.18.0",
  "recharts": "3.9.2",
  "tailwindcss": "4.3.1",
  "xlsx": "0.18.5"
}
```

| Package | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | 2.108.2 | Supabase Auth |
| @tailwindcss/vite | 4.3.1 | Tailwind CSS Vite plugin |
| axios | 1.18.1 | HTTP client for the API |
| exceljs | 4.4.0 | Excel export on the client |
| file-saver | 2.0.5 | Save generated files |
| jspdf | 4.2.1 | PDF export on the client |
| jspdf-autotable | 5.0.8 | PDF tables on the client |
| lucide-react | 1.23.0 | Icons |
| react | 19.2.7 | UI framework |
| react-dom | 19.2.7 | React DOM renderer |
| react-router-dom | 7.18.0 | Routing |
| recharts | 3.9.2 | Dashboard charts |
| tailwindcss | 4.3.1 | Styling |
| xlsx | 0.18.5 | Spreadsheet handling on the client |

### Development dependencies

```json
{
  "@types/file-saver": "2.0.7",
  "@types/node": "24.13.2",
  "@types/react": "19.2.17",
  "@types/react-dom": "19.2.3",
  "@vitejs/plugin-react": "6.0.3",
  "oxlint": "1.71.0",
  "typescript": "6.0.3",
  "vite": "8.1.0"
}
```

| Package | Version | Purpose |
|---------|---------|---------|
| @types/file-saver | 2.0.7 | TypeScript types |
| @types/node | 24.13.2 | TypeScript types |
| @types/react | 19.2.17 | TypeScript types |
| @types/react-dom | 19.2.3 | TypeScript types |
| @vitejs/plugin-react | 6.0.3 | Vite React plugin |
| oxlint | 1.71.0 | Linter (`npm run lint`) |
| typescript | 6.0.3 | TypeScript compiler |
| vite | 8.1.0 | Dev server / bundler |

### Install

```bash
cd frontend
npm install
npm run dev          # app at http://localhost:5173
npm run build        # production build
npm run lint         # lint check
```

---

## Quick verification

```bash
# Backend
cd backend && pip install -r requirements.txt && python -c "import app.main"

# Frontend
cd frontend && npm install && npm run build
```
