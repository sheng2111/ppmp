import os


class Settings:
    MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "ppmp_system")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ppmp-secret-key-change-in-production")


settings = Settings()
