from datetime import date, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer, RiskLevel
from app.models.invoice import Invoice, InvoiceStatus
from app.models.reminder import Reminder, ReminderChannel, ReminderType
from app.services import ai_service, notification_service


async def refresh_overdue_status(db: AsyncSession) -> int:
    """Mark all past-due invoices as overdue and update days_overdue. Returns count updated."""
    today = date.today()
    result = await db.execute(
        select(Invoice).where(
            Invoice.due_date < today,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
        )
    )
    invoices = result.scalars().all()

    for invoice in invoices:
        invoice.days_overdue = (today - invoice.due_date).days
        invoice.status = InvoiceStatus.OVERDUE

    await db.flush()
    return len(invoices)


async def refresh_customer_risk(customer: Customer, db: AsyncSession) -> RiskLevel:
    """Re-classify a customer's risk level using AI based on their invoice state."""
    overdue_invoices = [inv for inv in customer.invoices if inv.status == InvoiceStatus.OVERDUE]
    max_days = max((inv.days_overdue for inv in overdue_invoices), default=0)

    risk = await ai_service.classify_customer_risk(
        customer_name=customer.name,
        days_overdue=max_days,
        total_outstanding=customer.total_outstanding,
        reminder_count=sum(inv.reminder_count for inv in overdue_invoices),
        payment_history_notes=customer.notes or "",
    )
    customer.risk_level = risk
    await db.flush()
    return risk


async def refresh_customer_outstanding(customer: Customer, db: AsyncSession) -> float:
    """Recalculate and persist total_outstanding for a customer."""
    result = await db.execute(
        select(Invoice).where(
            Invoice.customer_id == customer.id,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID]),
        )
    )
    invoices = result.scalars().all()
    total = sum(inv.amount - inv.amount_paid for inv in invoices)
    customer.total_outstanding = total
    await db.flush()
    return total


async def generate_and_send_reminder(
    invoice_id: int,
    channel: ReminderChannel,
    reminder_type: ReminderType,
    db: AsyncSession,
    custom_instructions: str | None = None,
) -> Reminder:
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")

    customer = invoice.customer

    content = await ai_service.generate_reminder_message(
        customer_name=customer.name,
        company=customer.company,
        invoice_number=invoice.invoice_number,
        amount_due=invoice.amount - invoice.amount_paid,
        currency=invoice.currency,
        days_overdue=invoice.days_overdue,
        due_date=str(invoice.due_date),
        channel=channel,
        reminder_type=reminder_type,
        country=customer.country or "",
        custom_instructions=custom_instructions,
    )

    reminder = Reminder(
        customer_id=customer.id,
        invoice_id=invoice.id,
        channel=channel,
        reminder_type=reminder_type,
        subject=content.get("subject"),
        message=content["message"],
        ai_generated=True,
    )
    db.add(reminder)
    await db.flush()

    await notification_service.dispatch_reminder(
        reminder=reminder,
        customer_email=customer.email,
        customer_phone=customer.phone,
        customer_whatsapp=customer.whatsapp,
        db=db,
    )

    invoice.reminder_count += 1
    invoice.last_reminder_at = datetime.utcnow()

    if reminder_type == ReminderType.ESCALATION:
        invoice.status = InvoiceStatus.ESCALATED
        invoice.escalated_at = datetime.utcnow()

    await db.flush()
    return reminder


async def escalate_invoice(invoice_id: int, db: AsyncSession) -> Invoice:
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")

    invoice.status = InvoiceStatus.ESCALATED
    invoice.escalated_at = datetime.utcnow()

    await generate_and_send_reminder(
        invoice_id=invoice_id,
        channel=ReminderChannel.EMAIL,
        reminder_type=ReminderType.ESCALATION,
        db=db,
    )

    await db.flush()
    return invoice
