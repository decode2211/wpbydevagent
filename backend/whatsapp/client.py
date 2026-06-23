"""
WhatsApp Cloud API client.
Handles reading status updates, sending text, images, documents, and typing indicators.
Includes automatic mock fallback for local testing when API credentials are not provided.
"""

import logging
import uuid
import httpx
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """
    Client for interacting with the Meta WhatsApp Cloud API (Graph API v20.0).
    Automatically mocks requests if API credentials are not set.
    """
    def __init__(self, phone_number_id: Optional[str] = None, access_token: Optional[str] = None):
        self.phone_number_id = phone_number_id or settings.META_PHONE_NUMBER_ID
        self.access_token = access_token or settings.META_ACCESS_TOKEN
        self.base_url = f"https://graph.facebook.com/v20.0/{self.phone_number_id}/messages"

        # Determine if we should run in Mock mode
        self.is_mocked = not (self.phone_number_id and self.access_token and "your_" not in self.access_token)
        if self.is_mocked:
            logger.warning(
                "WhatsApp API credentials missing or using placeholders. "
                "WhatsAppClient is running in SIMULATION/MOCK mode."
            )

    def _get_headers(self) -> dict:
        """Returns authentication headers for Meta Graph API."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    async def _send_request(self, payload: dict) -> dict:
        """Sends an async POST request to the Graph API with automatic retries on 5xx only."""
        if self.is_mocked:
            logger.info(f"[SIMULATED WHATSAPP OUTBOUND] Payload: {payload}")
            return {
                "messaging_product": "whatsapp",
                "contacts": [{"input": payload.get("to"), "wa_id": payload.get("to")}],
                "messages": [{"id": f"wamid.HBgL{uuid.uuid4().hex[:16].upper()}="}]
            }

        async with httpx.AsyncClient() as client:
            for attempt in range(3):  # Retry loop for 5xx errors only
                try:
                    response = await client.post(
                        self.base_url,
                        json=payload,
                        headers=self._get_headers(),
                        timeout=10.0
                    )

                    # 4xx errors: fail immediately, no retry
                    if 400 <= response.status_code < 500:
                        response.raise_for_status()

                    # 5xx errors: retry up to 3 times
                    if response.status_code >= 500:
                        logger.warning(f"Meta API 5xx error (Attempt {attempt+1}): {response.text}")
                        if attempt == 2:
                            response.raise_for_status()
                        continue

                    response.raise_for_status()
                    return response.json()

                except httpx.HTTPStatusError:
                    raise  # Re-raise immediately for 4xx, already handled above
                except httpx.HTTPError as e:
                    logger.error(f"HTTP error during WhatsApp send: {e}")
                    if attempt == 2:
                        raise e

    async def mark_as_read(self, message_id: str) -> None:
        """Marks an inbound message as read."""
        if self.is_mocked:
            logger.info(f"[SIMULATED WHATSAPP] Message {message_id} marked as read.")
            return

        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        await self._send_request(payload)

    async def send_typing_indicator(self, to: str) -> None:
        """
        Sends a typing indicator to the user (auto-expires after 25s).
        Silently ignored if unsupported (e.g. Meta test numbers return 400).
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "typing_indicator",
            "typing_indicator": {
                "type": "text"
            }
        }
        try:
            await self._send_request(payload)
        except Exception:
            logger.debug("Typing indicator not supported (likely test number) — skipping.")

    async def send_text(self, to: str, body: str) -> str:
        """Sends a text message with markdown support. Returns the message ID (wamid)."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "body": body
            }
        }
        result = await self._send_request(payload)
        return result["messages"][0]["id"]

    async def send_image(self, to: str, image_url: str, caption: str = "") -> str:
        """Sends an image message via direct link. Returns the message ID (wamid)."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "image",
            "image": {
                "link": image_url,
                "caption": caption
            }
        }
        result = await self._send_request(payload)
        return result["messages"][0]["id"]

    async def send_document(self, to: str, document_url: str, filename: str, caption: str = "") -> str:
        """Sends a document (e.g. PDF) via direct link. Returns the message ID (wamid)."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "document",
            "document": {
                "link": document_url,
                "filename": filename,
                "caption": caption
            }
        }
        result = await self._send_request(payload)
        return result["messages"][0]["id"]