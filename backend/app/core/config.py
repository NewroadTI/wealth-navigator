import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NewroadAI ERP"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://admin:securepassword123@db:5432/wealthroad")

    class Config:
        case_sensitive = True

settings = Settings()