import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.session import Session

UnitType = Literal["g", "ml", "egg"]


class ChefRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    customer_id: str = ""
    channel: str = "manychat"
    customer_type: str = "unknown"

    full_name: str = ""
    delivery_address: str = ""
    phone_number: str = ""
    delivery_time: str = ""

    selected_base: str = ""
    base_portion: float = 0.0

    selected_protein: str = ""
    protein_portion: float = 0.0

    selected_cook_veg: str = ""
    cook_veg_portion: float = 0.0

    selected_raw_veg: str = ""
    raw_veg_portion: float = 0.0

    selected_sauce: str = ""
    sauce_portion: float = 0.0

    selected_topping: str = ""
    topping_portion: float = 0.0

    selected_egg: str = ""
    egg_portion: float = 0.0

    selected_cooking_oil: str = ""
    cooking_oil_portion: float = 0.0

    total_calories: float = 0.0
    total_carbs: float = 0.0
    total_protein: float = 0.0
    total_fat: float = 0.0

    customer_notes: str = ""
    chef_notes: str = ""
    status: str = "pending"

    @classmethod
    def from_session(cls, session: "Session") -> "ChefRequest":
        def _extract(cat: str) -> tuple[str, float]:
            items = session.selected_meal.get(cat, [])
            if items:
                return (
                    items[0].get("component_name", ""),
                    float(items[0].get("portion", 0)),
                )
            return "", 0.0

        name, portion = _extract("base")
        p_name, p_portion = _extract("protein")
        v_name, v_portion = _extract("cook_veg")
        rv_name, rv_portion = _extract("raw_veg")
        s_name, s_portion = _extract("sauce")
        t_name, t_portion = _extract("topping")
        e_name, e_portion = _extract("egg")
        o_name, o_portion = _extract("cooking_oil")

        cf = session.collected_fields
        m = session.total_macros

        return cls(
            customer_id=session.customer_id,
            channel=session.channel,
            customer_type=session.customer_type,
            full_name=cf.get("full_name", ""),
            delivery_address=cf.get("delivery_address", ""),
            phone_number=cf.get("phone_number", ""),
            delivery_time=cf.get("delivery_time", ""),
            selected_base=name,
            base_portion=portion,
            selected_protein=p_name,
            protein_portion=p_portion,
            selected_cook_veg=v_name,
            cook_veg_portion=v_portion,
            selected_raw_veg=rv_name,
            raw_veg_portion=rv_portion,
            selected_sauce=s_name,
            sauce_portion=s_portion,
            selected_topping=t_name,
            topping_portion=t_portion,
            selected_egg=e_name,
            egg_portion=e_portion,
            selected_cooking_oil=o_name,
            cooking_oil_portion=o_portion,
            total_calories=m.calories,
            total_protein=m.protein,
            total_fat=m.fat,
            total_carbs=m.carbs,
        )

    def to_row(self) -> list[str]:
        return [
            self.request_id,
            self.created_at,
            self.customer_id,
            self.channel,
            self.customer_type,
            self.full_name,
            self.delivery_address,
            self.phone_number,
            self.delivery_time,
            self.selected_base,
            str(self.base_portion),
            self.selected_protein,
            str(self.protein_portion),
            self.selected_cook_veg,
            str(self.cook_veg_portion),
            self.selected_raw_veg,
            str(self.raw_veg_portion),
            self.selected_sauce,
            str(self.sauce_portion),
            self.selected_topping,
            str(self.topping_portion),
            self.selected_egg,
            str(self.egg_portion),
            self.selected_cooking_oil,
            str(self.cooking_oil_portion),
            str(self.total_calories),
            str(self.total_protein),
            str(self.total_carbs),
            str(self.total_fat),
            self.customer_notes,
            self.chef_notes,
            self.status,
        ]
