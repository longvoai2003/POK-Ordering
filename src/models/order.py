from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class OrderItem(BaseModel):
    order_id: str = ""
    category: str = ""
    component_id: str = ""
    component_name: str = ""
    portion: float = 0.0
    unit: str = "g"
    cost: float = 0.0


class Order(BaseModel):
    order_id: str
    channel: str = "website"
    status: str = "pending"
    payment_method: str = "vietqr"
    total_price: float = 0.0

    full_name: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""

    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0

    qr_url: Optional[str] = None
    paid_at: Optional[str] = None

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    items: list[OrderItem] = Field(default_factory=list)
