from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.reminder import Reminder, ReminderChannel, ReminderType
from app.schemas.reminder import GenerateReminderRequest, LogResponseRequest, ReminderRead, SendReminderRequest
from app.services.notification_service import dispatch_reminder
from app.services.recovery_service import generate_and_send_reminder, escalate_invoice
from app.services.ai_service import analyze_customer_response
from app.utils.rate_limit import AI_RATE_LIMIT, limiter

router = APIRouter(prefix="/reminders", tags=["Reminders"])


@router.get("/", response_model=list[ReminderRead])
async def list_reminders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: int | None = Query(None),
    invoice_id: int | None = Query(None),
    channel: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Reminder).order_by(Reminder.created_at.desc())

    if customer_id:
        query = query.where(Reminder.customer_id == customer_id)
    if invoice_id:
        query = query.where(Reminder.invoice_id == invoice_id)
    if channel:
        query = query.where(Reminder.channel == channel)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/generate-and-send", response_model=ReminderRead, status_code=201)
@limiter.limit(AI_RATE_LIMIT)
async def generate_and_send(
    request: Request, payload: GenerateReminderRequest, db: AsyncSession = Depends(get_db)
):
    try:
        reminder = await generate_and_send_reminder(
            invoice_id=payload.invoice_id,
            channel=payload.channel,
            reminder_type=payload.reminder_type,
            db=db,
            custom_instructions=payload.custom_instructions,
        )
        return reminder
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{reminder_id}", response_model=ReminderRead)
async def get_reminder(reminder_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@router.post("/{reminder_id}/resend", response_model=ReminderRead)
async def resend_reminder(reminder_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Reminder)
        .where(Reminder.id == reminder_id)
        .options(selectinload(Reminder.customer))
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    customer = reminder.customer
    await dispatch_reminder(
        reminder=reminder,
        customer_email=customer.email,
        customer_phone=customer.phone,
        customer_whatsapp=customer.whatsapp,
        db=db,
    )
    return reminder


@router.post("/{reminder_id}/log-response", response_model=dict)
@limiter.limit(AI_RATE_LIMIT)
async def log_response(
    request: Request,
    reminder_id: int,
    payload: LogResponseRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reminder)
        .where(Reminder.id == reminder_id)
        .options(selectinload(Reminder.invoice))
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    reminder.response_received = True
    reminder.response_text = payload.response_text
    await db.flush()

    invoice = reminder.invoice
    analysis = await analyze_customer_response(
        response_text=payload.response_text,
        invoice_number=invoice.invoice_number,
        amount_due=invoice.amount - invoice.amount_paid,
    )
    return {"reminder_id": reminder_id, "analysis": analysis}


@router.post("/escalate/{invoice_id}", response_model=dict)
@limiter.limit(AI_RATE_LIMIT)
async def escalate(request: Request, invoice_id: int, db: AsyncSession = Depends(get_db)):
    try:
        invoice = await escalate_invoice(invoice_id, db)
        return {"message": f"Invoice {invoice.invoice_number} escalated successfully", "invoice_id": invoice_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
