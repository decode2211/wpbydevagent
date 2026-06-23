import httpx
import asyncio
from config import settings

async def test():
    headers = {
        "Authorization": f"Bearer {settings.META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": "919810248310",
        "type": "text",
        "text": {"body": "test"}
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://graph.facebook.com/v20.0/{settings.META_PHONE_NUMBER_ID}/messages",
            headers=headers,
            json=data
        )
        print(r.status_code)
        print(r.text)

asyncio.run(test())