from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import excel_router

app = FastAPI(
    title="API Analyse Statistique",
    description="API pour l'analyse de fichiers Excel",
    version="1.0.0"
)

# Configuration CORS pour Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.11:3000",
    ],  # Frontend Next.js en local et sur le réseau local
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.[0-9]{1,3}\.[0-9]{1,3}):3000",
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
