// Seeding/reset logic shared by the standalone `scripts/seed.ts` CLI entry
// point and the periodic public-demo reset job (seed.service.ts) — mirrors
// seed_database()/reset_database() in
// backend-fastapi-archive/src/app/utils/seed_data.py.

import type { PrismaClient } from "@prisma/client";
import { InvoiceStatus } from "../common/enums";
import { buildDataset } from "./seed-data";

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const { customers: customersData, invoices: invoicesData, reminders: remindersData } = buildDataset();

  const customers = [];
  for (const c of customersData) {
    const customer = await prisma.customer.create({ data: { ...c } });
    customers.push(customer);
  }

  const invoices = [];
  for (const inv of invoicesData) {
    const { customer_idx, escalated_at, ...data } = inv;
    const invoice = await prisma.invoice.create({
      data: {
        ...data,
        customer_id: customers[customer_idx].id,
        ...(escalated_at ? { escalated_at } : {}),
      },
    });
    invoices.push(invoice);
  }

  for (const r of remindersData) {
    const { customer_idx, invoice_idx, ...data } = r;
    await prisma.reminder.create({
      data: {
        ...data,
        customer_id: customers[customer_idx].id,
        invoice_id: invoices[invoice_idx].id,
        ai_generated: true,
      },
    });
  }

  // Update outstanding totals — mirrors the Python version's post-seed pass.
  for (const customer of customers) {
    const customerInvoices = invoices.filter((inv) => inv.customer_id === customer.id);
    const total = customerInvoices
      .filter((inv) =>
        [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.ESCALATED].includes(
          inv.status as InvoiceStatus,
        ),
      )
      .reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);
    await prisma.customer.update({ where: { id: customer.id }, data: { total_outstanding: total } });
  }
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // Children first — reminders/payment plans reference both invoices and
  // customers.
  await prisma.reminder.deleteMany({});
  await prisma.paymentPlan.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.customer.deleteMany({});

  await seedDatabase(prisma);
}
