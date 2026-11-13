import os
from pathlib import Path

# Base directory for resolving relative paths like seed data
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------- PayPal (sandbox) ----------
PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"
PAYPAL_TOKEN_PATH = "/v1/oauth2/token"
PAYPAL_DISPUTES_PATH = "/v1/customer/disputes"
PAYPAL_ORDERS_PATH = "/v2/checkout/orders"
PAYPAL_VERIFY_WEBHOOK_PATH = "/v1/notifications/verify-webhook-signature"
PAYPAL_WEBHOOK_EVENTS = [
    "CUSTOMER.DISPUTE.CREATED",
    "CUSTOMER.DISPUTE.UPDATED",
    "CUSTOMER.DISPUTE.RESOLVED",
]

# ---------- Hosting ----------
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
WEBHOOK_PATH = "/webhooks/paypal"

# ---------- AI ----------
AI_PROVIDER = os.environ.get("AI_PROVIDER", "groq")
AI_MODEL = os.environ.get("AI_MODEL", "openai/gpt-oss-120b")
AI_MAX_RETRIES = int(os.environ.get("AI_MAX_RETRIES", "3"))
AI_TIMEOUT_SECONDS = int(os.environ.get("AI_TIMEOUT_SECONDS", "25"))
CACHE_AGENT_OUTPUTS = os.environ.get("CACHE_AGENT_OUTPUTS", "true").lower() in ("true", "1")

# ---------- Search ----------
USE_ELASTIC = os.environ.get("USE_ELASTIC", "true").lower() in ("true", "1")
ELASTIC_INDEX = os.environ.get("ELASTIC_INDEX", "past_disputes")
SEED_FILE = str(BASE_DIR / "seed" / "past_disputes.json")
SIMILAR_CASES_TOP_K = int(os.environ.get("SIMILAR_CASES_TOP_K", "5"))

# ---------- App behavior ----------
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() in ("true", "1")
SYNC_PAGE_SIZE = int(os.environ.get("SYNC_PAGE_SIZE", "20"))
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./local.db")


# ---------- Channel3 & Zapier (Extensions) ----------
CHANNEL3_SPEND_LIMIT_USD = 500.00
ZAPIER_DISPUTE_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/paypal-slack-demo"
ZAPIER_AUDIT_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/audit-sheets-demo"

# ---------- Vasool Integration & Security (Section 11) ----------
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", f"{FRONTEND_ORIGIN},https://paypalcopilot.vercel.app,http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
]
APPROVAL_TTL_SECONDS = int(os.environ.get("APPROVAL_TTL_SECONDS", "600"))
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "vasool-service-secret-token")
APPROVALS_VERIFY_KEY = os.environ.get("APPROVALS_VERIFY_KEY", "vasool-approvals-verify-key")

class _SettingsProxy:
    CHANNEL3_SPEND_LIMIT_USD = CHANNEL3_SPEND_LIMIT_USD
    ZAPIER_DISPUTE_WEBHOOK_URL = ZAPIER_DISPUTE_WEBHOOK_URL
    ZAPIER_AUDIT_WEBHOOK_URL = ZAPIER_AUDIT_WEBHOOK_URL
    PAYPAL_BASE_URL = PAYPAL_BASE_URL
    PAYPAL_CLIENT_ID = "mock_paypal_client_id"
    PAYPAL_CLIENT_SECRET = "mock_paypal_secret"
    APPROVAL_TTL_SECONDS = APPROVAL_TTL_SECONDS
    SERVICE_TOKEN = SERVICE_TOKEN
    APPROVALS_VERIFY_KEY = APPROVALS_VERIFY_KEY

settings = _SettingsProxy()
