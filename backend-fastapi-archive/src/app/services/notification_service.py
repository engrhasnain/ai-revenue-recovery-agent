import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.reminder import Reminder, ReminderStatus

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send email — swap with real SMTP in production."""
    logger.info(f"[EMAIL] To: {to} | Subject: {subject}")
    logger.info(f"[EMAIL] Body: {body[:100]}...")
    return True


async def send_whatsapp(to: str, message: str) -> bool:
    """Send WhatsApp message — swap with Twilio in production."""
    logger.info(f"[WHATSAPP] To: {to} | Message: {message[:100]}...")
    return True


async def send_sms(to: str, message: str) -> bool:
    """Send SMS — swap with Twilio in production."""
    logger.info(f"[SMS] To: {to} | Message: {message[:100]}...")
    return True


async def dispatch_reminder(
    reminder: Reminder,
    customer_email: str,
    customer_phone: str | None,
    customer_whatsapp: str | None,
    db: AsyncSession,
) -> bool:
    from app.models.reminder import ReminderChannel

    success = False

    try:
        if reminder.channel == ReminderChannel.EMAIL:
            success = await send_email(
                to=customer_email,
                subject=reminder.subject or "Payment Reminder",
                body=reminder.message,
            )
        elif reminder.channel == ReminderChannel.WHATSAPP:
            target = customer_whatsapp or customer_phone
            if target:
                success = await send_whatsapp(to=target, message=reminder.message)
        elif reminder.channel == ReminderChannel.SMS:
            if customer_phone:
                success = await send_sms(to=customer_phone, message=reminder.message)

        reminder.status = ReminderStatus.SENT if success else ReminderStatus.FAILED
        reminder.sent_at = datetime.utcnow()
        await db.flush()

    except Exception as e:
        logger.error(f"Failed to dispatch reminder {reminder.id}: {e}")
        reminder.status = ReminderStatus.FAILED
        await db.flush()

    return success
