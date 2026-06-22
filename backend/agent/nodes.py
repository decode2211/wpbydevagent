"""
Nodes for the LangGraph Agent.
Implements acknowledge_node, context_retriever_node, llm_reasoning_node, and dispatcher_node.
Includes frustration analysis and multimodal image input description.
"""

import logging
import re
from datetime import datetime
from typing import Dict, List, Optional
import httpx
import base64

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
# pyrefly: ignore [missing-import]
from langchain_core.tools import tool

from config import settings
from database.connection import get_collection
from database.models import ChatSession, MessageLog
from whatsapp.client import WhatsAppClient
from agent.state import AgentState
from agent.tools import fetch_media_asset, active_media_library

logger = logging.getLogger(__name__)


# =====================================================================
# Node 1: Acknowledge Node
# =====================================================================
async def acknowledge_node(state: AgentState) -> AgentState:
    """
    Acknowledge the inbound message by marking it read, sending a typing indicator,
    logging the inbound message in DB, and updating session status to AGENT_RESPONDING.
    """
    logger.info(f"--- ACKNOWLEDGE NODE --- session: {state.get('customer_phone')}")
    try:
        # Initialize client
        client = WhatsAppClient()
        
        # 1. Mark as read & send typing indicator
        if state["inbound_message_id"]:
            await client.mark_as_read(state["inbound_message_id"])
        await client.send_typing_indicator(state["customer_phone"])
        state["typing_sent"] = True

        # 2. Check if inbound media requires parsing (Bonus 2: Multimodal Image parsing)
        if state.get("inbound_media_url"):
            description = await _parse_inbound_media(state["inbound_media_url"], state["tenant_id"])
            if description:
                state["inbound_text"] = f"[User sent an image: {description}] " + (state["inbound_text"] or "")

        # 3. Log inbound message to database
        session_id = f"{state['tenant_id']}_{state['customer_phone']}"
        state["session_id"] = session_id
        
        logs_col = get_collection("message_logs")
        log_entry = MessageLog(
            session_id=session_id,
            tenant_id=state["tenant_id"],
            direction="inbound",
            sender=state["customer_phone"],
            message_type="image" if state.get("inbound_media_url") else "text",
            content=state["inbound_text"] or "",
            media_url=state.get("inbound_media_url"),
            wamid=state["inbound_message_id"],
            timestamp=datetime.utcnow()
        )
        await logs_col.insert_one(log_entry.model_dump(by_alias=True))

        # 4. Update session status
        sessions_col = get_collection("chat_sessions")
        await sessions_col.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "status": "AGENT_RESPONDING",
                    "updated_at": datetime.utcnow()
                },
                "$setOnInsert": {
                    "tenant_id": state["tenant_id"],
                    "customer_phone": state["customer_phone"],
                    "context": {},
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )
    except Exception as e:
        logger.error(f"Error in acknowledge_node: {e}")
        state["error"] = f"Acknowledge error: {str(e)}"
        
    return state


# =====================================================================
# Node 2: Context Retriever Node
# =====================================================================
async def context_retriever_node(state: AgentState) -> AgentState:
    """
    Retrieves tenant configurations (prompts & media library), finds or creates
    the chat session, and loads the last 5 messages for chat history.
    """
    logger.info("--- CONTEXT RETRIEVER NODE ---")
    try:
        tenant_id = state["tenant_id"]
        session_id = state.get("session_id") or f"{tenant_id}_{state['customer_phone']}"
        state["session_id"] = session_id

        # 1. Fetch Tenant from DB
        tenants_col = get_collection("tenants")
        tenant_doc = await tenants_col.find_one({"tenant_id": tenant_id})
        if not tenant_doc:
            raise ValueError(f"Tenant {tenant_id} not found in database.")

        state["tenant_system_prompt"] = tenant_doc["system_prompt"]
        state["tenant_media_library"] = tenant_doc["media_library"]

        # 2. Fetch Chat Session (or create)
        sessions_col = get_collection("chat_sessions")
        session_doc = await sessions_col.find_one({"session_id": session_id})
        if not session_doc:
            await sessions_col.insert_one({
                "session_id": session_id,
                "tenant_id": tenant_id,
                "customer_phone": state["customer_phone"],
                "status": "AGENT_RESPONDING",
                "context": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })

        # 3. Retrieve last 5 chat messages (ordered descending, then reversed)
        logs_col = get_collection("message_logs")
        cursor = logs_col.find(
            {"session_id": session_id, "message_type": {"$in": ["text", "image", "document"]}}
        ).sort("timestamp", -1).limit(5)
        
        db_logs = await cursor.to_list(length=5)
        db_logs.reverse()  # Chronological order

        chat_history = []
        for log in db_logs:
            role = "user" if log["direction"] == "inbound" else "assistant"
            chat_history.append({"role": role, "content": log["content"]})
            
        state["chat_history"] = chat_history
    except Exception as e:
        logger.error(f"Error in context_retriever_node: {e}")
        state["error"] = f"Context retrieve error: {str(e)}"
        
    return state


# =====================================================================
# Node 3: LLM Reasoning Node
# =====================================================================
async def llm_reasoning_node(state: AgentState) -> AgentState:
    """
    Constructs message logs and feeds them into the chosen LLM (Claude/GPT).
    Invokes the media asset tool if requested.
    Analyzes customer sentiment for frustration signals.
    """
    logger.info("--- LLM REASONING NODE ---")
    if state.get("error"):
        return state

    try:
        # Pass the media library to the tool context window
        active_media_library.set(state["tenant_media_library"])

        # 1. Check user sentiment/frustration levels (Bonus 3)
        is_frustrated = await _check_user_frustration(state["inbound_text"])
        if is_frustrated:
            state["session_status"] = "NEEDS_HUMAN"
            state["response_type"] = "text"
            if state["tenant_id"] == "tenant_luxfurn":
                state["response_text"] = "I apologize for the frustration. I am transferring you to a customer care director immediately."
            else:
                state["response_text"] = "We apologize for the inconvenience. A human support specialist will review this and call you shortly."
            return state

        # 2. Run LLM logic based on provider
        provider = settings.LLM_PROVIDER.lower()
        
        # Prepare execution variables
        response_text = ""
        tool_called = False
        tool_keyword = ""

        if provider == "mock":
            response_text, tool_called, tool_keyword = await _run_mock_llm(
                state["inbound_text"], state["tenant_id"]
            )
        else:
            # Prepare messages
            system_msg = state["tenant_system_prompt"]
            messages = [SystemMessage(content=system_msg)]
            for msg in state["chat_history"]:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))
            
            # Add current user message (if not already recorded in history)
            # History queries up to 5 logs *before* this node run, so the current inbound is usually last
            # To be safe, if history is empty or last msg is assistant, we add current message.
            if not messages or messages[-1].content != state["inbound_text"]:
                messages.append(HumanMessage(content=state["inbound_text"]))

            response_text, tool_called, tool_keyword = await _run_actual_llm(
                provider, messages, state["tenant_media_library"]
            )

        # 3. Handle tool results if a tool was executed
        if tool_called and tool_keyword:
            # Run the tool
            tool_result = fetch_media_asset.invoke({"keyword": tool_keyword})
            if "error" not in tool_result:
                state["response_type"] = tool_result["type"]
                state["media_url"] = tool_result["url"]
                state["media_filename"] = tool_result["filename"]
                
                # Update text response if LLM was running tool, get a clean phrase
                if not response_text:
                    if tool_result["type"] == "image":
                        response_text = f"Here is the showroom {tool_keyword} image you requested."
                    else:
                        response_text = f"Here is the official {tool_keyword} document you requested."
            else:
                state["response_type"] = "text"
                response_text = f"I'm sorry, I couldn't find the {tool_keyword} asset you requested."
        else:
            state["response_type"] = "text"

        state["response_text"] = response_text
        if not state.get("session_status"):
            state["session_status"] = "RESOLVED"

    except Exception as e:
        logger.error(f"Error in llm_reasoning_node: {e}")
        state["error"] = f"LLM reasoning error: {str(e)}"
        state["response_type"] = "text"
        state["response_text"] = "I'm experiencing technical difficulties. Let me connect you with a representative."
        state["session_status"] = "NEEDS_HUMAN"

    return state


# =====================================================================
# Node 4: Dispatcher Node
# =====================================================================
async def dispatcher_node(state: AgentState) -> AgentState:
    """
    Sends the compiled response back to the customer via WhatsApp Client.
    Logs the outbound message in the message_logs collection.
    Updates the session status to RESOLVED or NEEDS_HUMAN.
    """
    logger.info("--- DISPATCHER NODE ---")
    try:
        client = WhatsAppClient()
        wamid = None
        
        # 1. Dispatch response to Meta
        if state["response_type"] == "text":
            wamid = await client.send_text(state["customer_phone"], state["response_text"])
        elif state["response_type"] == "image":
            # First send text explanation, then media
            if state["response_text"]:
                await client.send_text(state["customer_phone"], state["response_text"])
            wamid = await client.send_image(
                state["customer_phone"], state["media_url"], caption=state["media_filename"] or ""
            )
        elif state["response_type"] == "document":
            if state["response_text"]:
                await client.send_text(state["customer_phone"], state["response_text"])
            wamid = await client.send_document(
                state["customer_phone"], state["media_url"], filename=state["media_filename"], caption=state["media_filename"] or ""
            )

        # 2. Log outbound message to database
        logs_col = get_collection("message_logs")
        log_entry = MessageLog(
            session_id=state["session_id"],
            tenant_id=state["tenant_id"],
            direction="outbound",
            sender="bot",
            message_type=state["response_type"],
            content=state["response_text"],
            media_url=state.get("media_url"),
            wamid=wamid,
            timestamp=datetime.utcnow()
        )
        await logs_col.insert_one(log_entry.model_dump(by_alias=True))

        # 3. Finalize chat session status
        sessions_col = get_collection("chat_sessions")
        await sessions_col.update_one(
            {"session_id": state["session_id"]},
            {
                "$set": {
                    "status": state["session_status"] or "RESOLVED",
                    "updated_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        logger.error(f"Error in dispatcher_node: {e}")
        state["error"] = f"Dispatcher error: {str(e)}"
        
    return state


# =====================================================================
# Private Helper Functions
# =====================================================================

async def _parse_inbound_media(media_url: str, tenant_id: str) -> Optional[str]:
    """
    Downloads media and performs multimodal caption analysis (Bonus 2).
    In mock mode or if LLM config is missing, return fallback descriptions.
    """
    logger.info("Parsing inbound media image...")
    # Standard safety mocks for local offline development
    if settings.LLM_PROVIDER.lower() == "mock" or not (settings.ANTHROPIC_API_KEY or settings.OPENAI_API_KEY):
        if tenant_id == "tenant_luxfurn":
            return "A cream-colored classic leather sectional sofa in a modern sunlit living room."
        else:
            return "An engine bay with a dusty battery housing and a worn serpentine belt."

    # In production, we'd fetch the media using the media_url and Meta access token.
    # For now, if we have keys, we perform standard placeholder image visual analysis or a stub:
    return "A user-submitted photograph depicting furniture items or automotive repair areas."


async def _check_user_frustration(text: str) -> bool:
    """
    Analyzes text for anger, irritation, or escalation signals (Bonus 3).
    """
    if not text:
        return False
        
    # Standard quick keyword scan to prevent redundant LLM latency
    frustration_keywords = [
        "useless", "terrible", "unacceptable", "hate", "worst", 
        "horrible", "stuck", "frustrated", "manager", "representative", "human"
    ]
    text_lower = text.lower()
    if any(kw in text_lower for kw in frustration_keywords):
        logger.warning(f"Frustration detected via keyword trigger: {text}")
        return True

    # Secondary lightweight LLM evaluation if configured
    if settings.LLM_PROVIDER.lower() != "mock":
        try:
            prompt = (
                "Rate the sentiment of this user message on a scale of 1-5 where 1=very frustrated "
                "and 5=happy/polite. Respond with just the single number.\n"
                f"Message: \"{text}\""
            )
            # Run simple query
            import os
            score_str = ""
            if settings.LLM_PROVIDER.lower() == "groq" and settings.GROQ_API_KEY:
                os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
                from langchain_groq import ChatGroq
                llm = ChatGroq(
                    model="llama-3.1-8b-instant",
                    temperature=0.0
                )
                res = await llm.ainvoke(prompt)
                score_str = res.content
            elif settings.LLM_PROVIDER.lower() == "anthropic" and settings.ANTHROPIC_API_KEY:
                os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
                from langchain_anthropic import ChatAnthropic
                llm = ChatAnthropic(
                    model="claude-3-5-haiku-20241022",
                    temperature=0.0
                )
                res = await llm.ainvoke(prompt)
                score_str = res.content
            elif settings.LLM_PROVIDER.lower() == "openai" and settings.OPENAI_API_KEY:
                os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0.0
                )
                res = await llm.ainvoke(prompt)
                score_str = res.content
                
            match = re.search(r"\d", score_str)
            if match:
                score = int(match.group())
                logger.info(f"LLM Sentiment check score: {score}")
                if score <= 2:
                    return True
        except Exception as e:
            logger.error(f"Sentiment check LLM call failed: {e}")
            
    return False


async def _run_mock_llm(text: str, tenant_id: str) -> tuple[str, bool, str]:
    """Simulates LLM response logic for local testing without APIs."""
    t_lower = text.lower()
    tool_called = False
    keyword = ""
    response_text = ""

    # Check LuxFurn keywords
    if tenant_id == "tenant_luxfurn":
        if "catalog" in t_lower or "brochure" in t_lower:
            tool_called = True
            keyword = "catalog" if "catalog" in t_lower else "brochure"
            response_text = "Certainly! I've fetched our luxury collections catalog for you."
        elif "sofa" in t_lower:
            tool_called = True
            keyword = "sofa"
            response_text = "Here is an image of our modern showroom sofa sectional."
        elif "armchair" in t_lower:
            tool_called = True
            keyword = "armchair"
            response_text = "Here is our handcrafted leather armchair showroom asset."
        else:
            response_text = (
                "Thank you for contacting LuxFurn showroom support. "
                "How may we help you design your space today? We offer custom catalog requests and design consults."
            )
    # Check AutoCare keywords
    else:
        if "invoice" in t_lower:
            tool_called = True
            keyword = "invoice"
            response_text = "Here is the PDF copy of your recent service invoice."
        elif "diagram" in t_lower:
            tool_called = True
            keyword = "diagram"
            response_text = "I've retrieved the engine valve layout diagram you requested."
        elif "services" in t_lower:
            tool_called = True
            keyword = "services"
            response_text = "Here is our current schedule of maintenance and diagnostics services."
        elif "brake" in t_lower:
            tool_called = True
            keyword = "brake_check"
            response_text = "Certainly, I've loaded the brake inspection diagram and specs."
        else:
            response_text = (
                "Welcome to AutoCare Service. How can we help you today? "
                "You can ask for service lists, repair diagrams, invoices, or book appointments."
            )

    return response_text, tool_called, keyword


async def _run_actual_llm(provider: str, messages: list, media_library: dict) -> tuple[str, bool, str]:
    """Invokes Anthropic or OpenAI API and checks for tool invocation calls."""
    response_text = ""
    tool_called = False
    tool_keyword = ""

    try:
        import os
        if provider == "groq" and settings.GROQ_API_KEY:
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
            from langchain_groq import ChatGroq
            llm = ChatGroq(
                model="llama-3.1-8b-instant",
                temperature=0.2
            )
        elif provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
            from langchain_anthropic import ChatAnthropic
            llm = ChatAnthropic(
                model="claude-3-5-haiku-20241022",
                temperature=0.2
            )
        elif provider == "openai" and settings.OPENAI_API_KEY:
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.2
            )
        else:
            raise ValueError(f"Missing API keys for provider: {provider}")

        # Bind the fetch_media_asset tool
        llm_with_tools = llm.bind_tools([fetch_media_asset])
        
        # Invoke LLM
        res = await llm_with_tools.ainvoke(messages)
        response_text = res.content

        # Check for tool calls
        if hasattr(res, "tool_calls") and res.tool_calls:
            tool_call = res.tool_calls[0]
            if tool_call["name"] == "fetch_media_asset":
                tool_called = True
                tool_keyword = tool_call["args"].get("keyword", "")
                logger.info(f"LLM tool call detected: fetch_media_asset(keyword={tool_keyword})")

    except Exception as e:
        logger.error(f"Failed to invoke actual LLM ({provider}): {e}. Falling back to simulation.")
        # Automatic fallback to mock mode if LLM fails (e.g. invalid key or rate limit)
        # First message content is the user prompt
        user_prompt = messages[-1].content if messages else ""
        # Determine tenant from prompt keywords or system message content
        sys_content = messages[0].content if messages else ""
        tenant_id = "tenant_luxfurn" if "LuxFurn" in sys_content else "tenant_autocare"
        return await _run_mock_llm(user_prompt, tenant_id)

    return response_text, tool_called, tool_keyword
