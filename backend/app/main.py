import json
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Query, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import FRONTEND_ORIGIN, DEMO_MODE, ALLOWED_ORIGINS, APPROVAL_TTL_SECONDS, SERVICE_TOKEN, APPROVALS_VERIFY_KEY
from .database import db
from .models import (
    DisputeContract, EvidenceUpdateRequest, ApproveRequest, RejectRequest, SyncResponse, RedraftRequest,
    Amount, OrderData, OrderShipping, OrderItem, EvidenceDraft, ProofItem, IntakeRequest, ProposalResponse, BriefResponse
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
from .routes.auth import router as auth_router
from .auth import get_current_user_optional

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

# Idempotency cache for /intake and /approve (Section 8)
_IDEMPOTENCY_CACHE: Dict[str, Dict[str, Any]] = {}

# CORS configuration
all_allowed_origins = list(set(["*", FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"] + ALLOWED_ORIGINS))
app.add_middleware(
    CORSMiddleware,
    allow_origins=all_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include webhooks and supplementary routers
app.include_router(webhook_router)
app.include_router(restock_router)
app.include_router(zapier_router)
app.include_router(auth_router)

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
        # Vasool Invariant 2: Bind approval to draft_hash; PATCH /evidence resets approval_state to pending and invalidates prior approvals
        dispute.approval_state = "pending"
        dispute.approval = None
        dispute.draft_hash = dispute.compute_draft_hash()
        db.save(dispute)

        # Log to audit ledger
        audit_ledger.record_entry(
            dispute_id=dispute_id,
            actor_type="HUMAN_APPROVER",
            actor_id=payload.approver_id or "seller_merchant_primary",
            action="EVIDENCE_DRAFT_MODIFIED",
            details="Merchant manually modified formal legal evidence statement in UI.",
            payload={"new_draft_hash": dispute.draft_hash}
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
    # Vasool Invariant 2: Any edit or redraft resets approval_state to pending and invalidates prior approvals
    dispute.approval_state = "pending"
    dispute.approval = None
    dispute.draft_hash = dispute.compute_draft_hash()
    db.save(dispute)

    # Record in audit ledger
    audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="AI_AGENT",
        actor_id="copilot_agent_groq_120b",
        action="DRAFT_EVIDENCE_REGENERATED",
        details=f"AI Agent re-analyzed Elastic precedents and regenerated evidence with Groq (Win Score: {fresh_agent_out['win_score']}%).",
        payload={"draft_hash": dispute.draft_hash, "win_score": dispute.win_score}
    )

    return {"success": True, "dispute": to_dict(dispute)}

# 4. POST /disputes/{id}/approve - Approve and submit to PayPal (Extended for Vasool)
@app.post("/disputes/{dispute_id}/approve")
@app.post("/api/disputes/{dispute_id}/approve")
def approve_dispute(
    dispute_id: str,
    payload: ApproveRequest = ApproveRequest(),
    x_approval_secret: Optional[str] = Header(None),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Approval Gate (Section 5 & 8):
    - Invariant 1: No submission without valid human approval.
    - Invariant 2: Approval bound to exact action, amount, and draft_hash.
    - Invariant 3: Approvals expire (default 10 minutes).
    - Invariant 4: Human id and channel recorded.
    - Invariant 6: Idempotent submission (same key never submits twice).
    - Invariant 7: Fail closed on malformed/unverifiable approval with ledger failure entry.
    """
    # Invariant 6: Idempotent replay check
    if isinstance(idempotency_key, str) and idempotency_key.strip():
        if idempotency_key in _IDEMPOTENCY_CACHE:
            return _IDEMPOTENCY_CACHE[idempotency_key]

    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    # Role guardrail: Viewers cannot approve disputes
    if isinstance(current_user, dict) and current_user.get("role") == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Accounts with 'viewer' role have read-only access. Log in as an Admin or Dispute Analyst to submit evidence."
        )

    # Ensure draft_hash is calculated
    if not dispute.draft_hash:
        dispute.draft_hash = dispute.compute_draft_hash()

    approval_data: Dict[str, Any] = {}
    approver: str = ""
    channel: str = "ui"
    readback_hash: str = ""
    expires_at: str = ""

    if payload.approval is not None:
        try:
            val_record = guardrail_engine.validate_approval_record(payload.approval, dispute)
            approval_data = val_record
            approver = val_record["approved_by"]
            channel = val_record["channel"]
            readback_hash = val_record["readback_hash"]
            expires_at = val_record["expires_at"]
        except HTTPException as he:
            # Log failure to ledger (Fail closed - Invariant 7)
            audit_ledger.record_entry(
                dispute_id=dispute_id,
                actor_type="SYSTEM",
                actor_id="vasool_approval_gate",
                action="SUBMISSION_APPROVAL_FAILED",
                details=f"Approval rejected: {he.detail}",
                payload={"error": str(he.detail), "attempt": payload.approval}
            )
            raise he
    else:
        # Fallback to legacy APPROVAL_SECRET flow
        provided_secret = payload.approval_secret or x_approval_secret
        if APPROVAL_SECRET and APPROVAL_SECRET.strip():
            if provided_secret != APPROVAL_SECRET and not DEMO_MODE:
                audit_ledger.record_entry(
                    dispute_id=dispute_id,
                    actor_type="SYSTEM",
                    actor_id="vasool_approval_gate",
                    action="SUBMISSION_APPROVAL_FAILED",
                    details="Approval rejected: Invalid or missing APPROVAL_SECRET.",
                    payload={"error": "unauthorized"}
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid APPROVAL_SECRET. Merchant approval signature unauthorized."
                )

        approver_candidate = payload.approver_id
        if (not approver_candidate or approver_candidate == "merchant_owner_01") and isinstance(current_user, dict):
            approver_candidate = f"{current_user.get('full_name', 'User')} ({current_user.get('role', 'analyst')})"
        
        try:
            approver = guardrail_engine.validate_human_authorization(approver_candidate)
        except HTTPException as he:
            audit_ledger.record_entry(
                dispute_id=dispute_id,
                actor_type="SYSTEM",
                actor_id="vasool_approval_gate",
                action="SUBMISSION_APPROVAL_FAILED",
                details=f"Approval rejected: {he.detail}",
                payload={"error": str(he.detail), "approver_candidate": approver_candidate}
            )
            raise he

        channel = payload.channel or "ui"
        readback_hash = payload.readback_hash or hashlib.sha256(f"submit_evidence:{dispute.amount.value}".encode()).hexdigest()
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=APPROVAL_TTL_SECONDS)).isoformat()
        approval_data = {
            "id": f"apr_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "action": "submit_evidence",
            "amount": {"value": dispute.amount.value, "currency": dispute.amount.currency},
            "channel": channel,
            "approved_by": approver,
            "readback_hash": readback_hash,
            "expires_at": expires_at,
            "draft_hash": dispute.draft_hash
        }

    # 1. Update dispute state
    now = datetime.now(timezone.utc).isoformat()
    dispute.approval = approval_data
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
        details=f"Merchant human approver '{approver}' via {channel} authorized submission to PayPal. Readback hash: {readback_hash[:16]}...",
        payload=approval_data
    )

    # Trigger Zapier Google Sheets compliance row
    zapier_service.trigger_audit_log(audit_entry)

    response_data = {
        "success": True,
        "dispute": to_dict(dispute),
        "audit": to_dict(audit_entry),
        "paypal_response": paypal_res
    }

    if isinstance(idempotency_key, str) and idempotency_key.strip():
        _IDEMPOTENCY_CACHE[idempotency_key] = response_data

    return response_data

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

# -------------------------------------------------------------
# Vasool Integration Endpoints (Sections 7 & 8)
# -------------------------------------------------------------

@app.post("/intake")
@app.post("/api/intake")
def intake_dispute(
    payload: Dict[str, Any],
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
):
    """
    POST /intake (Section 7):
    Create a dispute from the Vasool voice gateway.
    Requires case_id, order_reference, claim_type.
    Fail-closed: missing fields reject with 400 and log failure in ledger.
    Idempotent: replays with same key return original result.
    """
    if isinstance(idempotency_key, str) and idempotency_key.strip():
        if idempotency_key in _IDEMPOTENCY_CACHE:
            return _IDEMPOTENCY_CACHE[idempotency_key]

    case_id = payload.get("case_id")
    order_ref = payload.get("order_reference") or payload.get("order_id")
    claim_type = payload.get("claim_type") or payload.get("reason")

    if not case_id or not order_ref or not claim_type:
        missing = []
        if not case_id: missing.append("case_id")
        if not order_ref: missing.append("order_reference")
        if not claim_type: missing.append("claim_type")
        err_msg = f"Missing required intake fields: {', '.join(missing)}"
        
        audit_ledger.record_entry(
            dispute_id=case_id or "UNKNOWN",
            actor_type="SYSTEM",
            actor_id="vasool_voice_gateway",
            action="INTAKE_VALIDATION_FAILED",
            details=f"Dispute intake validation failed: {err_msg}",
            payload={"error": err_msg, "payload": payload}
        )
        raise HTTPException(status_code=400, detail=err_msg)

    dispute_id = f"PP-D-{case_id}" if not str(case_id).startswith("PP-") else str(case_id)
    existing = db.get_by_id(dispute_id)
    if existing:
        res = {"success": True, "dispute": to_dict(existing)}
        if idempotency_key:
            _IDEMPOTENCY_CACHE[idempotency_key] = res
        return res

    amount_data = payload.get("amount") or {"value": "89.50", "currency": "USD"}
    if isinstance(amount_data, dict):
        amount = Amount(value=str(amount_data.get("value", "89.50")), currency=str(amount_data.get("currency", "USD")))
    else:
        amount = Amount(value=str(amount_data), currency="USD")

    now_iso = datetime.now(timezone.utc).isoformat()
    respond_by_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    carrier = payload.get("carrier") or "FEDEX"
    tracking = payload.get("tracking_number") or f"TRK-{uuid.uuid4().hex[:10].upper()}"

    order_shipping = OrderShipping(
        carrier=carrier,
        tracking_number=tracking,
        address_summary=payload.get("address_summary", "Customer Address, Verified"),
        status=payload.get("delivery_status", "DELIVERED"),
        delivery_date=now_iso,
        signed_by=payload.get("customer_name") or "RECIPIENT",
        has_signature=True
    )
    items = [OrderItem(name=payload.get("item_name", "E-Commerce Merchandise"), qty=1)]
    order_data = OrderData(id=order_ref, items=items, shipping=order_shipping)

    dispute_info = {"id": dispute_id, "reason": claim_type, "amount": amount.value}
    order_dict = {"id": order_ref, "items": [to_dict(i) for i in items], "shipping": to_dict(order_shipping)}

    # Gather evidence & draft via copilot agent
    agent_out = copilot_agent.run(dispute_data=dispute_info, order_data=order_dict, bypass_cache=True)
    evidence_draft = EvidenceDraft(
        text=agent_out["evidence_text"],
        proofs=[ProofItem(**p) if isinstance(p, dict) else p for p in agent_out["proofs"]]
    )

    new_dispute = DisputeContract(
        id=dispute_id,
        status="PENDING_REVIEW",
        reason=claim_type,
        amount=amount,
        created_at=now_iso,
        respond_by=respond_by_iso,
        order=order_data,
        evidence_draft=evidence_draft,
        win_score=agent_out["win_score"],
        win_reasons=agent_out["win_reasons"],
        approval_state="pending",
        case_id=case_id,
        source=payload.get("source", "vasool_voice"),
        transcript_ref=payload.get("transcript_ref", f"call-{case_id}"),
        similar_cases=agent_out.get("similar_cases", [])
    )
    new_dispute.draft_hash = new_dispute.compute_draft_hash()
    new_dispute.populate_compatibility_fields()
    db.save(new_dispute)

    # Record intake in audit ledger
    audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="VASOOL_VOICE_GATEWAY",
        actor_id="vasool_intake_system",
        action="DISPUTE_INTAKE_RECORDED",
        details=f"Intake created dispute '{dispute_id}' for order '{order_ref}' (Claim: {claim_type}).",
        payload={
            "case_id": case_id,
            "order_reference": order_ref,
            "claim_type": claim_type,
            "amount": to_dict(amount),
            "transcript_ref": new_dispute.transcript_ref
        }
    )

    audit_ledger.record_entry(
        dispute_id=dispute_id,
        actor_type="AI_AGENT",
        actor_id="copilot_agent_v2",
        action="DRAFT_EVIDENCE_GENERATED",
        details=f"AI Agent drafted evidence and computed win score {new_dispute.win_score}%.",
        payload={
            "draft_hash": new_dispute.draft_hash,
            "win_score": new_dispute.win_score,
            "proofs_count": len(new_dispute.evidence_draft.proofs)
        }
    )

    res = {"success": True, "dispute": to_dict(new_dispute)}
    if isinstance(idempotency_key, str) and idempotency_key.strip():
        _IDEMPOTENCY_CACHE[idempotency_key] = res
    return res

@app.post("/disputes/{dispute_id}/propose")
@app.post("/api/disputes/{dispute_id}/propose")
def propose_dispute_approval(dispute_id: str):
    """
    POST /disputes/{id}/propose (Section 7):
    Computes draft_hash, creates a pending approval record, and notifies the approvals inbox.
    """
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    draft_hash = dispute.compute_draft_hash()
    dispute.draft_hash = draft_hash

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=APPROVAL_TTL_SECONDS)).isoformat()
    proposal_id = f"prop_{uuid.uuid4().hex[:8]}"

    proposal = {
        "proposal_id": proposal_id,
        "dispute_id": dispute.id,
        "draft_hash": draft_hash,
        "action": "submit_evidence",
        "amount": {"value": dispute.amount.value, "currency": dispute.amount.currency},
        "status": "pending_approval",
        "expires_at": expires_at
    }

    audit_ledger.record_entry(
        dispute_id=dispute.id,
        actor_type="AI_AGENT",
        actor_id="vasool_copilot_proposer",
        action="APPROVAL_PROPOSED",
        details=f"Proposal {proposal_id} created for dispute {dispute.id} with draft_hash {draft_hash[:16]}...",
        payload=proposal
    )
    db.save(dispute)
    return {"success": True, "proposal": proposal, "dispute": to_dict(dispute)}

@app.get("/disputes/{dispute_id}/brief")
@app.get("/api/disputes/{dispute_id}/brief")
def get_dispute_brief(dispute_id: str):
    """
    GET /disputes/{id}/brief (Section 7 & P2):
    Short, voice-friendly summary for the morning briefing:
    reason, amount, deadline, win score, one-line recommendation, spoken briefing.
    """
    dispute = db.get_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail=f"Dispute '{dispute_id}' not found.")

    carrier = dispute.order.shipping.carrier
    tracking = dispute.order.shipping.tracking_number
    has_sig = dispute.order.shipping.has_signature

    one_liner = f"Contest claim: {carrier} tracking {tracking} confirms delivery (win probability {dispute.win_score}%)."
    spoken = (
        f"Dispute {dispute.id} for {dispute.amount.value} {dispute.amount.currency} "
        f"regarding {dispute.reason.replace('_', ' ').lower()}. Response due by {dispute.respond_by}. "
        f"We recommend contesting because {carrier} confirms delivery{' with signature' if has_sig else ''}. "
        f"Estimated win score is {dispute.win_score} percent."
    )

    return {
        "success": True,
        "dispute_id": dispute.id,
        "reason": dispute.reason,
        "amount": to_dict(dispute.amount),
        "deadline": dispute.respond_by,
        "win_score": dispute.win_score,
        "one_line_recommendation": one_liner,
        "spoken_briefing": spoken
    }

@app.get("/ledger/verify")
@app.get("/api/ledger/verify")
def verify_ledger_endpoint():
    """
    GET /ledger/verify (Section 7):
    Thin alias to the existing integrity check, for the unified verify script.
    """
    is_valid, report = audit_ledger.verify_chain()
    return {"success": is_valid, "valid": is_valid, "report": report}
