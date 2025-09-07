from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import excel_router
import os

app = FastAPI(
    title="API Analyse Statistique",
    description="API pour l'analyse de fichiers Excel",
    version="1.0.0"
)

# Configuration CORS (pilotée par variable d'environnement)
origins_env = os.getenv("BACKEND_ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]

# Optionnel: autoriser via regex (utile pour les URLs preview Vercel)
origin_regex = os.getenv("BACKEND_ALLOWED_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "API Analyse Statistique - Prêt !"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Inclusion du routeur Excel
app.include_router(excel_router.router)
