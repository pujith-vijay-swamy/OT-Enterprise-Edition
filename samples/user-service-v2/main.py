from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="User Microservice", version="2.0.0")

class UserResponseV2(BaseModel):
    id: str
    user_email: str  # Breaking change: field renamed from 'email' to 'user_email'
    # Breaking change: 'is_active' field deleted
    user_role: str = "member"

class UserCreateRequest(BaseModel):
    user_email: str
    full_name: str
    password: str

@app.get("/api/v1/users/{tenant_id}/{user_id}", response_model=UserResponseV2)
def get_user_profile_v2(tenant_id: str, user_id: str):
    """
    Retrieve user profile (V2 schema).
    Added required tenant_id parameter.
    """
    return UserResponseV2(id=user_id, user_email="alice@repotrace.io", user_role="admin")

@app.post("/api/v1/users", response_model=UserResponseV2)
def create_user(payload: UserCreateRequest):
    return UserResponseV2(id="usr_999", user_email=payload.user_email)

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "version": "v2.0.0"}
