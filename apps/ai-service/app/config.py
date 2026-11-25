import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for the NoctOwl AI Service."""

    service_name: str = os.getenv("AI_SERVICE_NAME", "ai-service")
    version: str = os.getenv("AI_SERVICE_VERSION", "0.1.0")
    log_level: str = os.getenv("LOG_LEVEL", "info")


settings = Settings()
