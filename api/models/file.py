from sqlalchemy import Column, Integer, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    data = Column(JSONB)
