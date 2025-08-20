from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1️⃣ Définir la connexion PostgreSQL
DATABASE_URL = "postgresql://postgres:Ibou1324@localhost:5432/excel"

# 2️⃣ Créer l’engine SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    echo=True  # True = affiche les requêtes SQL pour debug
)

# 3️⃣ Créer une session pour interagir avec la DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4️⃣ Base pour déclarer les modèles
Base = declarative_base()


# 5️⃣ Dépendance FastAPI pour récupérer la session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
