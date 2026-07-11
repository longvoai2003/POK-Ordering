from typing import Literal, Optional
from pydantic import BaseModel, Field


class ComponentResponse(BaseModel):
    component_id: str
    component_name: str
    category: str
    is_available: bool = True
    default_portion: float
    unit: str
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float = 0.0
    min_portion: float
    max_portion: float
    portion_step: float
    description: str
    cost: float
    skip_portion: bool = False


class MenuResponse(BaseModel):
    categories: dict[str, list[ComponentResponse]]


class MealItem(BaseModel):
    component_id: str
    portion: float


class DeliveryInfo(BaseModel):
    full_name: str
    phone: str
    address: str
    notes: str = ""
    payment_method: Literal["vietqr", "cod"] = "vietqr"


class CreateOrderRequest(BaseModel):
    meal: dict[str, Optional[list[MealItem]]]
    delivery: DeliveryInfo


class UpdateOrderRequest(BaseModel):
    meal: dict[str, Optional[list[MealItem]]]
    delivery: DeliveryInfo


class CreateOrderResponse(BaseModel):
    order_id: str
    total_price: float
    qr_url: Optional[str] = None
    bank_details: Optional[dict[str, str]] = None
    status: str


class OrderStatusResponse(BaseModel):
    order_id: str
    status: str
    total_price: float
    qr_url: Optional[str] = None
    bank_details: Optional[dict[str, str]] = None
    delivery: DeliveryInfo
    meal: dict[str, Optional[list[MealItem]]]
