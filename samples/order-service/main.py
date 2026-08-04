from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

app = FastAPI(title="Order Microservice", version="1.0.0")

class OrderCreateRequest(BaseModel):
    user_id: str
    item_count: int
    total_amount: float

class OrderResponse(BaseModel):
    order_id: str
    user_id: str
    item_count: int
    total_amount: float
    status: str

@app.post("/api/v1/orders", response_model=OrderResponse)
def create_order(payload: OrderCreateRequest):
    # Verify user profile first
    user_res = requests.get(f"http://user-service:8000/api/v1/users/{payload.user_id}")
    if user_res.status_code != 200:
        raise HTTPException(status_code=404, detail="User not found")

    # Initiate payment charge via payment-gateway
    charge_res = requests.post(
        "http://payment-gateway:8080/api/v1/payments/charge",
        json={"user_id": payload.user_id, "amount": payload.total_amount, "currency": "USD"}
    )
    if charge_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Payment processing failed")

    return OrderResponse(
        order_id="ord_99042a",
        user_id=payload.user_id,
        item_count=payload.item_count,
        total_amount=payload.total_amount,
        status="CONFIRMED"
    )

@app.get("/api/v1/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: str):
    return OrderResponse(
        order_id=order_id,
        user_id="usr_1001",
        item_count=3,
        total_amount=149.99,
        status="DELIVERED"
    )
