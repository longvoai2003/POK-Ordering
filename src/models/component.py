from pydantic import BaseModel, Field


class Component(BaseModel):
    component_id: str = ""
    component_name: str = ""
    category: str = ""
    is_available: bool = True
    default_portion: float = 0.0
    unit: str = ""
    calories: float = 0.0
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0
    dietary_tags: list[str] = Field(default_factory=list)
    min_portion: float = 0.0
    max_portion: float = 0.0
    portion_step: float = 0.0
    description: str = ""
    fiber: float = 0.0
    cost: float = 0.0
    kitchen_notes: str = ""
    # allergen_tags: list[str] = Field(default_factory=list)  # future
    skip_portion: bool = False
