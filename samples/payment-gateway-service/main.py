from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

app = FastAPI(title="Payment Gateway Service", version="1.0.0")

class ChargeRequest(BaseModel):
    user_id: str
    amount: float
    currency: str = "USD"

class ChargeResponse(BaseModel):
    charge_id: str
    status: str
    amount: float
    currency: str

class PaymentHistoryResponse(BaseModel):
    user_id: str
    total_charges: int
    account_status: str

@app.post("/api/v1/payments/charge", response_model=ChargeResponse)
def charge_payment(payload: ChargeRequest):
    # Validate user first by calling user-service
    user_res = requests.get(f"http://user-service:8000/api/v1/users/{payload.user_id}")
    if user_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid user")

    return ChargeResponse(
        charge_id="ch_8823194a",
        status="SUCCESS",
        amount=payload.amount,
        currency=payload.currency
    )

@app.get("/api/v1/payments/history/{user_id}", response_model=PaymentHistoryResponse)
def get_payment_history(user_id: str):
    return PaymentHistoryResponse(
        user_id=user_id,
        total_charges=14,
        account_status="ACTIVE"
    )
