from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.services.database import init_db
from app.routers import auth, offices, items, ppmps, app_routes, pr_routes, expense_categories, signatory_settings
from app.routers import users
from app.routers import ppmp_consolidation
from app.routers import app_consolidation
from app.routers import fee_categories
from app.routers import reports_router  
from app.routers import notifications
from app.routers import admin_dashboard
from app.models.app_meta import AppMeta, AppSignatory

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="e-PMS API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(offices.router)
app.include_router(items.router)
app.include_router(ppmps.router)
app.include_router(app_routes.router)
app.include_router(pr_routes.router)
app.include_router(expense_categories.router)
app.include_router(ppmp_consolidation.router)
app.include_router(app_consolidation.router)
app.include_router(fee_categories.router)
app.include_router(reports_router.router)
app.include_router(signatory_settings.router)
app.include_router(notifications.router)
app.include_router(admin_dashboard.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"message": "e-PMS API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}