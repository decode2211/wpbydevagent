"""
FastAPI application entrypoint.
Configures CORS, mounts routers, connects MongoDB, seeds tenant data,
and handles static file serving for the SPA frontend.
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from database.connection import db_client
from database.seed import seed_tenants
from api.webhook import router as webhook_router
from api.dashboard import router as dashboard_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup database connection, data seeding,
    and cleanup on shutdown.
    """
    # Startup actions
    logger.info("Starting up application lifecycle...")
    db_client.connect()
    
    # Run seed script to set up LuxFurn and AutoCare configs
    await seed_tenants()
    
    yield
    
    # Shutdown actions
    logger.info("Shutting down application lifecycle...")
    db_client.close()


app = FastAPI(
    title="Multi-Tenant WhatsApp AI Support SaaS",
    description="Backend API and WhatsApp agent service built with FastAPI and LangGraph",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware config to allow React dev server during local editing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in production settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(webhook_router)
app.include_router(dashboard_router)


# =====================================================================
# Serve React Frontend Static Files
# =====================================================================

# Locate static folder containing built frontend files
static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(static_dir):
    logger.info(f"Mounting static files from directory: {static_dir}")
    
    # Mount assets folder for bundle loads
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all route to serve the React SPA index.html for routing support
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Ignore API request patterns
        if catchall.startswith("api/") or catchall.startswith("docs") or catchall.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="API route not found")
            
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        raise HTTPException(status_code=404, detail="Static index file not found")
else:
    logger.warning(
        f"Static folder '{static_dir}' was not found. "
        "The backend will run API-only mode without serving the frontend dashboard."
    )
