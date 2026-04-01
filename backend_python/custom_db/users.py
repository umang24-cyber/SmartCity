import os
import uuid
from passlib.context import CryptContext
from .persistence import load_all_data, save_data

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SUPERVISOR_ACCESS_KEY = os.getenv("SUPERVISOR_ACCESS_KEY", "SUP-2026-ACCESS")


def _safe_hash(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback in environments where bcrypt backend is unavailable (local development/test).
        return password


# Load existing users from persistence or use defaults
_persisted_data = load_all_data()
MOCK_USERS = _persisted_data.get("users", {
    "priya@test.com": {
        "id": "u1",
        "name": "Priya Sharma",
        "email": "priya@test.com",
        "hashed_password": _safe_hash("citizen123"),
        "role": "user",
        "auth_provider": "password",
    },
    "arjun@test.com": {
        "id": "u2",
        "name": "Arjun Mehta",
        "email": "arjun@test.com",
        "hashed_password": None,
        "role": "supervisor",
        "auth_provider": "access_key",
    },
    "kavita@test.com": {
        "id": "u3",
        "name": "Kavita Singh",
        "email": "kavita@test.com",
        "hashed_password": _safe_hash("officer123"),
        "role": "officer",
        "auth_provider": "password",
    },
})

def get_user(email: str):
    return MOCK_USERS.get(email.lower())

def create_user(name: str, email: str, role: str, password: str | None = None, auth_provider: str = "password"):
    normalized_email = email.lower()
    if normalized_email in MOCK_USERS:
        return None
        
    # FIX: Allow supervisor creation if called via validated endpoint
    if auth_provider == "password" and not password:
        return None

    user = {
        "id": f"u_{uuid.uuid4().hex[:8]}",
        "name": name.strip() if name else normalized_email.split("@")[0],
        "email": normalized_email,
        "hashed_password": _safe_hash(password) if password else None,
        "role": role,
        "auth_provider": auth_provider,
    }
    MOCK_USERS[normalized_email] = user
    save_data("users", MOCK_USERS)
    return user

def upsert_google_user(name: str, email: str):
    normalized_email = email.lower()
    existing = MOCK_USERS.get(normalized_email)
    if existing:
        if existing["role"] != "user":
            return None
        existing["auth_provider"] = "google"
        existing["hashed_password"] = None
        if name:
            existing["name"] = name.strip()
        save_data("users", MOCK_USERS)
        return existing

    user = {
        "id": f"u_{uuid.uuid4().hex[:8]}",
        "name": name.strip() if name else normalized_email.split("@")[0],
        "email": normalized_email,
        "hashed_password": None,
        "role": "user",
        "auth_provider": "google",
    }
    MOCK_USERS[normalized_email] = user
    save_data("users", MOCK_USERS)
    return user

def validate_supervisor_access_key(access_key: str):
    return access_key == SUPERVISOR_ACCESS_KEY
