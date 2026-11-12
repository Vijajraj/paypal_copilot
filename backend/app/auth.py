import os
import json
import uuid
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

# Secret key resolution
try:
    from backend.app.secrets import JWT_SECRET_KEY
except ImportError:
    try:
        from .secrets import JWT_SECRET_KEY
    except ImportError:
        JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "copilot_jwt_secure_fallback_secret_key_2026")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

DATA_DIR = Path(__file__).resolve().parent
USERS_FILE = DATA_DIR / "local_users.json"

security_bearer = HTTPBearer(auto_error=False)

# ----------------- Password Hashing -----------------
def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 rounds and random 16-byte salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against salt$hash string with constant-time comparison."""
    try:
        if "$" not in hashed_password:
            return False
        salt, key_hex = hashed_password.split("$", 1)
        key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

# ----------------- JWT Generation & Decoding -----------------
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

# ----------------- Persistence & Seed Users -----------------
DEFAULT_SEED_USERS = [
    {
        "id": "usr_admin_001",
        "email": "admin@paypalcopilot.com",
        "full_name": "Sarah Jenkins",
        "role": "admin",
        "password_hash": hash_password("Admin123!"),
        "created_at": "2026-11-01T00:00:00Z"
    },
    {
        "id": "usr_analyst_002",
        "email": "analyst@paypalcopilot.com",
        "full_name": "Alex Rivera",
        "role": "analyst",
        "password_hash": hash_password("Analyst123!"),
        "created_at": "2026-11-01T00:00:00Z"
    },
    {
        "id": "usr_viewer_003",
        "email": "viewer@paypalcopilot.com",
        "full_name": "Morgan Chen",
        "role": "viewer",
        "password_hash": hash_password("Viewer123!"),
        "created_at": "2026-11-01T00:00:00Z"
    }
]

def load_users() -> Dict[str, Dict[str, Any]]:
    """Load users mapped by lowercase email from JSON file."""
    if not USERS_FILE.exists():
        save_users({u["email"]: u for u in DEFAULT_SEED_USERS})
        return {u["email"]: u for u in DEFAULT_SEED_USERS}
    
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not data:
                save_users({u["email"]: u for u in DEFAULT_SEED_USERS})
                return {u["email"]: u for u in DEFAULT_SEED_USERS}
            return data
    except Exception:
        return {u["email"]: u for u in DEFAULT_SEED_USERS}

def save_users(users: Dict[str, Dict[str, Any]]) -> None:
    """Save users dictionary to local JSON file."""
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print(f"Error saving users file: {e}")

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    users = load_users()
    return users.get(email.strip().lower())

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    users = load_users()
    for u in users.values():
        if u.get("id") == user_id:
            return u
    return None

def create_user(email: str, password: str, full_name: str, role: str = "analyst") -> Dict[str, Any]:
    email_clean = email.strip().lower()
    users = load_users()
    if email_clean in users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{email_clean}' already exists."
        )
    
    valid_roles = ["admin", "analyst", "viewer"]
    if role not in valid_roles:
        role = "analyst"

    new_user = {
        "id": f"usr_{uuid.uuid4().hex[:12]}",
        "email": email_clean,
        "full_name": full_name.strip(),
        "role": role,
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users[email_clean] = new_user
    save_users(users)
    return new_user

# ----------------- Pydantic Models -----------------
class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email address")
    password: str = Field(..., min_length=6, description="Minimum 6 characters")
    full_name: str = Field(..., min_length=2)
    role: Optional[str] = "analyst"

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: str

class TokenAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

# ----------------- FastAPI Dependencies -----------------
def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Optional[Dict[str, Any]]:
    """Extract user from Bearer JWT token if present, returns None if anonymous."""
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = get_user_by_id(user_id)
    return user

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Dict[str, Any]:
    """Require valid authenticated Bearer JWT token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_roles(allowed_roles: List[str]):
    """Role-based access guard dependency."""
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = user.get("role", "viewer")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {allowed_roles}, your role is '{user_role}'."
            )
        return user
    return role_checker
