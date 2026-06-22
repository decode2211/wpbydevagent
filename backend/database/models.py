"""
Pydantic database models for the MongoDB collections.
Includes Tenant, ChatSession, and MessageLog schemas with ObjectID mapping support.
"""

from datetime import datetime
from typing import Annotated, Dict, Optional
from pydantic import BaseModel, BeforeValidator, Field

# Custom type for handling MongoDB's ObjectId as string in Pydantic V2
PyObjectId = Annotated[str, BeforeValidator(str)]


class Tenant(BaseModel):
    """
    Model representing a tenant (e.g. LuxFurn or AutoCare).
    """
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    tenant_id: str  # e.g., "tenant_luxfurn"
    name: str  # e.g., "LuxFurn"
    system_prompt: str
    media_library: Dict[str, str]  # keyword -> public asset URL
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "tenant_id": "tenant_luxfurn",
                "name": "LuxFurn",
                "system_prompt": "You are a helpful luxury furniture support agent...",
                "media_library": {
                    "catalog": "https://example.com/luxfurn_catalog.pdf",
                    "sofa": "https://example.com/sofa.jpg"
                }
            }
        }
    }


class ChatSession(BaseModel):
    """
    Model representing an ongoing customer chat session.
    """
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    session_id: str  # f"{tenant_id}_{customer_phone}"
    tenant_id: str
    customer_phone: str
    status: str  # WAITING_FOR_BOT | AGENT_RESPONDING | RESOLVED | NEEDS_HUMAN | ERROR
    context: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "session_id": "tenant_luxfurn_+1234567890",
                "tenant_id": "tenant_luxfurn",
                "customer_phone": "+1234567890",
                "status": "WAITING_FOR_BOT",
                "context": {}
            }
        }
    }


class MessageLog(BaseModel):
    """
    Model representing a logged incoming or outgoing WhatsApp message.
    """
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    session_id: str
    tenant_id: str
    direction: str  # "inbound" | "outbound"
    sender: str  # Customer phone number or "bot"
    message_type: str  # "text" | "image" | "document" | "typing"
    content: str  # Text body or visual/file description
    media_url: Optional[str] = None
    media_mime_type: Optional[str] = None
    wamid: Optional[str] = None  # WhatsApp message ID
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "session_id": "tenant_luxfurn_+1234567890",
                "tenant_id": "tenant_luxfurn",
                "direction": "inbound",
                "sender": "+1234567890",
                "message_type": "text",
                "content": "Do you have any catalog for sofas?",
                "timestamp": "2026-06-22T12:00:00Z"
            }
        }
    }
