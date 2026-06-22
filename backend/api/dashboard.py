"""
FastAPI router for the dashboard management API.
Provides endpoints for retrieving tenant list, sessions, message threads, and sending broadcasts.
"""

import logging
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, BackgroundTasks, HTTPException

from database.connection import get_collection
from database.models import Tenant, ChatSession, MessageLog
from whatsapp.client import WhatsAppClient

logger = logging.getLogger(__name__)
router = APIRouter()


# =====================================================================
# Request / Response Schemas
# =====================================================================

class TenantListItem(BaseModel):
    id: str = Field(alias="tenant_id")
    name: str

    model_config = {"populate_by_name": True}


class SessionListItem(BaseModel):
    session_id: str
    tenant_id: str
    customer_phone: str
    status: str
    last_message_content: Optional[str] = None
    last_message_time: Optional[datetime] = None
    updated_at: datetime


class BroadcastRequest(BaseModel):
    tenant_id: str
    phone_numbers: List[str]
    template_message: str


# =====================================================================
# REST Endpoints
# =====================================================================

@router.get("/api/tenants", response_model=List[TenantListItem])
async def list_tenants():
    """Lists all available tenants (e.g. LuxFurn, AutoCare)."""
    try:
        collection = get_collection("tenants")
        cursor = collection.find({}, {"tenant_id": 1, "name": 1})
        tenants = await cursor.to_list(length=100)
        return tenants
    except Exception as e:
        logger.error(f"Error fetching tenants list: {e}")
        raise HTTPException(status_code=500, detail="Database error retrieving tenants")


@router.get("/api/tenants/{tenant_id}/sessions", response_model=List[SessionListItem])
async def list_tenant_sessions(tenant_id: str):
    """
    Returns all chat sessions active for a specific tenant.
    Attaches the last message preview text and timestamp for UI display.
    """
    try:
        sessions_col = get_collection("chat_sessions")
        logs_col = get_collection("message_logs")

        cursor = sessions_col.find({"tenant_id": tenant_id}).sort("updated_at", -1)
        sessions = await cursor.to_list(length=200)

        results = []
        for sess in sessions:
            # Query last message in this session to display as preview
            last_msg_cursor = logs_col.find(
                {"session_id": sess["session_id"]}
            ).sort("timestamp", -1).limit(1)
            
            last_msgs = await last_msg_cursor.to_list(length=1)
            
            preview = "No messages yet."
            msg_time = sess.get("updated_at")
            
            if last_msgs:
                msg = last_msgs[0]
                if msg.get("message_type") == "text":
                    preview = msg.get("content", "")
                elif msg.get("message_type") == "image":
                    preview = "📷 Image sent"
                elif msg.get("message_type") == "document":
                    preview = f"📄 Document: {msg.get('content') or 'File'}"
                elif msg.get("message_type") == "typing":
                    preview = "🤖 Bot is typing..."
                msg_time = msg.get("timestamp")

            results.append(
                SessionListItem(
                    session_id=sess["session_id"],
                    tenant_id=sess["tenant_id"],
                    customer_phone=sess["customer_phone"],
                    status=sess["status"],
                    last_message_content=preview,
                    last_message_time=msg_time,
                    updated_at=sess["updated_at"]
                )
            )

        return results
    except Exception as e:
        logger.error(f"Error listing sessions for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error retrieving sessions")


@router.get("/api/sessions/{session_id}/messages", response_model=List[MessageLog])
async def get_session_history(session_id: str):
    """
    Returns the complete chat thread history for a session, ordered chronologically.
    """
    try:
        logs_col = get_collection("message_logs")
        cursor = logs_col.find({"session_id": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=500)
        return messages
    except Exception as e:
        logger.error(f"Error fetching message logs for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error retrieving message log thread")


@router.post("/api/broadcast")
async def send_broadcast(payload: BroadcastRequest, background_tasks: BackgroundTasks):
    """
    Sends a template broadcast text message to multiple customer phone numbers.
    Runs dispatch processes in background task.
    """
    logger.info(f"Received broadcast request for tenant {payload.tenant_id} to {len(payload.phone_numbers)} recipients")
    
    # Verify tenant exists
    try:
        tenants_col = get_collection("tenants")
        tenant_exists = await tenants_col.find_one({"tenant_id": payload.tenant_id})
        if not tenant_exists:
            raise HTTPException(status_code=404, detail="Tenant not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking tenant validation for broadcast: {e}")
        raise HTTPException(status_code=500, detail="Database validation error")

    # Queue the sending task
    background_tasks.add_task(
        run_broadcast_pipeline, 
        payload.tenant_id, 
        payload.phone_numbers, 
        payload.template_message
    )
    
    return {"status": "accepted", "message": f"Broadcast queued for {len(payload.phone_numbers)} recipients"}


# =====================================================================
# Private Helper Task Pipeline
# =====================================================================

async def run_broadcast_pipeline(tenant_id: str, phone_numbers: List[str], message: str) -> None:
    """Dispatches broadcast messages to multiple numbers in the background."""
    client = WhatsAppClient()
    logs_col = get_collection("message_logs")
    sessions_col = get_collection("chat_sessions")

    for phone in phone_numbers:
        phone_stripped = phone.strip()
        if not phone_stripped:
            continue

        session_id = f"{tenant_id}_{phone_stripped}"
        logger.info(f"Sending broadcast out to: {phone_stripped} (Session: {session_id})")

        try:
            # 1. Send via WhatsApp
            wamid = await client.send_text(phone_stripped, message)

            # 2. Log outbound in message logs
            log_entry = MessageLog(
                session_id=session_id,
                tenant_id=tenant_id,
                direction="outbound",
                sender="bot",
                message_type="text",
                content=message,
                wamid=wamid,
                timestamp=datetime.utcnow()
            )
            await logs_col.insert_one(log_entry.model_dump(by_alias=True))

            # 3. Create or update session status to RESOLVED since it's a broadcast message
            await sessions_col.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "status": "RESOLVED",
                        "updated_at": datetime.utcnow()
                    },
                    "$setOnInsert": {
                        "tenant_id": tenant_id,
                        "customer_phone": phone_stripped,
                        "context": {},
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to dispatch broadcast item to {phone_stripped}: {e}")
