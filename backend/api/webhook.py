"""
FastAPI router for WhatsApp webhook endpoints.
Handles challenge-response verification (GET) and incoming message payloads (POST) with signature validation.
"""

import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse

from config import settings
from agent.state import AgentState
from agent.graph import agent_graph
from database.connection import get_collection
from whatsapp.security import verify_webhook_signature

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/webhooks/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    Verification endpoint for Meta Webhook setup.
    Validates mode and token against local settings, and returns the challenge string.
    """
    logger.info(f"Received webhook verification request. Mode: {hub_mode}, Token: {hub_verify_token}")
    
    if hub_mode != "subscribe":
        logger.warning(f"Rejected verify webhook: Mode is not 'subscribe' ({hub_mode})")
        raise HTTPException(status_code=403, detail="Invalid hub.mode")

    if hub_verify_token != settings.WEBHOOK_VERIFY_TOKEN:
        logger.warning(f"Rejected verify webhook: Verify token mismatch ({hub_verify_token})")
        raise HTTPException(status_code=403, detail="Verification token mismatch")

    logger.info("Webhook verification succeeded.")
    return PlainTextResponse(content=hub_challenge)


@router.post("/api/webhooks/whatsapp")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None)
):
    """
    Receives incoming events from Meta (messages, status updates).
    Verifies payload signature, parsed details, sends immediate 200 OK response,
    and processes the agent chain in the background.
    """
    raw_body = await request.body()
    
    # 1. Validate Meta HMAC-SHA256 Signature (Skip if configured as development/mock bypass)
    # If app secret is missing or using placeholder, warn but bypass to allow local testing
    bypass_sig = not settings.META_APP_SECRET or "your_" in settings.META_APP_SECRET
    
    if not bypass_sig:
        if not x_hub_signature_256:
            logger.error("Missing X-Hub-Signature-256 header")
            raise HTTPException(status_code=403, detail="Missing signature header")
        if not verify_webhook_signature(raw_body, x_hub_signature_256, settings.META_APP_SECRET):
            logger.error("Signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
    else:
        logger.debug("Signature verification bypassed (running in mock/dev environment)")

    # 2. Parse payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse JSON body: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    logger.debug(f"Webhook payload: {payload}")

    # Meta webhook can be a status update (delivery, read receipts), not just messages.
    # We must handle and ignore updates that aren't incoming messages to prevent errors.
    entry = payload.get("entry", [])
    if not entry:
        return Response(status_code=200)
    
    changes = entry[0].get("changes", [])
    if not changes:
        return Response(status_code=200)
        
    value = changes[0].get("value", {})
    messages = value.get("messages", [])
    if not messages:
        # Check if it was a message status callback (read, delivered, sent)
        statuses = value.get("statuses", [])
        if statuses:
            logger.info(f"Received message status update: {statuses[0].get('status')} for ID {statuses[0].get('id')}")
        return Response(status_code=200)

    message = messages[0]
    customer_phone = message.get("from")
    message_id = message.get("id")
    message_type = message.get("type", "text")

    # Extract text content
    text = ""
    media_url = None

    if message_type == "text":
        text = message.get("text", {}).get("body", "")
    elif message_type == "image":
        text = message.get("image", {}).get("caption", "")
        # Store Meta image ID to retrieve later
        media_url = message.get("image", {}).get("id")
    elif message_type == "document":
        text = message.get("document", {}).get("caption", "")
        media_url = message.get("document", {}).get("id")
    else:
        logger.info(f"Ignoring unsupported message type: {message_type}")
        return Response(status_code=200)

    # 3. Determine Tenant based on recipient Phone ID mapping
    metadata = value.get("metadata", {})
    phone_number_id = metadata.get("phone_number_id")
    tenant_id = settings.parsed_phone_number_tenant_map.get(phone_number_id)

    if not tenant_id:
        # Fallback to Tenant A if mapping is not configured (helpful for simple testing)
        logger.warning(
            f"No tenant mapping found for phone_number_id: {phone_number_id}. "
            "Defaulting to 'tenant_luxfurn' for testing."
        )
        tenant_id = "tenant_luxfurn"

    logger.info(f"Incoming message from {customer_phone} mapped to tenant {tenant_id} (type: {message_type})")

    # 4. Return 200 OK immediately and spawn background runner
    background_tasks.add_task(run_agent, tenant_id, customer_phone, message_id, text, media_url)
    return Response(status_code=200)


async def run_agent(
    tenant_id: str,
    customer_phone: str,
    message_id: str,
    text: str,
    media_url: Optional[str] = None
) -> None:
    """Executes the LangGraph conversation pipeline asynchronously."""
    initial_state = AgentState(
        tenant_id=tenant_id,
        customer_phone=customer_phone,
        inbound_message_id=message_id,
        inbound_text=text,
        inbound_media_url=media_url,
        tenant_system_prompt="",
        tenant_media_library={},
        chat_history=[],
        session_id="",
        response_type="text",
        response_text="",
        media_url=None,
        media_filename=None,
        typing_sent=False,
        session_status=None,
        error=None
    )

    try:
        logger.info(f"Running LangGraph agent for session {tenant_id}_{customer_phone}...")
        await agent_graph.ainvoke(initial_state)
    except Exception as e:
        logger.error(f"Background agent execution failed: {e}")
        # Update session status to ERROR
        try:
            sessions_col = get_collection("chat_sessions")
            session_id = f"{tenant_id}_{customer_phone}"
            await sessions_col.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "status": "ERROR",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        except Exception as db_err:
            logger.error(f"Failed to log background error to DB: {db_err}")
