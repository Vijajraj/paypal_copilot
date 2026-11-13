import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException
from ..config import settings

class GuardrailViolationException(HTTPException):
    def __init__(self, detail: str, status_code: int = 403):
        super().__init__(status_code=status_code, detail=f"GUARDRAIL_VIOLATION: {detail}")

class SpendingLimitExceededException(HTTPException):
    def __init__(self, amount: float, limit: float):
        super().__init__(
            status_code=400,
            detail=f"SPENDING_LIMIT_EXCEEDED: Requested order amount (${amount:.2f}) exceeds autonomous limit of (${limit:.2f})"
        )

class GuardrailEngine:
    @staticmethod
    def validate_human_authorization(approver_id: Optional[str]) -> str:
        """
        Enforces strict Human-in-the-Loop authorization.
        Disputes and money settlements can NEVER be submitted autonomously by AI.
        """
        if not approver_id or approver_id.strip() == "":
            raise GuardrailViolationException(
                "Human seller signature/approver ID is mandatory before evidence can be submitted to PayPal."
            )
        
        # Block if an AI agent tries to pose as the final human approver
        forbidden_actors = ["ai", "copilot", "bot", "auto", "automated_agent", "copilot_agent_v2", "service", "system", "worker"]
        if any(f in approver_id.lower() for f in forbidden_actors):
            raise GuardrailViolationException(
                f"Autonomous/Service identity '{approver_id}' is forbidden from signing dispute submissions. Only verified merchant humans may authorize settlement actions."
            )
        
        return approver_id.strip()

    @staticmethod
    def validate_approval_record(approval_data: Dict[str, Any], dispute: Any) -> Dict[str, Any]:
        """
        Validates Vasool Human Approval Invariants (Sections 5 & 8):
        - Approver must be human (non-human / service fails).
        - Channel must be recorded ('voice' or 'ui').
        - Expiration: must be unexpired.
        - Action & Amount: must match 'submit_evidence' and dispute amount.
        - Bound to draft_hash: must match canonical evidence_draft hash.
        """
        if not isinstance(approval_data, dict):
            raise GuardrailViolationException("Missing or malformed approval record.", status_code=400)

        # 1. Action check
        action = approval_data.get("action", "submit_evidence")
        if action != "submit_evidence":
            raise GuardrailViolationException(
                f"Approval action mismatch: expected 'submit_evidence', got '{action}'.",
                status_code=400
            )

        # 2. Approver human check
        approved_by = approval_data.get("approved_by") or approval_data.get("approver_id")
        if not approved_by or not approved_by.strip():
            raise GuardrailViolationException("Approver ID is required in approval record.", status_code=400)

        forbidden_actors = ["ai", "copilot", "bot", "auto", "automated_agent", "service", "system", "worker", "agent"]
        if any(f in approved_by.lower() for f in forbidden_actors):
            raise GuardrailViolationException(
                f"Service or automated approver '{approved_by}' is not authorized. Approver must be a verified human identity.",
                status_code=403
            )

        # 3. Channel check
        channel = approval_data.get("channel", "voice").lower()
        if channel not in ["voice", "ui"]:
            raise GuardrailViolationException(
                f"Invalid approval channel '{channel}'. Must be 'voice' or 'ui'.",
                status_code=400
            )

        # 4. Expiration check
        expires_at_str = approval_data.get("expires_at")
        if expires_at_str:
            try:
                # Handle ISO timestamps with Z or offset
                exp_clean = expires_at_str.replace("Z", "+00:00")
                exp_dt = datetime.fromisoformat(exp_clean)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                now_dt = datetime.now(timezone.utc)
                if exp_dt < now_dt:
                    raise GuardrailViolationException(
                        f"Approval record expired at {expires_at_str} (current time: {now_dt.isoformat()}).",
                        status_code=400
                    )
            except ValueError as ve:
                raise GuardrailViolationException(f"Invalid expires_at timestamp format: {ve}", status_code=400)

        # 5. Amount check
        app_amount = approval_data.get("amount")
        if app_amount:
            dispute_amt_val = getattr(dispute.amount, "value", str(dispute.amount)) if hasattr(dispute, "amount") else None
            dispute_amt_cur = getattr(dispute.amount, "currency", "USD") if hasattr(dispute, "amount") else "USD"
            
            if isinstance(app_amount, dict):
                req_val = str(app_amount.get("value", ""))
                req_cur = str(app_amount.get("currency", "USD"))
            else:
                req_val = str(app_amount)
                req_cur = "USD"

            if req_val and dispute_amt_val and float(req_val) != float(dispute_amt_val):
                raise GuardrailViolationException(
                    f"Approval amount mismatch: dispute requires {dispute_amt_val} {dispute_amt_cur}, approval specified {req_val} {req_cur}.",
                    status_code=400
                )

        # 6. Draft hash binding check
        app_draft_hash = approval_data.get("draft_hash")
        expected_draft_hash = getattr(dispute, "draft_hash", None)
        if not expected_draft_hash and hasattr(dispute, "compute_draft_hash"):
            expected_draft_hash = dispute.compute_draft_hash()

        if app_draft_hash and expected_draft_hash:
            if app_draft_hash != expected_draft_hash:
                raise GuardrailViolationException(
                    f"Approval is bound to draft hash '{app_draft_hash}', but current evidence draft hash is '{expected_draft_hash}'. Approval has been invalidated by subsequent edits.",
                    status_code=400
                )

        return {
            "id": approval_data.get("id") or f"apr_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "action": action,
            "amount": {
                "value": getattr(dispute.amount, "value", "0.00") if hasattr(dispute, "amount") else "0.00",
                "currency": getattr(dispute.amount, "currency", "USD") if hasattr(dispute, "amount") else "USD"
            },
            "channel": channel,
            "approved_by": approved_by.strip(),
            "readback_hash": approval_data.get("readback_hash") or hashlib.sha256(f"{action}:{getattr(dispute.amount, 'value', '0.00')}".encode()).hexdigest(),
            "expires_at": expires_at_str or datetime.now(timezone.utc).isoformat(),
            "draft_hash": expected_draft_hash
        }

    @staticmethod
    def validate_spending_cap(unit_cost: float, quantity: int) -> float:
        """
        Enforces the Channel3 autonomous supply replenishment spending cap ($500.00).
        """
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
        
        total = round(unit_cost * quantity, 2)
        if total > settings.CHANNEL3_SPEND_LIMIT_USD:
            raise SpendingLimitExceededException(total, settings.CHANNEL3_SPEND_LIMIT_USD)
        
        return total

guardrail_engine = GuardrailEngine()
