"""
Database connection manager for MongoDB.
Uses Motor async client for non-blocking database queries.
"""

import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)


class MongoDBConnection:
    """
    Manages the lifecycle of the MongoDB client connection.
    """
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None

    def connect(self) -> None:
        """Initializes the MongoDB client using the configured URI."""
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}")
        try:
            self.client = AsyncIOMotorClient(settings.MONGODB_URI)
            self.db = self.client[settings.MONGODB_DB_NAME]
            logger.info("Successfully connected to MongoDB")
        except Exception as e:
            logger.error(f"Error connecting to MongoDB: {e}")
            raise e

    def close(self) -> None:
        """Closes the MongoDB client connection."""
        if self.client:
            logger.info("Closing MongoDB connection")
            self.client.close()
            logger.info("MongoDB connection closed")


# Single connection manager instance
db_client = MongoDBConnection()


def get_collection(name: str):
    """
    Helper function to get a database collection.
    """
    if db_client.db is None:
        raise RuntimeError("Database not initialized. Call db_client.connect() first.")
    return db_client.db[name]
