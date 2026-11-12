import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import db
from backend.app.search import search_service

client = TestClient(app)

def test_concede_claim_and_refund_flow():
    """Tests the full concession / full buyer refund workflow."""
    # Ensure dispute exists
    disputes = db.get_all()
    assert len(disputes) > 0
    target_id = disputes[0].id

    payload = {
        "reason": "Merchant accepted claim liability and issued full buyer refund",
        "approver_id": "Authorized Merchant Director"
    }

    res = client.post(f"/disputes/{target_id}/reject", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    dispute = data["dispute"]
    assert dispute["approval_state"] == "rejected"
    assert dispute["status"] == "RESOLVED"
    assert dispute["seller_approval"]["conceded"] is True
    assert dispute["seller_approval"]["approved"] is False
    assert dispute["seller_approval"]["rejection_reason"] == payload["reason"]
    assert dispute["seller_approval"]["approver_id"] == "Authorized Merchant Director"

    # Verify cryptographic audit block
    audit = data["audit"]
    assert audit["action"] == "DISPUTE_CLAIM_REJECTED"
    assert audit["actor"]["type"] == "HUMAN_APPROVER"
    assert audit["actor"]["id"] == "Authorized Merchant Director"
    assert "conceded" in audit["details"]

    # Verify PayPal Sandbox response
    paypal_res = data["paypal_response"]
    assert paypal_res["conceded"] is True
    assert paypal_res["status_code"] == 200
    assert "PP-REFUND-" in paypal_res["data"]["acknowledgement_id"]

def test_search_cache_optimization():
    """Tests that repeat precedent queries hit the memory cache."""
    # Initial query
    res1 = search_service.search_similar_cases(reason="ITEM_NOT_RECEIVED", item_name="Watch", carrier="UPS", top_k=3)
    # Cached query
    res2 = search_service.search_similar_cases(reason="ITEM_NOT_RECEIVED", item_name="Watch", carrier="UPS", top_k=3)

    assert len(res1) == len(res2)
    assert res1[0]["id"] == res2[0]["id"]
    cache_key = "ITEM_NOT_RECEIVED:Watch:UPS:3"
    assert cache_key in search_service._cache
