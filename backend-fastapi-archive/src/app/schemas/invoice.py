from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.models.invoice import InvoiceStatus


class InvoiceBase(BaseModel):
    invoice_number: str
    customer_id: int
    amount: float
    currency: str = "USD"
    issue_date: date
    due_date: date
    description: str | None = None
    notes: str | None = None


class InvoiceCreate(InvoiceBase):
    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class InvoiceUpdate(BaseModel):
    amount_paid: float | None = None
    status: InvoiceStatus | None = None
    due_date: date | None = None
    notes: str | None = None


class InvoiceRead(InvoiceBase):
    id: int
    amount_paid: float
    status: InvoiceStatus
    days_overdue: int
    reminder_count: int
    last_reminder_at: datetime | None
    escalated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    amount_due: float = 0.0

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        # Compute amount_due from the ORM object if it's not already set
        if hasattr(obj, "amount") and hasattr(obj, "amount_paid"):
            instance.amount_due = obj.amount - obj.amount_paid
        return instance
