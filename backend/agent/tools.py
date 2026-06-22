"""
Tools for the LangGraph agent.
Implements the fetch_media_asset tool used by the LLM to retrieve catalog PDFs, invoices, and showroom photos.
"""

from contextvars import ContextVar
from typing import Dict
from langchain_core.tools import tool

# ContextVar to thread-safely pass the current tenant's media library to the tool execution
active_media_library: ContextVar[Dict[str, str]] = ContextVar("active_media_library", default={})


@tool
def fetch_media_asset(keyword: str) -> dict:
    """
    Fetch the URL and metadata of an official tenant media asset (PDF or Image) by keyword.
    Use this tool whenever the customer requests a catalog, brochure, invoice, price list,
    showroom photo, repair diagram, or brake inspection sheet.
    
    Keywords: 'catalog', 'sofa', 'armchair', 'brochure' (LuxFurn); 'invoice', 'diagram', 'services', 'brake_check' (AutoCare).
    """
    kw = keyword.lower().strip()
    media_lib = active_media_library.get()

    url = media_lib.get(kw)
    if not url:
        return {"error": f"Media asset with keyword '{keyword}' not found in tenant library."}

    # Detect if the asset is an image or a document (PDF) based on URL contents/extension
    # Defaults to document if it's not a common image extension
    is_image = any(url.lower().endswith(ext) or ext in url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"])
    asset_type = "image" if is_image else "document"

    # Provide a user-friendly filename based on keyword
    ext = "jpg" if asset_type == "image" else "pdf"
    filename = f"{kw}.{ext}"

    return {
        "url": url,
        "type": asset_type,
        "filename": filename
    }
