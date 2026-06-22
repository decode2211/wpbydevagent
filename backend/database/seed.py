"""
Seeding script to initialize tenant configuration documents in MongoDB.
Defines system prompts, personality guides, and media assets for LuxFurn and AutoCare.
"""

import logging
from datetime import datetime
from database.connection import get_collection
from database.models import Tenant

logger = logging.getLogger(__name__)

TENANTS_SEED_DATA = [
    {
        "tenant_id": "tenant_luxfurn",
        "name": "LuxFurn",
        "system_prompt": (
            "You are a sophisticated, warm, and highly professional sales & design assistant "
            "for LuxFurn, a premier luxury furniture store. Your goal is to guide clients "
            "through selecting high-end furniture, answering design queries, and sharing product assets.\n"
            "Personality Guidelines:\n"
            "- Speak in an upscale, warm, elegant, and inviting tone.\n"
            "- Always be helpful, courteous, and detailed when discussing design and materials.\n"
            "- If the customer asks for a product catalog, brochure, or specific furniture images, "
            "use the `fetch_media_asset` tool with keywords like 'catalog', 'brochure', 'sofa', or 'armchair' "
            "to retrieve and send the official asset URL.\n"
            "- Never make up asset links; use the asset finder tool instead.\n"
            "- Keep replies moderately detailed, elegant, and polished."
        ),
        "media_library": {
            "catalog": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",  # Dummy PDF for catalog
            "brochure": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",  # Dummy PDF for brochure
            "sofa": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",  # Unsplash Sofa image
            "armchair": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80"  # Unsplash Chair image
        }
    },
    {
        "tenant_id": "tenant_autocare",
        "name": "AutoCare",
        "system_prompt": (
            "You are a direct, professional, and efficiency-focused scheduling & service advisor "
            "for AutoCare, a premier automotive service center. Your goal is to assist customers with "
            "booking appointments, requesting invoices, or reviewing repair details.\n"
            "Personality Guidelines:\n"
            "- Speak in a concise, direct, clear, and highly professional manner.\n"
            "- Avoid overly flowery language; get straight to the facts.\n"
            "- If the customer asks for an invoice, a checklist, or repair diagrams, "
            "use the `fetch_media_asset` tool with keywords like 'invoice', 'diagram', 'services', or 'brake_check' "
            "to retrieve and send the official asset URL.\n"
            "- Never make up asset links; use the asset finder tool instead.\n"
            "- Focus on answering automotive concerns, service offerings, and pricing."
        ),
        "media_library": {
            "invoice": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",  # Dummy PDF for invoice
            "services": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",  # Dummy PDF for services
            "diagram": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",  # Engine room photo
            "brake_check": "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80"  # Brake component photo
        }
    }
]


async def seed_tenants() -> None:
    """
    Seeds/upserts Tenant A and Tenant B documents in the MongoDB database.
    Ensures the system prompts and media asset links are loaded on app startup.
    """
    logger.info("Starting database seeding...")
    try:
        collection = get_collection("tenants")

        for data in TENANTS_SEED_DATA:
            # We use update_one with upsert=True to prevent duplicates and keep data current
            result = await collection.update_one(
                {"tenant_id": data["tenant_id"]},
                {
                    "$set": {
                        "name": data["name"],
                        "system_prompt": data["system_prompt"],
                        "media_library": data["media_library"],
                        "updated_at": datetime.utcnow()
                    },
                    "$setOnInsert": {
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            if result.matched_count > 0:
                logger.info(f"Updated tenant: {data['name']}")
            else:
                logger.info(f"Inserted new tenant: {data['name']}")

        logger.info("Database seeding completed successfully.")
    except Exception as e:
        logger.error(f"Failed to seed tenants into database: {e}")
        # We don't raise here to allow the server to start even if DB fails,
        # but in production, we should handle this carefully.
