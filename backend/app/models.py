import hashlib
import json
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class OrderItem(BaseModel):
    name: str
    qty: int = 1

class OrderShipping(BaseModel):
    carrier: str = "FEDEX"
    tracking_number: str = "123456789012"
    address_summary: str = "Chennai, IN"
    status: Optional[str] = "DELIVERED"
    delivery_date: Optional[str] = None
    signed_by: Optional[str] = None
    has_signature: bool = False

class OrderData(BaseModel):
    id: str
    items: List[OrderItem] = Field(default_factory=list)
    shipping: OrderShipping

class ProofItem(BaseModel):
    type: str = "PROOF_OF_FULFILLMENT"
    source: str = "carrier_page"
    summary: str = "Delivered to recipient"

class EvidenceDraft(BaseModel):
    text: str
    proofs: List[ProofItem] = Field(default_factory=list)

class Amount(BaseModel):
    value: str
    currency: str = "USD"

class DisputeContract(BaseModel):
    # Person A Spec v3 contract fields
    id: str
    status: str = "PENDING_REVIEW"
    reason: str = "ITEM_NOT_RECEIVED"
    amount: Amount
    created_at: str
    respond_by: str
    order: OrderData
    evidence_draft: EvidenceDraft
    win_score: int = 75
    win_reasons: List[str] = Field(default_factory=list)
    approval_state: str = "pending"  # pending, approved, rejected, submitted

    # Person B frontend compatibility aliases / extensions
    dispute_id: Optional[str] = None
    dispute_amount: Optional[Dict[str, str]] = None
    seller_response_due_date: Optional[str] = None
    ai_drafted_evidence: Optional[str] = None
    seller_approval: Optional[Dict[str, Any]] = None
    buyer: Optional[Dict[str, Any]] = None
    carrier_proof: Optional[Dict[str, Any]] = None
    elastic_precedent: Optional[Dict[str, Any]] = None
    win_score_breakdown: Optional[Dict[str, Any]] = None
    similar_cases: Optional[List[Dict[str, Any]]] = None

    # Vasool Additive Fields (Section 6)
    case_id: Optional[str] = None
    source: Optional[str] = "vasool_voice"
    transcript_ref: Optional[str] = None
    draft_hash: Optional[str] = None
    approval: Optional[Dict[str, Any]] = None

    def compute_draft_hash(self) -> str:
        """Computes SHA-256 of canonical evidence_draft per Vasool specification."""
        raw_proofs = []
        for p in self.evidence_draft.proofs:
            if hasattr(p, "model_dump"):
                raw_proofs.append(p.model_dump())
            elif hasattr(p, "dict"):
                raw_proofs.append(p.dict())
            elif isinstance(p, dict):
                raw_proofs.append(p)
            else:
                raw_proofs.append(str(p))

        canonical_obj = {
            "text": self.evidence_draft.text or "",
            "proofs": raw_proofs
        }
        canonical_bytes = json.dumps(
            canonical_obj,
            sort_keys=True,
            separators=(',', ':'),
            ensure_ascii=False
        ).encode('utf-8')
        return hashlib.sha256(canonical_bytes).hexdigest()

    def populate_compatibility_fields(self):
        """Populates bidirectional compatibility fields for Person B's frontend."""
        if not self.dispute_id:
            self.dispute_id = self.id
        if not self.dispute_amount:
            self.dispute_amount = {"value": self.amount.value, "currency": self.amount.currency}
        if not self.seller_response_due_date:
            self.seller_response_due_date = self.respond_by
        if not self.ai_drafted_evidence:
            self.ai_drafted_evidence = self.evidence_draft.text
        if not self.seller_approval:
            self.seller_approval = {
                "approved": self.approval_state in ["approved", "submitted"],
                "conceded": self.approval_state == "rejected",
                "approved_at": None,
                "approver_id": None,
                "rejection_reason": None
            }
        else:
            if self.approval_state == "rejected":
                self.seller_approval["conceded"] = True
                self.seller_approval["approved"] = False
            elif self.approval_state in ["approved", "submitted"]:
                self.seller_approval["approved"] = True
                self.seller_approval["conceded"] = False
        if not self.buyer:
            self.buyer = {
                "name": self.order.shipping.signed_by or "Customer",
                "email": "customer@example.com",
                "shipping_address": {
                    "line1": self.order.shipping.address_summary,
                    "city": "Chennai",
                    "state": "TN",
                    "postal_code": "600001",
                    "country_code": "IN"
                }
            }
        if not self.carrier_proof:
            self.carrier_proof = {
                "carrier": self.order.shipping.carrier,
                "tracking_number": self.order.shipping.tracking_number,
                "status": self.order.shipping.status or "DELIVERED",
                "delivery_date": self.order.shipping.delivery_date or self.created_at,
                "signed_by": self.order.shipping.signed_by or "RECIPIENT",
                "has_signature": self.order.shipping.has_signature,
                "carrier_verified": True,
                "kernel_audit_id": f"KERNEL-{self.order.shipping.carrier}-9921",
                "delivery_address_verified": True
            }
        if not self.draft_hash:
            self.draft_hash = self.compute_draft_hash()

class EvidenceUpdateRequest(BaseModel):
    evidence_text: Optional[str] = None
    text: Optional[str] = None
    approver_id: Optional[str] = "seller_merchant_primary"

class RedraftRequest(BaseModel):
    merchant_notes: Optional[str] = None

class ApprovalPayload(BaseModel):
    id: Optional[str] = None
    action: str = "submit_evidence"
    amount: Optional[Amount] = None
    channel: str = "voice"  # "voice" or "ui"
    approved_by: str
    readback_hash: Optional[str] = None
    expires_at: Optional[str] = None
    draft_hash: Optional[str] = None

class ApproveRequest(BaseModel):
    approver_id: Optional[str] = "Authorized Seller Representative"
    approval_secret: Optional[str] = None
    # Vasool Additive Fields (Section 6 & 8)
    approval: Optional[Dict[str, Any]] = None
    approval_token: Optional[str] = None
    channel: Optional[str] = None
    readback_hash: Optional[str] = None
    action: Optional[str] = None
    amount: Optional[Amount] = None
    expires_at: Optional[str] = None

class IntakeRequest(BaseModel):
    case_id: str
    order_reference: str
    claim_type: str = "ITEM_NOT_RECEIVED"
    transcript_ref: Optional[str] = None
    amount: Optional[Amount] = None
    customer_name: Optional[str] = None
    source: Optional[str] = "vasool_voice"
    items: Optional[List[OrderItem]] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = "FEDEX"
    delivery_status: Optional[str] = "DELIVERED"
    address_summary: Optional[str] = "Customer Address, Verified"

class ProposalResponse(BaseModel):
    proposal_id: str
    dispute_id: str
    draft_hash: str
    action: str = "submit_evidence"
    amount: Amount
    status: str = "pending_approval"
    expires_at: str

class BriefResponse(BaseModel):
    dispute_id: str
    reason: str
    amount: Amount
    deadline: str
    win_score: int
    one_line_recommendation: str
    spoken_briefing: str

class RejectRequest(BaseModel):
    reason: str
    approver_id: Optional[str] = "seller_merchant_primary"

class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    disputes: List[Dict[str, Any]]


class Actor(BaseModel):
    type: str  # 'HUMAN_APPROVER' or 'AI_AGENT'
    id: str

class AuditEntry(BaseModel):
    entryId: str
    disputeId: Optional[str] = None
    timestamp: str
    actor: Actor
    action: str
    details: str
    hash: str
    prevHash: str
    # Vasool Additive Ledger Fields (Section 9)
    seq: Optional[int] = None
    ts: Optional[str] = None
    event_type: Optional[str] = None
    ref_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    rule: Optional[str] = None

class RestockItem(BaseModel):
    id: str
    name: str
    category: str
    current_stock: int
    safety_stock: int
    unit_cost_usd: float
    recommended_order_qty: int
    urgency: str
    ai_recommendation_reason: str

class RestockOrderRequest(BaseModel):
    item_id: str
    quantity: int
    approver_id: Optional[str] = "seller_merchant_primary"


# Model Aliases
Dispute = DisputeContract

class SimulateRequest(BaseModel):
    buyer_name: Optional[str] = "Alexander Wright"
    amount: Optional[str] = "450.00"
    carrier: Optional[str] = "UPS"
    reason: Optional[str] = "ITEM_NOT_RECEIVED"
    item_name: Optional[str] = "USB-C Dual 4K Pro Docking Station"
    due_hours: Optional[int] = 48


class CarrierProof(BaseModel):
    carrier: str = "UPS"
    tracking_number: str
    status: str = "DELIVERED"
    delivery_date: str
    signed_by: Optional[str] = None
    has_signature: bool = False
    carrier_verified: bool = True
    kernel_audit_id: Optional[str] = None
    delivery_address_verified: bool = True

class WinScoreComponent(BaseModel):
    points: int
    label: str
    positive: bool

class ElasticPrecedent(BaseModel):
    precedent_id: str
    similarity: float
    benchmark_win_rate: float
    policy_citation: str
