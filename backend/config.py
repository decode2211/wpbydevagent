"""
Configuration management for the WhatsApp AI Support & Sales Agent backend.
Parses environment variables and handles setup defaults.
"""

import json
from typing import Dict, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App Settings
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    # Meta / WhatsApp API Credentials
    META_ACCESS_TOKEN: Optional[str] = None
    META_PHONE_NUMBER_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    WEBHOOK_VERIFY_TOKEN: Optional[str] = None

    # Phone Number to Tenant Mapping JSON string
    # E.g. {"1234567890": "tenant_luxfurn", "0987654321": "tenant_autocare"}
    PHONE_NUMBER_TENANT_MAP: str = "{}"

    # LLM Configuration
    LLM_PROVIDER: str = "groq"  # 'groq', 'anthropic', 'openai' or 'mock'
    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Database Settings
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "whatsapp_agent"

    @property
    def parsed_phone_number_tenant_map(self) -> Dict[str, str]:
        """Parses the JSON string mapping phone number IDs to tenant IDs."""
        try:
            return json.loads(self.PHONE_NUMBER_TENANT_MAP)
        except json.JSONDecodeError:
            return {}


settings = Settings()
