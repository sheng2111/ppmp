from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import User, Office, Item, PPMP, PPMPProject, PPMPLot, APP, APPItem, PurchaseRequest, PRItem
from app.routers import auth, offices, items, ppmps
from app.routers import auth, offices, items, ppmps, app_routes
from app.routers import auth, offices, items, ppmps, app_routes, pr_routes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="e-PMS API", version="1.0.0")

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

@app.get("/")
def root():
    return {"message": "e-PMS API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
