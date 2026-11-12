from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from ..auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserProfileResponse,
    TokenAuthResponse,
    create_access_token,
    verify_password,
    get_user_by_email,
    create_user,
    get_current_user,
    get_current_user_optional,
    DEFAULT_SEED_USERS
)

router = APIRouter(tags=["Authentication"])

@router.post("/auth/register", response_model=TokenAuthResponse)
@router.post("/api/auth/register", response_model=TokenAuthResponse)
def register(payload: UserRegisterRequest):
    """Register a new user account with role (admin, analyst, or viewer)."""
    user = create_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        role=payload.role or "analyst"
    )
    
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    })
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "created_at": user["created_at"]
        }
    }

@router.post("/auth/login", response_model=TokenAuthResponse)
@router.post("/api/auth/login", response_model=TokenAuthResponse)
def login(payload: UserLoginRequest):
    """Authenticate with email and password and receive a 24-hour JWT token."""
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    })
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "created_at": user["created_at"]
        }
    }

@router.get("/auth/me")
@router.get("/api/auth/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Return currently authenticated user profile from JWT Bearer token."""
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "created_at": user["created_at"]
        }
    }

@router.get("/auth/demo-users")
@router.get("/api/auth/demo-users")
def get_demo_users():
    """Return pre-configured demo credentials for 1-click test logins."""
    return {
        "success": True,
        "demo_accounts": [
            {
                "role": "admin",
                "label": "Lead Admin",
                "email": "admin@paypalcopilot.com",
                "password": "Admin123!",
                "name": "Sarah Jenkins",
                "permissions": "Full system control, dispute approvals, audit access, simulate disputes"
            },
            {
                "role": "analyst",
                "label": "Dispute Specialist",
                "email": "analyst@paypalcopilot.com",
                "password": "Analyst123!",
                "name": "Alex Rivera",
                "permissions": "Dispute reviews, AI redrafting, evidence submissions, audit trail"
            },
            {
                "role": "viewer",
                "label": "Audit Observer",
                "email": "viewer@paypalcopilot.com",
                "password": "Viewer123!",
                "name": "Morgan Chen",
                "permissions": "Read-only access: view disputes & AI drafts without approval powers"
            }
        ]
    }

@router.post("/auth/logout")
@router.post("/api/auth/logout")
def logout(user: Dict[str, Any] = Depends(get_current_user_optional)):
    """Acknowledge user logout."""
    return {
        "success": True,
        "message": f"Successfully logged out {user.get('email') if user else 'user'}."
    }
