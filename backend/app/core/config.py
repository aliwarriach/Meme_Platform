from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    test_database_url: str | None = None
    redis_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

    groq_api_key: str
    groq_model: str = "llama-3.1-8b-instant"

    # Comma-separated list of allowed origins. Defaults to Expo's local dev web ports;
    # override in .env with the real client origin(s) before any non-dev deployment.
    cors_allowed_origins: str = "http://localhost:8081,http://localhost:19006"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


settings = Settings()
