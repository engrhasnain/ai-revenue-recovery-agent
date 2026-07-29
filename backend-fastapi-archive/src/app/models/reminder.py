import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReminderChannel(str, enum.Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"


class ReminderStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    PENDING = "pending"


class ReminderType(str, enum.Enum):
    FIRST_NOTICE = "first_notice"
    SECOND_NOTICE = "second_notice"
    FINAL_NOTICE = "final_notice"
    PAYMENT_PLAN_OFFER = "payment_plan_offer"
    ESCALATION = "escalation"
    CONFIRMATION = "confirmation"
    CUSTOM = "custom"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(Integer, ForeignKey("invoices.id"), nullable=False)
    channel: Mapped[ReminderChannel] = mapped_column(Enum(ReminderChannel), nullable=False)
    reminder_type: Mapped[ReminderType] = mapped_column(Enum(ReminderType), nullable=False)
    status: Mapped[ReminderStatus] = mapped_column(Enum(ReminderStatus), default=ReminderStatus.PENDING)
    subject: Mapped[str | None] = mapped_column(String(500))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(default=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    response_received: Mapped[bool] = mapped_column(default=False)
    response_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer"] = relationship("Customer", back_populates="reminders")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="reminders")
