from datetime import date
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer, RiskLevel
from app.models.invoice import Invoice, InvoiceStatus
from app.models.reminder import Reminder, ReminderStatus
from app.services.recovery_service import refresh_overdue_status
from app.services import ai_service
from app.utils.rate_limit import AI_RATE_LIMIT, limiter

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    # Refresh overdue statuses first
    updated = await refresh_overdue_status(db)

    # Invoice stats
    inv_result = await db.execute(
        select(Invoice.status, func.count(Invoice.id), func.sum(Invoice.amount), func.sum(Invoice.amount_paid))
        .group_by(Invoice.status)
    )
    invoice_rows = inv_result.all()

    total_invoices = sum(r[1] for r in invoice_rows)
    total_billed = sum(r[2] or 0 for r in invoice_rows)
    total_collected = sum(r[3] or 0 for r in invoice_rows)
    total_outstanding = total_billed - total_collected

    by_status = {r[0]: {"count": r[1], "amount": r[2] or 0} for r in invoice_rows}

    # Customer risk distribution
    risk_result = await db.execute(
        select(Customer.risk_level, func.count(Customer.id)).group_by(Customer.risk_level)
    )
    risk_dist = {r[0]: r[1] for r in risk_result.all()}

    # Reminder stats
    rem_result = await db.execute(
        select(Reminder.status, func.count(Reminder.id)).group_by(Reminder.status)
    )
    reminder_stats = {r[0]: r[1] for r in rem_result.all()}

    # Most overdue invoices
    overdue_result = await db.execute(
        select(Invoice)
        .where(Invoice.status == InvoiceStatus.OVERDUE)
        .order_by(Invoice.days_overdue.desc())
        .limit(5)
    )
    top_overdue = overdue_result.scalars().all()

    return {
        "summary": {
            "total_invoices": total_invoices,
            "total_billed": round(total_billed, 2),
            "total_collected": round(total_collected, 2),
            "total_outstanding": round(total_outstanding, 2),
            "collection_rate": round((total_collected / total_billed * 100) if total_billed else 0, 1),
            "overdue_refreshed_count": updated,
        },
        "by_status": by_status,
        "risk_distribution": {
            "low": risk_dist.get(RiskLevel.LOW, 0),
            "medium": risk_dist.get(RiskLevel.MEDIUM, 0),
            "high": risk_dist.get(RiskLevel.HIGH, 0),
        },
        "reminders": {
            "sent": reminder_stats.get(ReminderStatus.SENT, 0),
            "delivered": reminder_stats.get(ReminderStatus.DELIVERED, 0),
            "failed": reminder_stats.get(ReminderStatus.FAILED, 0),
        },
        "top_overdue": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "amount_due": round(inv.amount - inv.amount_paid, 2),
                "days_overdue": inv.days_overdue,
                "customer_id": inv.customer_id,
            }
            for inv in top_overdue
        ],
    }


@router.get("/overdue-aging")
async def overdue_aging(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where(Invoice.status == InvoiceStatus.OVERDUE)
    )
    invoices = result.scalars().all()

    buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
    for inv in invoices:
        amt = round(inv.amount - inv.amount_paid, 2)
        entry = {"invoice_number": inv.invoice_number, "amount_due": amt, "days_overdue": inv.days_overdue}
        if inv.days_overdue <= 30:
            buckets["0_30"].append(entry)
        elif inv.days_overdue <= 60:
            buckets["31_60"].append(entry)
        elif inv.days_overdue <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["90_plus"].append(entry)

    return {
        bucket: {
            "invoices": items,
            "total": round(sum(i["amount_due"] for i in items), 2),
            "count": len(items),
        }
        for bucket, items in buckets.items()
    }


@router.get("/cash-flow-prediction")
@limiter.limit(AI_RATE_LIMIT)
async def cash_flow_prediction(request: Request, db: AsyncSession = Depends(get_db)):
    """AI prediction of collections over next 30/60/90 days based on risk profiles."""
    result = await db.execute(
        select(Invoice)
        .where(Invoice.status.in_([InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.ESCALATED]))
        .options(selectinload(Invoice.customer))
    )
    invoices = result.scalars().all()

    invoices_data = [
        {
            "invoice_number": inv.invoice_number,
            "amount_due": round(inv.amount - inv.amount_paid, 2),
            "days_overdue": inv.days_overdue,
            "risk_level": inv.customer.risk_level if inv.customer else "medium",
        }
        for inv in invoices
    ]

    prediction = await ai_service.predict_cash_flow(invoices_data)
    return prediction


@router.get("/weekly-report")
@limiter.limit(AI_RATE_LIMIT)
async def weekly_report(
    request: Request,
    period: str = Query("weekly", pattern="^(weekly|monthly|quarterly|yearly)$"),
    db: AsyncSession = Depends(get_db),
):
    """AI-generated weekly revenue recovery intelligence report."""
    inv_result = await db.execute(
        select(Invoice.status, func.count(Invoice.id), func.sum(Invoice.amount), func.sum(Invoice.amount_paid))
        .group_by(Invoice.status)
    )
    invoice_rows = inv_result.all()

    total_collected = sum((r[3] or 0) for r in invoice_rows)
    total_billed = sum((r[2] or 0) for r in invoice_rows)
    overdue_count = sum(r[1] for r in invoice_rows if r[0] == InvoiceStatus.OVERDUE)
    escalated_count = sum(r[1] for r in invoice_rows if r[0] == InvoiceStatus.ESCALATED)

    risk_result = await db.execute(
        select(Customer.risk_level, func.count(Customer.id)).group_by(Customer.risk_level)
    )
    risk_dist = {r[0]: r[1] for r in risk_result.all()}

    rem_result = await db.execute(
        select(func.count(Reminder.id)).where(
            Reminder.status.in_([ReminderStatus.SENT, ReminderStatus.DELIVERED])
        )
    )
    reminders_sent = rem_result.scalar_one_or_none() or 0

    customer_count_result = await db.execute(select(func.count(Customer.id)))
    total_clients = customer_count_result.scalar_one_or_none() or 0

    stats = {
        "period": str(date.today()),
        "period_type": period,
        "total_outstanding": round(total_billed - total_collected, 2),
        "total_collected": round(total_collected, 2),
        "collection_rate": round((total_collected / total_billed * 100) if total_billed else 0, 1),
        "overdue_count": overdue_count,
        "escalated_count": escalated_count,
        "high_risk_count": risk_dist.get(RiskLevel.HIGH, 0),
        "reminders_sent": reminders_sent,
        "total_clients": total_clients,
    }

    report_text = await ai_service.generate_weekly_report(stats, period=period)
    return {"report": report_text, "stats": stats, "generated_at": str(date.today()), "period": period}
