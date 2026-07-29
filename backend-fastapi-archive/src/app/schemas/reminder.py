from datetime import datetime

from pydantic import BaseModel

from app.models.reminder import ReminderChannel, ReminderStatus, ReminderType


class ReminderBase(BaseModel):
    customer_id: int
    invoice_id: int
    channel: ReminderChannel
    reminder_type: ReminderType
    message: str
    subject: str | None = None
    ai_generated: bool = True


class ReminderCreate(ReminderBase):
    pass


class ReminderRead(ReminderBase):
    id: int
    status: ReminderStatus
    sent_at: datetime | None
    response_received: bool
    response_text: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateReminderRequest(BaseModel):
    invoice_id: int
    channel: ReminderChannel
    reminder_type: ReminderType
    custom_instructions: str | None = None


class SendReminderRequest(BaseModel):
    reminder_id: int


class LogResponseRequest(BaseModel):
    response_text: str
