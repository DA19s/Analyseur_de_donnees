from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="API Analyse Statistique",
    description="API pour l'analyse de fichiers Excel",
    version="1.0.0"
)

# Configuration CORS pour Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Votre frontend Next.js
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