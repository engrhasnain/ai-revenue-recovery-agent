import { Injectable, Logger } from "@nestjs/common";
import { Reminder } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReminderChannel, ReminderStatus } from "../common/enums";

/**
 * Full port of backend-fastapi-archive/src/app/services/notification_service.py.
 *
 * SIMULATED ONLY, intentionally — these functions only log and return
 * success today, exactly like the Python version. Do NOT wire up real
 * SMTP/Twilio here; that's a deliberate constraint of this deployment, not
 * a shortcut.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    this.logger.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    this.logger.log(`[EMAIL] Body: ${body.slice(0, 100)}...`);
    return true;
  }

  async sendWhatsapp(to: string, message: string): Promise<boolean> {
    this.logger.log(`[WHATSAPP] To: ${to} | Message: ${message.slice(0, 100)}...`);
    return true;
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    this.logger.log(`[SMS] To: ${to} | Message: ${message.slice(0, 100)}...`);
    return true;
  }

  async dispatchReminder(params: {
    reminder: Reminder;
    customerEmail: string;
    customerPhone: string | null;
    customerWhatsapp: string | null;
  }): Promise<boolean> {
    const { reminder, customerEmail, customerPhone, customerWhatsapp } = params;
    let success = false;

    try {
      if (reminder.channel === ReminderChannel.EMAIL) {
        success = await this.sendEmail(customerEmail, reminder.subject || "Payment Reminder", reminder.message);
      } else if (reminder.channel === ReminderChannel.WHATSAPP) {
        const target = customerWhatsapp || customerPhone;
        if (target) success = await this.sendWhatsapp(target, reminder.message);
      } else if (reminder.channel === ReminderChannel.SMS) {
        if (customerPhone) success = await this.sendSms(customerPhone, reminder.message);
      }

      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: success ? ReminderStatus.SENT : ReminderStatus.FAILED, sent_at: new Date() },
      });
    } catch (err) {
      this.logger.error(`Failed to dispatch reminder ${reminder.id}: ${err}`);
      await this.prisma.reminder.update({ where: { id: reminder.id }, data: { status: ReminderStatus.FAILED } });
    }

    return success;
  }
}
