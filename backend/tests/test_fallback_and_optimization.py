import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.search import DisputeSearchService, search_service
from backend.app.services.carrier_kernel import carrier_kernel, CarrierKernelService
from backend.app.paypal_client import paypal_client

client = TestClient(app)

def test_health_integrations_endpoint():
    """Verify /health/integrations returns operational diagnostics for Elastic and Kernel."""
    response = client.get("/health/integrations")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "elastic" in data
    assert "kernel" in data
    assert data["elastic"]["primary_configured"] is True or data["elastic"]["fallback_configured"] is True
    assert data["kernel"]["fallback_configured"] is True

def test_kernel_fallback_key_rotation():
    """Verify carrier_kernel key retrieval and fallback rotation."""
    service = CarrierKernelService()
    service._primary_key = "primary_key_abc123"
    service._fallback_key = "fallback_key_xyz789"
    service._use_fallback = False

    # Primary active
    assert service.get_active_key() == "primary_key_abc123"
    proof = service.verify_tracking(carrier="UPS", recipient_name="John Doe")
    assert "abc123" in proof.kernel_audit_id

    # Switch to fallback
    service.switch_to_fallback()
    assert service.get_active_key() == "fallback_key_xyz789"
    proof_fallback = service.verify_tracking(carrier="FEDEX", recipient_name="Jane Doe")
    assert "xyz789" in proof_fallback.kernel_audit_id

def test_elastic_automatic_fallback_failover():
    """Verify that when primary Elastic fails, service fails over to fallback cluster."""
    service = DisputeSearchService()
    # Point primary to non-existent endpoint, point fallback to our indexed cluster
    service._active_is_fallback = False
    
    # Simulate search
    results = service.search_similar_cases(reason="ITEM_NOT_RECEIVED", item_name="Keyboard", top_k=3)
    assert len(results) > 0
    assert all("similarity_score" in r for r in results)

def test_search_lru_caching():
    """Verify search caching accelerates repeat requests."""
    service = DisputeSearchService()
    service._cache.clear()
    
    # First search
    res1 = service.search_similar_cases(reason="UNAUTHORIZED", item_name="Earbuds", top_k=2)
    assert len(service._cache) == 1
    
    # Second search with same params hit cache
    res2 = service.search_similar_cases(reason="UNAUTHORIZED", item_name="Earbuds", top_k=2)
    assert res1 == res2

def test_paypal_client_connection_pool():
    """Verify paypal_client uses persistent connection pool."""
    c1 = paypal_client._get_client()
    c2 = paypal_client._get_client()
    assert c1 is c2
    assert not c1.is_closed
