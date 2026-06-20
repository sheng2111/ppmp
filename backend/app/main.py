from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import users_engine, ppmp_engine, UsersBase, PPMPBase
from .routers import auth, ppmp
from .database import users_engine, ppmp_engine, UsersBase, PPMPBase
# Create all DB tables

UsersBase.metadata.create_all(bind=users_engine)
PPMPBase.metadata.create_all(bind=ppmp_engine)

app = FastAPI(
    title="PPMP System API",
    description="Project Procurement Management Plan API",
    version="1.0.0"
)

# CORS - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000","http://192.168.2.2:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(ppmp.router, prefix="/ppmp", tags=["PPMP"])
@app.get("/")
def root():
    return {"message": "PPMP System API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
