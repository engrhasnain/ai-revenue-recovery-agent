"""Demo dataset + seeding/reset logic — shared by the standalone `seed.py` CLI
script and the periodic public-demo reset job started from `main.py`.

This is the single source of truth for the demo dataset so both call sites
reuse the exact same logic instead of duplicating it.
"""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import delete

from app.database import AsyncSessionLocal, init_db
from app.models.customer import Customer, RiskLevel
from app.models.invoice import Invoice, InvoiceStatus
from app.models.reminder import Reminder, ReminderChannel, ReminderStatus, ReminderType

logger = logging.getLogger(__name__)


def _build_dataset() -> tuple[list[dict], list[dict], list[dict]]:
    """Build fresh copies of the demo CUSTOMERS/INVOICES/REMINDERS data.

    Built fresh (not module-level constants) so relative dates (today - N days)
    are always current, and so repeated calls don't mutate shared state — the
    original seed() popped keys out of these dicts as it consumed them.
    """
    today = date.today()

    customers = [
        {
            "name": "James Harrington",
            "email": "j.harrington@nexuslabs.com",
            "phone": "+1-415-555-0181",
            "whatsapp": "+1-415-555-0181",
            "company": "Nexus Labs Inc.",
            "country": "United States",
            "risk_level": RiskLevel.LOW,
            "notes": "Long-term client, usually pays within 5 days of reminder.",
        },
        {
            "name": "Priya Nair",
            "email": "priya.nair@deltaforge.co.uk",
            "phone": "+44-20-7946-0821",
            "whatsapp": "+44-20-7946-0821",
            "company": "Delta Forge Ltd.",
            "country": "United Kingdom",
            "risk_level": RiskLevel.MEDIUM,
            "notes": "Occasional delays of 2–3 weeks. Responds to WhatsApp fastest.",
        },
        {
            "name": "Khalid Al-Rashidi",
            "email": "k.rashidi@pinnaclegroup.ae",
            "phone": "+971-4-555-0342",
            "whatsapp": "+971-4-555-0342",
            "company": "Pinnacle Group FZE",
            "country": "United Arab Emirates",
            "risk_level": RiskLevel.HIGH,
            "notes": "Three escalated invoices in the past year. Requires firm notices.",
        },
        {
            "name": "Sophie Laurent",
            "email": "sophie@luminartech.fr",
            "phone": "+33-1-5555-0193",
            "company": "Luminar Technologies",
            "country": "France",
            "risk_level": RiskLevel.LOW,
            "notes": "Excellent payment history. Prefers email communication.",
        },
        {
            "name": "Marcus Böhm",
            "email": "m.boehm@steelhausgmbh.de",
            "phone": "+49-30-5555-0214",
            "whatsapp": "+49-30-5555-0214",
            "company": "Stahlhaus GmbH",
            "country": "Germany",
            "risk_level": RiskLevel.MEDIUM,
            "notes": "Mid-size manufacturing firm. Pays at end of month cycle.",
        },
        {
            "name": "Yuki Tanaka",
            "email": "y.tanaka@horizoncorp.co.jp",
            "phone": "+81-3-5555-0265",
            "company": "Horizon Corporation",
            "country": "Japan",
            "risk_level": RiskLevel.LOW,
            "notes": "Always pays on time. Monthly recurring client.",
        },
        {
            "name": "Amara Osei",
            "email": "amara.osei@tekafricagroup.com",
            "phone": "+233-30-555-0376",
            "whatsapp": "+233-30-555-0376",
            "company": "TekAfrica Group",
            "country": "Ghana",
            "risk_level": RiskLevel.HIGH,
            "notes": "New client. Two invoices unpaid beyond 60 days.",
        },
        {
            "name": "Carlos Mendoza",
            "email": "c.mendoza@proyectosg.mx",
            "phone": "+52-55-5555-0487",
            "whatsapp": "+52-55-5555-0487",
            "company": "Proyectos G S.A.",
            "country": "Mexico",
            "risk_level": RiskLevel.MEDIUM,
            "notes": "Responds well to payment plan offers.",
        },
    ]

    invoices = [
        # Nexus Labs — 1 overdue, 1 pending
        {"invoice_number": "INV-2025-001", "customer_idx": 0, "amount": 14500.00, "currency": "USD", "issue_date": today - timedelta(days=45), "due_date": today - timedelta(days=15), "status": InvoiceStatus.OVERDUE, "days_overdue": 15, "reminder_count": 2, "description": "Q4 Software Integration Services"},
        {"invoice_number": "INV-2025-002", "customer_idx": 0, "amount": 8200.00, "currency": "USD", "issue_date": today - timedelta(days=10), "due_date": today + timedelta(days=20), "status": InvoiceStatus.PENDING, "days_overdue": 0, "description": "January Retainer Fee"},

        # Delta Forge — 1 overdue (partial), 1 paid
        {"invoice_number": "INV-2025-003", "customer_idx": 1, "amount": 22750.00, "currency": "GBP", "issue_date": today - timedelta(days=65), "due_date": today - timedelta(days=35), "status": InvoiceStatus.PARTIALLY_PAID, "days_overdue": 35, "amount_paid": 10000.00, "reminder_count": 3, "description": "Custom ERP Module Development"},
        {"invoice_number": "INV-2025-004", "customer_idx": 1, "amount": 5400.00, "currency": "GBP", "issue_date": today - timedelta(days=90), "due_date": today - timedelta(days=60), "status": InvoiceStatus.PAID, "days_overdue": 0, "amount_paid": 5400.00, "description": "Support & Maintenance — Nov"},

        # Pinnacle Group — 2 escalated, 1 overdue
        {"invoice_number": "INV-2025-005", "customer_idx": 2, "amount": 48000.00, "currency": "AED", "issue_date": today - timedelta(days=120), "due_date": today - timedelta(days=90), "status": InvoiceStatus.ESCALATED, "days_overdue": 90, "reminder_count": 5, "description": "Annual Platform License", "escalated_at": datetime.utcnow() - timedelta(days=10)},
        {"invoice_number": "INV-2025-006", "customer_idx": 2, "amount": 31500.00, "currency": "AED", "issue_date": today - timedelta(days=85), "due_date": today - timedelta(days=55), "status": InvoiceStatus.OVERDUE, "days_overdue": 55, "reminder_count": 4, "description": "Infrastructure Setup — Phase 2"},

        # Luminar Tech — 1 paid, 1 pending
        {"invoice_number": "INV-2025-007", "customer_idx": 3, "amount": 9800.00, "currency": "EUR", "issue_date": today - timedelta(days=30), "due_date": today + timedelta(days=0), "status": InvoiceStatus.PENDING, "days_overdue": 0, "description": "UX Audit & Redesign"},
        {"invoice_number": "INV-2025-008", "customer_idx": 3, "amount": 7200.00, "currency": "EUR", "issue_date": today - timedelta(days=75), "due_date": today - timedelta(days=45), "status": InvoiceStatus.PAID, "days_overdue": 0, "amount_paid": 7200.00, "description": "Brand Identity Package"},

        # Stahlhaus — 1 overdue
        {"invoice_number": "INV-2025-009", "customer_idx": 4, "amount": 17300.00, "currency": "EUR", "issue_date": today - timedelta(days=55), "due_date": today - timedelta(days=25), "status": InvoiceStatus.OVERDUE, "days_overdue": 25, "reminder_count": 2, "description": "Industrial IoT Sensors — Batch 3"},

        # Horizon Corp — 2 paid (good client)
        {"invoice_number": "INV-2025-010", "customer_idx": 5, "amount": 12600.00, "currency": "USD", "issue_date": today - timedelta(days=40), "due_date": today - timedelta(days=10), "status": InvoiceStatus.PAID, "days_overdue": 0, "amount_paid": 12600.00, "description": "Data Analytics Dashboard — Dec"},
        {"invoice_number": "INV-2025-011", "customer_idx": 5, "amount": 13100.00, "currency": "USD", "issue_date": today - timedelta(days=10), "due_date": today + timedelta(days=20), "status": InvoiceStatus.PENDING, "days_overdue": 0, "description": "Data Analytics Dashboard — Jan"},

        # TekAfrica — 2 overdue (high risk)
        {"invoice_number": "INV-2025-012", "customer_idx": 6, "amount": 9500.00, "currency": "USD", "issue_date": today - timedelta(days=100), "due_date": today - timedelta(days=70), "status": InvoiceStatus.OVERDUE, "days_overdue": 70, "reminder_count": 4, "description": "Cloud Migration — Phase 1"},
        {"invoice_number": "INV-2025-013", "customer_idx": 6, "amount": 7800.00, "currency": "USD", "issue_date": today - timedelta(days=75), "due_date": today - timedelta(days=45), "status": InvoiceStatus.OVERDUE, "days_overdue": 45, "reminder_count": 3, "description": "Cloud Migration — Phase 2"},

        # Proyectos G — 1 overdue
        {"invoice_number": "INV-2025-014", "customer_idx": 7, "amount": 6400.00, "currency": "USD", "issue_date": today - timedelta(days=50), "due_date": today - timedelta(days=20), "status": InvoiceStatus.OVERDUE, "days_overdue": 20, "reminder_count": 1, "description": "Website Development — Milestone 2"},
    ]

    reminders = [
        # INV-2025-001 — Nexus Labs
        {"customer_idx": 0, "invoice_idx": 0, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.FIRST_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Friendly Reminder: Invoice INV-2025-001 Payment Due", "message": "Dear James,\n\nThis is a friendly reminder that Invoice INV-2025-001 for USD 14,500.00 was due on the 25th. Please arrange payment at your earliest convenience.\n\nBest regards,\nAccounts Receivable Team", "sent_at": datetime.utcnow() - timedelta(days=10)},
        {"customer_idx": 0, "invoice_idx": 0, "channel": ReminderChannel.WHATSAPP, "reminder_type": ReminderType.SECOND_NOTICE, "status": ReminderStatus.SENT, "subject": None, "message": "Hi James, following up on Invoice INV-2025-001 (USD 14,500.00) — now 15 days overdue. Please settle at your earliest. Reply here if you have any queries.", "sent_at": datetime.utcnow() - timedelta(days=3)},

        # INV-2025-003 — Delta Forge
        {"customer_idx": 1, "invoice_idx": 2, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.FIRST_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Invoice INV-2025-003 — Payment Due", "message": "Dear Priya,\n\nInvoice INV-2025-003 for GBP 22,750.00 is now 7 days past due. Please arrange payment.\n\nKind regards,\nAccounts Receivable", "sent_at": datetime.utcnow() - timedelta(days=28)},
        {"customer_idx": 1, "invoice_idx": 2, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.SECOND_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Second Notice: Invoice INV-2025-003 — 21 Days Overdue", "message": "Dear Priya,\n\nThis is a follow-up regarding Invoice INV-2025-003 for GBP 22,750.00 (GBP 10,000 paid, GBP 12,750 outstanding), now 21 days past due.\n\nPlease arrange the remaining payment within 5 business days.", "sent_at": datetime.utcnow() - timedelta(days=14), "response_received": True, "response_text": "Hi, we've sent a partial payment of £10,000. Working on the remainder next week."},
        {"customer_idx": 1, "invoice_idx": 2, "channel": ReminderChannel.WHATSAPP, "reminder_type": ReminderType.PAYMENT_PLAN_OFFER, "status": ReminderStatus.SENT, "subject": None, "message": "Hi Priya, we'd like to help you clear the remaining GBP 12,750 on Invoice INV-2025-003 through a flexible payment plan. Reply to discuss options. 📋", "sent_at": datetime.utcnow() - timedelta(days=5)},

        # INV-2025-005 — Pinnacle Group (escalated)
        {"customer_idx": 2, "invoice_idx": 4, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.FIRST_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Reminder: Invoice INV-2025-005", "message": "Dear Khalid,\n\nInvoice INV-2025-005 for AED 48,000.00 is now due. Please arrange payment.", "sent_at": datetime.utcnow() - timedelta(days=85)},
        {"customer_idx": 2, "invoice_idx": 4, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.SECOND_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Second Notice: Invoice INV-2025-005 — 30 Days Overdue", "message": "Dear Khalid,\n\nThis is our second reminder for Invoice INV-2025-005 (AED 48,000). Please settle within 5 days.", "sent_at": datetime.utcnow() - timedelta(days=60)},
        {"customer_idx": 2, "invoice_idx": 4, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.FINAL_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "FINAL NOTICE: Invoice INV-2025-005 — Immediate Action Required", "message": "Dear Khalid,\n\nThis is our final notice. Invoice INV-2025-005 (AED 48,000) is 60 days overdue. Pay within 48 hours or this will be escalated to collections.", "sent_at": datetime.utcnow() - timedelta(days=30)},
        {"customer_idx": 2, "invoice_idx": 4, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.ESCALATION, "status": ReminderStatus.SENT, "subject": "ESCALATED: Invoice INV-2025-005 Referred to Collections", "message": "Dear Khalid,\n\nInvoice INV-2025-005 has been formally escalated to our collections department. Contact us within 24 hours to avoid further action.", "sent_at": datetime.utcnow() - timedelta(days=10)},

        # INV-2025-012 — TekAfrica
        {"customer_idx": 6, "invoice_idx": 11, "channel": ReminderChannel.EMAIL, "reminder_type": ReminderType.FIRST_NOTICE, "status": ReminderStatus.DELIVERED, "subject": "Payment Reminder: Invoice INV-2025-012", "message": "Dear Amara,\n\nInvoice INV-2025-012 for USD 9,500 is now overdue. Please arrange payment.", "sent_at": datetime.utcnow() - timedelta(days=65)},
        {"customer_idx": 6, "invoice_idx": 11, "channel": ReminderChannel.WHATSAPP, "reminder_type": ReminderType.SECOND_NOTICE, "status": ReminderStatus.SENT, "subject": None, "message": "Hi Amara, following up on Invoice INV-2025-012 (USD 9,500) — 45 days overdue. Please settle ASAP to avoid escalation.", "sent_at": datetime.utcnow() - timedelta(days=25)},
    ]

    return customers, invoices, reminders


async def seed_database() -> None:
    """Populate the database with the realistic global demo dataset.

    Assumes the target tables are already empty (fresh DB, or just cleared by
    reset_database()). Safe to call directly for first-time setup via the
    `seed.py` CLI script.
    """
    await init_db()

    customers_data, invoices_data, reminders_data = _build_dataset()

    async with AsyncSessionLocal() as db:
        logger.info("Seeding customers...")
        customers = []
        for c_data in customers_data:
            customer = Customer(**c_data)
            db.add(customer)
            customers.append(customer)
        await db.flush()

        logger.info("Seeding invoices...")
        invoices = []
        for inv_data in invoices_data:
            data = dict(inv_data)
            idx = data.pop("customer_idx")
            escalated_at = data.pop("escalated_at", None)
            invoice = Invoice(**data, customer_id=customers[idx].id)
            if escalated_at:
                invoice.escalated_at = escalated_at
            db.add(invoice)
            invoices.append(invoice)
        await db.flush()

        logger.info("Seeding reminders...")
        for r_data in reminders_data:
            data = dict(r_data)
            c_idx = data.pop("customer_idx")
            i_idx = data.pop("invoice_idx")
            reminder = Reminder(
                **data,
                customer_id=customers[c_idx].id,
                invoice_id=invoices[i_idx].id,
                ai_generated=True,
            )
            db.add(reminder)
        await db.flush()

        # Update outstanding totals
        for customer in customers:
            customer_invoices = [inv for inv in invoices if inv.customer_id == customer.id]
            customer.total_outstanding = sum(
                inv.amount - inv.amount_paid
                for inv in customer_invoices
                if inv.status in (InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.ESCALATED)
            )

        await db.commit()

        logger.info(
            "Seeded %d customers, %d invoices, %d reminders",
            len(customers_data), len(invoices_data), len(reminders_data),
        )


async def reset_database() -> None:
    """Wipe all customer/invoice/reminder data and reseed from scratch.

    Used by the public-demo periodic reset job (main.py) to restore the
    database to its originally-seeded state on a fixed interval.
    """
    await init_db()

    async with AsyncSessionLocal() as db:
        # Children first — reminders reference both invoices and customers.
        await db.execute(delete(Reminder))
        await db.execute(delete(Invoice))
        await db.execute(delete(Customer))
        await db.commit()

    await seed_database()
    logger.info("Public demo database reset to its originally-seeded state.")
