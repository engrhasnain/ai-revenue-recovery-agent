from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate, CustomerWithStats
from app.services.recovery_service import refresh_customer_outstanding, refresh_customer_risk
from app.utils.demo_guard import block_if_public_demo
from app.utils.rate_limit import AI_RATE_LIMIT, limiter

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/", response_model=list[CustomerWithStats])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    risk_level: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer).options(selectinload(Customer.invoices))

    if search:
        query = query.where(
            Customer.name.ilike(f"%{search}%")
            | Customer.email.ilike(f"%{search}%")
            | Customer.company.ilike(f"%{search}%")
        )
    if risk_level:
        query = query.where(Customer.risk_level == risk_level)

    query = query.offset(skip).limit(limit).order_by(Customer.created_at.desc())
    result = await db.execute(query)
    customers = result.scalars().all()

    out = []
    for c in customers:
        stats = CustomerWithStats.model_validate(c)
        stats.total_invoices = len(c.invoices)
        stats.overdue_invoices = sum(1 for inv in c.invoices if inv.status == InvoiceStatus.OVERDUE)
        stats.total_paid = sum(inv.amount_paid for inv in c.invoices)
        out.append(stats)
    return out


@router.post("/", response_model=CustomerRead, status_code=201)
async def create_customer(payload: CustomerCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Customer).where(Customer.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Customer with this email already exists")

    customer = Customer(**payload.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerWithStats)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer)
        .where(Customer.id == customer_id)
        .options(selectinload(Customer.invoices))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    stats = CustomerWithStats.model_validate(customer)
    stats.total_invoices = len(customer.invoices)
    stats.overdue_invoices = sum(1 for inv in customer.invoices if inv.status == InvoiceStatus.OVERDUE)
    stats.total_paid = sum(inv.amount_paid for inv in customer.invoices)
    return stats


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: int, payload: CustomerUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.flush()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204, dependencies=[Depends(block_if_public_demo)])
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)


@router.post("/{customer_id}/refresh-risk", response_model=CustomerRead)
@limiter.limit(AI_RATE_LIMIT)
async def refresh_risk(request: Request, customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer)
        .where(Customer.id == customer_id)
        .options(selectinload(Customer.invoices))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    await refresh_customer_outstanding(customer, db)
    await refresh_customer_risk(customer, db)
    await db.refresh(customer)
    return customer
