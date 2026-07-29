from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.invoice import Invoice, InvoiceStatus
from app.models.customer import Customer
from app.models.reminder import Reminder
from app.schemas.invoice import InvoiceCreate, InvoiceRead, InvoiceUpdate
from app.services.recovery_service import refresh_customer_outstanding
from app.services import ai_service
from app.utils.demo_guard import block_if_public_demo
from app.utils.rate_limit import AI_RATE_LIMIT, limiter

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("/", response_model=list[InvoiceRead])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    customer_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice)

    if status:
        query = query.where(Invoice.status == status)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)

    query = query.offset(skip).limit(limit).order_by(Invoice.due_date.asc())
    result = await db.execute(query)
    invoices = result.scalars().all()

    # Attach computed amount_due
    out = []
    for inv in invoices:
        data = InvoiceRead.model_validate(inv)
        data.amount_due = inv.amount - inv.amount_paid
        out.append(data)
    return out


@router.post("/", response_model=InvoiceRead, status_code=201)
async def create_invoice(payload: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    existing = await db.execute(
        select(Invoice).where(Invoice.invoice_number == payload.invoice_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Invoice number already exists")

    invoice = Invoice(**payload.model_dump())
    db.add(invoice)
    await db.flush()

    await refresh_customer_outstanding(customer, db)
    await db.refresh(invoice)

    data = InvoiceRead.model_validate(invoice)
    data.amount_due = invoice.amount - invoice.amount_paid
    return data


@router.get("/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(invoice_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    data = InvoiceRead.model_validate(invoice)
    data.amount_due = invoice.amount - invoice.amount_paid
    return data


@router.patch("/{invoice_id}", response_model=InvoiceRead)
async def update_invoice(
    invoice_id: int, payload: InvoiceUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)

    if invoice.amount_paid >= invoice.amount:
        invoice.status = InvoiceStatus.PAID

    await db.flush()
    await refresh_customer_outstanding(invoice.customer, db)
    await db.refresh(invoice)

    data = InvoiceRead.model_validate(invoice)
    data.amount_due = invoice.amount - invoice.amount_paid
    return data


@router.delete("/{invoice_id}", status_code=204, dependencies=[Depends(block_if_public_demo)])
async def delete_invoice(invoice_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    customer = invoice.customer
    await db.delete(invoice)
    await db.flush()
    await refresh_customer_outstanding(customer, db)


@router.get("/{invoice_id}/next-action")
@limiter.limit(AI_RATE_LIMIT)
async def next_action(request: Request, invoice_id: int, db: AsyncSession = Depends(get_db)):
    """AI recommendation for the best next step on this invoice."""
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    reminders_result = await db.execute(
        select(Reminder)
        .where(Reminder.invoice_id == invoice_id)
        .order_by(Reminder.created_at.desc())
        .limit(1)
    )
    last_reminder = reminders_result.scalar_one_or_none()

    last_response_intent = None
    if last_reminder and last_reminder.response_received and last_reminder.response_text:
        last_response_intent = last_reminder.response_text[:200]

    action = await ai_service.suggest_next_action(
        days_overdue=invoice.days_overdue,
        reminder_count=invoice.reminder_count,
        last_channel=last_reminder.channel if last_reminder else None,
        last_response_intent=last_response_intent,
        risk_level=invoice.customer.risk_level if invoice.customer else "medium",
        total_outstanding=invoice.amount - invoice.amount_paid,
    )
    return action


@router.post("/bulk-extract")
@limiter.limit(AI_RATE_LIMIT)
async def bulk_extract_invoices(request: Request, files: list[UploadFile] = File(...)):
    """Extract invoice data from uploaded images or PDFs using AI vision."""
    results = []
    for file in files:
        content = await file.read()
        extracted = await ai_service.extract_invoice_from_document(
            content,
            file.content_type or "application/octet-stream",
            file.filename or "document",
        )
        extracted["filename"] = file.filename or "document"
        results.append(extracted)
    return results


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceRead)
async def mark_paid(invoice_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.customer))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.amount_paid = invoice.amount
    invoice.status = InvoiceStatus.PAID
    await db.flush()
    await refresh_customer_outstanding(invoice.customer, db)
    await db.refresh(invoice)

    data = InvoiceRead.model_validate(invoice)
    data.amount_due = 0.0
    return data
