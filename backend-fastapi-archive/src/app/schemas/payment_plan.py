from datetime import date, datetime

from pydantic import BaseModel

from app.models.payment_plan import PlanStatus


class PaymentPlanBase(BaseModel):
    customer_id: int
    invoice_id: int
    total_amount: float
    installments: int
    installment_amount: float
    frequency: str = "monthly"
    start_date: date


class PaymentPlanCreate(PaymentPlanBase):
    pass


class PaymentPlanRead(PaymentPlanBase):
    id: int
    next_due_date: date
    amount_paid: float
    installments_paid: int
    status: PlanStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
