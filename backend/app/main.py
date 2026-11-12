import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from .config import FRONTEND_ORIGIN, DEMO_MODE
from .database import db
from .models import (
    DisputeContract, EvidenceUpdateRequest, ApproveRequest, RejectRequest, SyncResponse, RedraftRequest
)
from .paypal_client import paypal_client
from .sync import sync_disputes_from_paypal
from .agent import copilot_agent
from .search import search_service
from .services.carrier_kernel import carrier_kernel
from .services.audit_ledger import audit_ledger
from .services.guardrails import guardrail_engine
from .services.zapier_service import zapier_service
from .webhooks import router as webhook_router
from .routes.restock import router as restock_router
from .routes.zapier import router as zapier_router

import os

try:
    from . import secrets
    APPROVAL_SECRET = getattr(secrets, "APPROVAL_SECRET", "") or os.environ.get("APPROVAL_SECRET", "")
except ImportError:
    APPROVAL_SECRET = os.environ.get("APPROVAL_SECRET", "")

app = FastAPI(
    title="PayPal AI Dispute Copilot API (Person A)",
    version="3.0.0",
    description="Backend Service for PayPal AI Dispute Copilot with Strict Human Approval Guardrails"
)

# CORS configuration for Person B's frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include webhooks and supplementary routers
app.include_router(webhook_router)
app.include_router(restock_router)
app.include_router(zapier_router)

def to_dict(obj):
    """API Optimization: Fast, warning-free model serialization."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return obj

# -------------------------------------------------------------
# Core Routes for Person B (Section 9 of Spec)
# -------------------------------------------------------------

@app.get("/")
def root():
    return {
        "project": "AI dispute copilot for small PayPal sellers",
        "role": "Person A (Backend, Agent, Data)",
        "status": "ready",
        "demo_mode": DEMO_MODE,
        "docs": "/docs",
        "endpoints": [
            "/disputes",
            "/disputes/{id}",
            "/disputes/{id}/evidence",
            "/disputes/{id}/approve",
            "/disputes/{id}/reject",
            "/sync",
            "/timeline",
            "/audit",
            "/webhooks/paypal"
        ]
    }

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/health/integrations")
@app.get("/api/health/integrations")
def health_integrations():
    """API Optimization & Failover Monitoring: Reports status of Elastic (Primary vs Fallback), Kernel & PayPal."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "elastic": search_service.get_status(),
        "kernel": {
            "active_key_suffix": f"...{carrier_kernel.get_active_key()[-6:]}" if carrier_kernel.get_active_key() else "none",
            "fallback_configured": bool(carrier_kernel._fallback_key)
        },
        "paypal_sandbox": {
            "token_cached": bool(paypal_client._cached_token),
            "demo_mode": DEMO_MODE
        }
    }

# 1. GET /disputes - List with filters
@app.get("/disputes")
@app.get("/api/disputes")
def list_disputes(status: Optional[str] = None):
    items = db.get_all(status)
    return {
        "success": True,
        "count": len(items),
        "disputes": [to_dict(d) for d in items]
    }

# 2. GET /disputes/{id} - Full detail
@app.get("/disputes/{dispute_id}")
@app.get("/api/disputes/{dispute_id}")
def get_dispute(dispute_id: str):
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")
    return {"success": True, "dispute": to_dict(dispute)}

# 3. PATCH & POST /disputes/{id}/evidence - Save edits from the UI
@app.patch("/disputes/{dispute_id}/evidence")
@app.post("/disputes/{dispute_id}/evidence")
@app.patch("/api/disputes/{dispute_id}/evidence")
@app.post("/api/disputes/{dispute_id}/evidence")
def update_evidence(dispute_id: str, payload: EvidenceUpdateRequest):
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    new_text = payload.text or payload.evidence_text
    if new_text:
        dispute.evidence_draft.text = new_text
        dispute.ai_drafted_evidence = new_text
        db.save(dispute)

        # Log to audit ledger
        audit_ledger.record_entry(
            dispute_id=dispute_id,
            actor_type="HUMAN_APPROVER",
            actor_id=payload.approver_id or "seller_merchant_primary",
            action="EVIDENCE_DRAFT_MODIFIED",
            details="Merchant manually modified formal legal evidence statement in UI."
        )

    return {"success": True, "dispute": to_dict(dispute)}

# 3b. POST /disputes/{id}/redraft - Regenerate evidence draft with Groq AI
@app.post("/disputes/{dispute_id}/redraft")
@app.post("/api/disputes/{dispute_id}/redraft")
def redraft_dispute_evidence(dispute_id: str, payload: RedraftRequest = RedraftRequest()):
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    order_info = {
        "id": dispute.order.id,
        "items": [to_dict(i) for i in dispute.order.items],
        "shipping": to_dict(dispute.order.shipping)
    }
    dispute_info = {
        "id": dispute.id,
        "reason": dispute.reason,
        "amount": dispute.amount.value
    }

    fresh_agent_out = copilot_agent.run(
        dispute_data=dispute_info,
        order_data=order_info,
        bypass_cache=True,
        merchant_notes=payload.merchant_notes
    )

    dispute.evidence_draft.text = fresh_agent_out["evidence_text"]
    dispute.ai_drafted_evidence = fresh_agent_out["evidence_text"]
    dispute.win_score = fresh_agent_out["win_score"]
    dispute.win_reasons = fresh_agent_out["win_reasons"]
    dispute.similar_cases = fresh_agent_out.get("similar_cases", [])
    db.save(dispute)

    # Record in audit ledger
    audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="AI_AGENT",
        actor_id="copilot_agent_groq_120b",
        action="DRAFT_EVIDENCE_REGENERATED",
        details=f"AI Agent re-analyzed Elastic precedents and regenerated evidence with Groq (Win Score: {fresh_agent_out['win_score']}%)."
    )

    return {"success": True, "dispute": to_dict(dispute)}

# 4. POST /disputes/{id}/approve - Approve and submit to PayPal
@app.post("/disputes/{dispute_id}/approve")
@app.post("/api/disputes/{dispute_id}/approve")
def approve_dispute(
    dispute_id: str,
    payload: ApproveRequest = ApproveRequest(),
    x_approval_secret: Optional[str] = Header(None)
):
    """
    Approval Gate (Section 10):
    - Explicit human approval required in code.
    - Checks APPROVAL_SECRET to ensure authorized access.
    - Sets approval_state = 'submitted'.
    - Submits evidence to PayPal.
    - Appends exact text and timestamp to audit log.
    """
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    # Validate APPROVAL_SECRET if configured
    provided_secret = payload.approval_secret or x_approval_secret
    if APPROVAL_SECRET and APPROVAL_SECRET.strip():
        if provided_secret != APPROVAL_SECRET and not DEMO_MODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid APPROVAL_SECRET. Merchant approval signature unauthorized."
            )

    # Human-in-the-loop guardrail
    approver = guardrail_engine.validate_human_authorization(payload.approver_id)

    # 1. Update dispute state
    now = datetime.now(timezone.utc).isoformat()
    dispute.approval_state = "submitted"
    dispute.status = "UNDER_REVIEW"
    dispute.seller_approval = {
        "approved": True,
        "conceded": False,
        "approved_at": now,
        "approver_id": approver,
        "rejection_reason": None
    }
    db.save(dispute)

    # 2. Submit to PayPal
    shipping = dispute.order.shipping
    paypal_res = paypal_client.submit_evidence(
        dispute_id=dispute_id,
        evidence_text=dispute.evidence_draft.text,
        carrier=shipping.carrier,
        tracking_number=shipping.tracking_number
    )

    # 3. Log into Cryptographic Audit Trail
    audit_entry = audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="HUMAN_APPROVER",
        actor_id=approver,
        action="DISPUTE_EVIDENCE_SUBMITTED",
        details=f"Merchant human approver '{approver}' authorized submission to PayPal. Exact text submitted: {dispute.evidence_draft.text[:120]}..."
    )

    # Trigger Zapier Google Sheets compliance row
    zapier_service.trigger_audit_log(audit_entry)

    return {
        "success": True,
        "dispute": to_dict(dispute),
        "audit": to_dict(audit_entry),
        "paypal_response": paypal_res
    }

# 5. POST /disputes/{id}/reject - Reject the draft / Concede claim & refund
@app.post("/disputes/{dispute_id}/reject")
@app.post("/api/disputes/{dispute_id}/reject")
def reject_dispute(dispute_id: str, payload: RejectRequest):
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    approver = guardrail_engine.validate_human_authorization(payload.approver_id)

    now = datetime.now(timezone.utc).isoformat()
    dispute.approval_state = "rejected"
    dispute.status = "RESOLVED"
    dispute.seller_approval = {
        "approved": False,
        "conceded": True,
        "approved_at": now,
        "approver_id": approver,
        "rejection_reason": payload.reason
    }
    db.save(dispute)

    # 1. Interface with PayPal Sandbox to formally accept claim & issue buyer refund
    paypal_res = paypal_client.accept_claim(
        dispute_id=dispute_id,
        note=payload.reason or "Merchant accepted claim liability and issued full buyer refund"
    )

    # 2. Append immutable record to cryptographic SHA-256 audit ledger
    audit_entry = audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="HUMAN_APPROVER",
        actor_id=approver,
        action="DISPUTE_CLAIM_REJECTED",
        details=f"Merchant human approver '{approver}' conceded claim. Full refund issued to buyer. Reason: {payload.reason}"
    )

    # 3. Trigger Zapier webhook audit log
    zapier_service.trigger_audit_log(audit_entry)

    return {
        "success": True,
        "dispute": to_dict(dispute),
        "audit": to_dict(audit_entry),
        "paypal_response": paypal_res
    }

# 6. POST /sync - Pull disputes from PayPal now
@app.post("/sync")
@app.post("/api/sync")
def sync_disputes():
    """
    Sync endpoint (Section 8 & 9):
    Pulls disputes from PayPal Sandbox and upserts them.
    Covers sleeping or cold server instances.
    """
    synced = sync_disputes_from_paypal()
    return {
        "success": True,
        "synced_count": len(synced),
        "disputes": [to_dict(d) for d in synced]
    }

# 7. GET /timeline - Deadlines for calendar view
@app.get("/timeline")
@app.get("/api/timeline")
def get_timeline():
    disputes = db.get_all()
    timeline_items = []
    for d in disputes:
        timeline_items.append({
            "dispute_id": d.id,
            "respond_by": d.respond_by,
            "status": d.status,
            "amount": to_dict(d.amount),
            "reason": d.reason,
            "win_score": d.win_score,
            "approval_state": d.approval_state
        })
    # Sort by deadline ascending
    timeline_items.sort(key=lambda x: x["respond_by"])
    return {"success": True, "count": len(timeline_items), "timeline": timeline_items}

# 8. GET /audit - Log of agent and human actions
@app.get("/audit")
@app.get("/api/audit")
def get_audit(dispute_id: Optional[str] = None):
    entries = audit_ledger.get_entries(dispute_id)
    is_valid, report = audit_ledger.verify_chain()
    reversed_entries = [to_dict(e) for e in reversed(entries)]
    return {
        "success": True,
        "count": len(reversed_entries),
        "audit_trail": reversed_entries,
        "ledger_integrity": report
    }

# 9. POST /disputes & /disputes/simulate - Dynamic Dispute Ingestion & Simulation
from .routes.disputes import simulate_dispute
app.add_api_route("/disputes", simulate_dispute, methods=["POST"], tags=["Disputes"])
app.add_api_route("/disputes/simulate", simulate_dispute, methods=["POST"], tags=["Simulator"])
app.add_api_route("/api/disputes/simulate", simulate_dispute, methods=["POST"], tags=["Simulator"])
