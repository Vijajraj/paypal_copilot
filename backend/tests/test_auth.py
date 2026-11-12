import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_user_by_email,
    create_user
)

client = TestClient(app)

def test_password_hashing():
    raw = "SecureSecret123!"
    hashed = hash_password(raw)
    assert hashed != raw
    assert "$" in hashed
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_token_lifecycle():
    payload = {"sub": "usr_test_999", "email": "test@domain.com", "role": "analyst"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "usr_test_999"
    assert decoded["email"] == "test@domain.com"
    assert decoded["role"] == "analyst"
    assert "exp" in decoded

def test_demo_users_endpoint():
    res = client.get("/api/auth/demo-users")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["demo_accounts"]) == 3
    roles = [acc["role"] for acc in data["demo_accounts"]]
    assert "admin" in roles
    assert "analyst" in roles
    assert "viewer" in roles

def test_login_demo_admin():
    res = client.post("/api/auth/login", json={
        "email": "admin@paypalcopilot.com",
        "password": "Admin123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == "admin@paypalcopilot.com"

def test_login_demo_analyst():
    res = client.post("/api/auth/login", json={
        "email": "analyst@paypalcopilot.com",
        "password": "Analyst123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "analyst"

def test_login_demo_viewer():
    res = client.post("/api/auth/login", json={
        "email": "viewer@paypalcopilot.com",
        "password": "Viewer123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "viewer"

def test_login_invalid_password():
    res = client.post("/api/auth/login", json={
        "email": "admin@paypalcopilot.com",
        "password": "WrongPassword999!"
    })
    assert res.status_code == 401

def test_auth_me_authenticated():
    # Login as admin
    login_res = client.post("/api/auth/login", json={
        "email": "admin@paypalcopilot.com",
        "password": "Admin123!"
    })
    token = login_res.json()["access_token"]
    
    # Query /auth/me
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == "admin@paypalcopilot.com"
    assert data["user"]["role"] == "admin"

def test_register_new_user():
    import uuid
    random_email = f"user_{uuid.uuid4().hex[:8]}@testcompany.org"
    res = client.post("/api/auth/register", json={
        "email": random_email,
        "password": "NewUserPassword456!",
        "full_name": "Taylor Swift",
        "role": "analyst"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == random_email
    assert data["user"]["full_name"] == "Taylor Swift"
    assert data["user"]["role"] == "analyst"


def test_viewer_cannot_approve_dispute():
    # Login as viewer
    login_res = client.post("/api/auth/login", json={
        "email": "viewer@paypalcopilot.com",
        "password": "Viewer123!"
    })
    viewer_token = login_res.json()["access_token"]
    
    # Attempt to approve dispute PP-D-12345
    approve_res = client.post(
        "/api/disputes/PP-D-12345/approve",
        headers={
            "Authorization": f"Bearer {viewer_token}",
            "x-approval-secret": "ccf085057cf069712cebc1e32b3d13a165fb63fe57282150dbb6285350bd65b9"
        },
        json={
            "approver_id": "Morgan Chen",
            "approval_secret": "ccf085057cf069712cebc1e32b3d13a165fb63fe57282150dbb6285350bd65b9"
        }
    )
    assert approve_res.status_code == 403
    assert "Forbidden" in approve_res.json()["detail"] or "viewer" in approve_res.json()["detail"]
