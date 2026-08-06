from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="User Microservice", version="1.0.0")

class UserResponse(BaseModel):
    id: str
    email: str
    is_active: bool
    role: str = "member"

class UserCreateRequest(BaseModel):
    email: str
    full_name: str
    password: str

@app.get("/api/v1/users/{user_id}", response_model=UserResponse)
def get_user_profile(user_id: str):
    """Retrieve user details by unique identifier"""
    if user_id == "404":
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=user_id, email="alice@repotrace.io", is_active=True, role="admin")

@app.post("/api/v1/users", response_model=UserResponse)
def create_user(payload: UserCreateRequest):
    """Register a new user in system"""
    return UserResponse(id="usr_999", email=payload.email, is_active=True)

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "user-service"}
