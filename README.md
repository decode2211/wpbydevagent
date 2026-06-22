# Multi-Tenant WhatsApp AI Support & Sales Agent SaaS

A production-quality, cloud-native Multi-Tenant WhatsApp AI Support & Sales Agent SaaS built with **FastAPI**, **LangGraph**, **MongoDB**, and **React (Vite) + Tailwind CSS**.

This system supports multiple, isolated brand workspaces:
- **Tenant A — LuxFurn (Luxury Furniture Store):** Upscale, warm AI brand personality that can search and share showroom photos and catalog PDFs.
- **Tenant B — AutoCare (Automotive Service Center):** Direct, professional AI advisor that can dispatch repair diagrams and service invoices.

---

## 1. Quick Start

### Step 1: Clone and Set Up Environment Variables
Copy `.env.example` to `.env` inside the `whatsapp-agent` directory and populate your keys:
```bash
cp .env.example .env
```
Ensure you set your database, Meta Cloud API, and LLM credentials. If you do not have WhatsApp API keys yet, the system will automatically run in **Simulation (Mock) Mode** for local testing.

### Step 2: Spin Up Dev Containers
Launch MongoDB, the FastAPI backend, and the Vite React frontend concurrently using Docker Compose:
```bash
docker-compose up --build
```
This runs:
- **MongoDB Atlas Mock** at `mongodb://localhost:27017`
- **FastAPI backend** at `http://localhost:8000` (with live reload)
- **Vite React frontend** at `http://localhost:5173` (with live reload)

### Step 3: Verify Automated Seeding
The backend automatically runs `seed_tenants()` on startup. This populates MongoDB collections with prompt structures and media library items for `LuxFurn` and `AutoCare`. You will see success logs outputted in the terminal.

---

## 2. Local Dev Without Docker

If you prefer to run services bare-metal without containerization:

### Run MongoDB Locally
Ensure a local MongoDB server is running on `mongodb://localhost:27017`.

### Run Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Run Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 3. LangGraph Architecture

The conversation pipeline leverages a linear state-routing graph to control agent execution:

```
[Webhook POST]
      │
      ▼
┌─────────────────────┐
│   Acknowledge Node   │──► mark_as_read + typing_indicator → DB log
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Context Retriever   │──► fetch tenant config + last 5 messages
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  LLM Reasoning Node │──► Claude/GPT decides: text | image | doc
│   [tool: fetch_media_asset]│   optional sentiment check
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│   Dispatcher Node   │──► send WhatsApp reply + DB outbound log
└─────────────────────┘
```

---

## 4. State Representation Table

Below is the state representation structure managed by `AgentState` (`agent/state.py`):

| State Key | Type | Description |
|---|---|---|
| `tenant_id` | `str` | Unique identifier of the brand workspace (e.g. `tenant_luxfurn`). |
| `customer_phone` | `str` | The customer's WhatsApp phone number. |
| `inbound_message_id` | `str` | The incoming Meta WhatsApp message ID (`wamid`). |
| `inbound_text` | `str` | Incoming message body text (or parsed caption/description). |
| `inbound_media_url` | `Optional[str]` | Populated with Meta media ID if user sent an image/document. |
| `tenant_system_prompt` | `str` | System prompt configuration representing the brand tone. |
| `tenant_media_library` | `dict` | Keyword-to-URL mappings of static PDFs and images. |
| `chat_history` | `List[dict]` | Chronological list of last 5 messages `[{"role": "user"\|"assistant", "content": "..."}]`. |
| `session_id` | `str` | Composite DB primary key: `f"{tenant_id}_{customer_phone}"`. |
| `response_type` | `str` | Bot response format: `text` \| `image` \| `document`. |
| `response_text` | `str` | The conversational text response compiled by the LLM. |
| `media_url` | `Optional[str]` | The target media asset URL to return (if a tool was called). |
| `media_filename` | `Optional[str]` | The target media download filename (e.g. `brochure.pdf`). |
| `typing_sent` | `bool` | Tracking flag confirming the typing indicator was sent. |
| `session_status` | `Optional[str]` | Final session state: `RESOLVED` \| `NEEDS_HUMAN` \| `ERROR`. |
| `error` | `Optional[str]` | Tracks any runtime exception messages caught during routing. |

---

## 5. Deployment Section

### Build & Deploy with Google Cloud Run (Recommended Single Container)
We package the built static React assets directly into the FastAPI service folder to host the entire SaaS under a single Cloud Run instance.

1. **Submit to Google Artifact Registry:**
   ```bash
   gcloud builds submit --tag gcr.io/<PROJECT_ID>/whatsapp-agent
   ```
2. **Deploy Container:**
   ```bash
   gcloud run deploy whatsapp-agent \
     --image gcr.io/<PROJECT_ID>/whatsapp-agent \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="MONGODB_URI=mongodb+srv://...,MONGODB_DB_NAME=whatsapp_agent,LLM_PROVIDER=anthropic,ANTHROPIC_API_KEY=..."
   ```

### Registering Webhook with Meta WhatsApp Developer Dashboard
1. Copy the public URL of your Cloud Run deployment (e.g., `https://whatsapp-agent-xxxx.run.app`).
2. Log into the [Meta App Dashboard](https://developers.facebook.com/).
3. Navigate to **WhatsApp > Configuration**.
4. In the **Webhook** section, click **Edit**:
   - Set **Callback URL** to `https://whatsapp-agent-xxxx.run.app/api/webhooks/whatsapp`
   - Set **Verify Token** to match your configured `WEBHOOK_VERIFY_TOKEN` env variable.
5. In webhook fields, subscribe to `messages` updates.

---

## 6. Evaluation Notes

- **Async 200-OK Pattern:** Meta's WhatsApp API requires webhooks to return a `200 OK` status within 1-2 seconds. Failing to do so causes Meta to mark the webhook offline and retry repeatedly. We resolve this by validating requests, extracting payloads, and immediately returning a `200 OK` response while offloading the LangGraph agent chain to FastAPI's background thread pools via `BackgroundTasks`.
- **Signature Security Verification:** Webhook payloads are verified against the header `X-Hub-Signature-256` using an HMAC-SHA256 hash generated from the raw request payload and your Meta `app_secret`. Constant-time comparison via `hmac.compare_digest` protects the server against signature timing attacks.
- **Typing Indicator Design Choices:** The typing indicator notifies users that their message is processing. We trigger this during the first node (`acknowledge_node`) immediately after marking the user's message as read. The indicator auto-expires upon delivering the actual response from the dispatcher node.
