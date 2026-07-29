// Mirrors the string enums in the archived Python models exactly (same
// lowercase values), since they are persisted as plain strings in SQLite and
// serialized as-is in JSON responses.

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum InvoiceStatus {
  PENDING = "pending",
  OVERDUE = "overdue",
  PARTIALLY_PAID = "partially_paid",
  PAID = "paid",
  DISPUTED = "disputed",
  ESCALATED = "escalated",
  WRITTEN_OFF = "written_off",
}

export enum ReminderChannel {
  EMAIL = "email",
  WHATSAPP = "whatsapp",
  SMS = "sms",
}

export enum ReminderStatus {
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  PENDING = "pending",
}

export enum ReminderType {
  FIRST_NOTICE = "first_notice",
  SECOND_NOTICE = "second_notice",
  FINAL_NOTICE = "final_notice",
  PAYMENT_PLAN_OFFER = "payment_plan_offer",
  ESCALATION = "escalation",
  CONFIRMATION = "confirmation",
  CUSTOM = "custom",
}

export enum PlanStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  DEFAULTED = "defaulted",
  CANCELLED = "cancelled",
}
