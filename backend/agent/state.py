"""
State representation for the LangGraph agent execution.
Defines the AgentState TypedDict which holds context across execution nodes.
"""

from typing import Dict, List, Optional, TypedDict


class AgentState(TypedDict):
    # Inbound context
    tenant_id: str
    customer_phone: str
    inbound_message_id: str
    inbound_text: str
    inbound_media_url: Optional[str]  # Populated if customer sent an image/media

    # Retrieved context
    tenant_system_prompt: str
    tenant_media_library: Dict[str, str]
    chat_history: List[Dict[str, str]]  # List of messages: [{"role": "user"|"assistant", "content": "..."}]
    session_id: str

    # LLM decision outputs
    response_type: str  # "text" | "image" | "document"
    response_text: str
    media_url: Optional[str]
    media_filename: Optional[str]

    # Tracking and Metadata
    typing_sent: bool
    session_status: Optional[str]  # e.g., "RESOLVED" or "NEEDS_HUMAN"
    error: Optional[str]
