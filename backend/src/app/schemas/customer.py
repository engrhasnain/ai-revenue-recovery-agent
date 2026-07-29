from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.customer import RiskLevel


class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    whatsapp: str | None = None
    company: str | None = None
    country: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    company: str | None = None
    country: str | None = None
    address: str | None = None
    risk_level: RiskLevel | None = None
    notes: str | None = None


class CustomerRead(CustomerBase):
    id: int
    risk_level: RiskLevel
    total_outstanding: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerWithStats(CustomerRead):
    total_invoices: int = 0
    overdue_invoices: int = 0
    total_paid: float = 0.0
