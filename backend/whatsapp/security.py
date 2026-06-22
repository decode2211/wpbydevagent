"""
Security functions for validating incoming Meta Webhook requests.
Uses HMAC-SHA256 signature checks to ensure payloads originate from Meta.
"""

import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)


def verify_webhook_signature(raw_body: bytes, signature_header: str, app_secret: str) -> bool:
    """
    Validate the X-Hub-Signature-256 header using HMAC-SHA256.
    Uses hmac.compare_digest for constant-time comparison (prevents timing attacks).

    Per Meta documentation:
    The signature header format is 'sha256=<hex_digest>'
    """
    if not signature_header or not app_secret:
        logger.warning("Signature header or app secret is missing. Signature verification failed.")
        return False

    # Meta prefix format is 'sha256='
    if not signature_header.startswith("sha256="):
        logger.warning("Invalid signature header format (expected prefix 'sha256=').")
        return False

    try:
        # Generate our own hash based on the raw request body and app secret
        key = app_secret.encode("utf-8")
        hasher = hmac.new(key, raw_body, hashlib.sha256)
        expected = "sha256=" + hasher.hexdigest()

        # Constant-time comparison
        return hmac.compare_digest(expected, signature_header)
    except Exception as e:
        logger.error(f"Error occurred during signature verification: {e}")
        return False
