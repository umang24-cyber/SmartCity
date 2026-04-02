from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from middleware.auth import create_access_token, get_current_user
from custom_db.users import (
    get_user,
    pwd_context,
    create_user,
    upsert_google_user,
    validate_supervisor_access_key,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

class LegacyLoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserLoginRequest(BaseModel):
    email: str
    password: str | None = None

class SupervisorLoginRequest(BaseModel):
    email: str
    access_key: str

class UserSignupRequest(BaseModel):
    name: str
    email: str
    password: str

class GoogleSignupRequest(BaseModel):
    name: str
    email: str
    google_token: str | None = None

class SupervisorSignupRequest(BaseModel):
    name: str
    email: str
    password: str
    access_key: str


def _build_auth_response(user_dict: dict):
    access_token = create_access_token(data={"sub": user_dict["email"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_dict["id"],
            "name": user_dict["name"],
            "email": user_dict["email"],
            "role": user_dict["role"],
        },
    }


@router.post("/signup/user", response_model=LoginResponse)
async def signup_user(request: UserSignupRequest):
    created = create_user(
        name=request.name,
        email=request.email,
        role="user",
        password=request.password,
        auth_provider="password",
    )
    if not created:
        raise HTTPException(status_code=400, detail="Unable to create user. Email may already exist.")
    return _build_auth_response(created)


@router.post("/signup/google", response_model=LoginResponse)
async def signup_google_user(request: GoogleSignupRequest):
    # For demo mode, token is optional and treated as pre-verified by frontend.
    created = upsert_google_user(name=request.name, email=request.email)
    if not created:
        raise HTTPException(status_code=400, detail="Google signup only allowed for normal users.")
    return _build_auth_response(created)


@router.post("/signup/supervisor", response_model=LoginResponse)
async def signup_supervisor(request: SupervisorSignupRequest):
    # Enforce supervisor email pattern
    if not request.email.endswith("@smartcity.gov") and not request.email.endswith(".gov"):
        raise HTTPException(
            status_code=400, 
            detail="Supervisor registration requires a verified government email (@smartcity.gov)."
        )
    
    if not validate_supervisor_access_key(request.access_key):
        raise HTTPException(status_code=403, detail="Invalid primary supervisor access key.")

    created = create_user(
        name=request.name,
        email=request.email,
        role="supervisor",
        password=request.password,
        auth_provider="password",
    )
    if not created:
        raise HTTPException(status_code=400, detail="Unable to create supervisor account. Email may already exist.")
    return _build_auth_response(created)


@router.post("/login/user", response_model=LoginResponse)
async def login_user(request: UserLoginRequest):
    user_dict = get_user(request.email)
    if not user_dict:
        raise HTTPException(status_code=400, detail="Invalid Credentials")

    if user_dict["role"] != "user":
        raise HTTPException(status_code=403, detail="Use the supervisor login flow for this account.")

    if user_dict.get("auth_provider") == "password":
        if not request.password or not user_dict.get("hashed_password"):
            raise HTTPException(status_code=400, detail="Password is required.")
        if not pwd_context.verify(request.password, user_dict["hashed_password"]):
            raise HTTPException(status_code=400, detail="Invalid Credentials")

    return _build_auth_response(user_dict)


@router.post("/login/supervisor", response_model=LoginResponse)
async def login_supervisor(request: SupervisorLoginRequest):
    user_dict = get_user(request.email)
    if not user_dict or user_dict["role"] != "supervisor":
        raise HTTPException(status_code=400, detail="Supervisor account not found.")
    if not validate_supervisor_access_key(request.access_key):
        raise HTTPException(status_code=403, detail="Invalid supervisor access key.")
    return _build_auth_response(user_dict)


@router.post("/login", response_model=LoginResponse)
async def login_legacy(request: LegacyLoginRequest):
    # Backward compatible login for existing clients using email/password.
    user_dict = get_user(request.email)
    if not user_dict:
        raise HTTPException(status_code=400, detail="Invalid Credentials")
    if not user_dict.get("hashed_password"):
        raise HTTPException(status_code=400, detail="This account does not use password login.")
    if not pwd_context.verify(request.password, user_dict["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid Credentials")
    return _build_auth_response(user_dict)

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"]
    }
