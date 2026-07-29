import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Customer, Invoice, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";
import { InvoiceStatus } from "../common/enums";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers.query.dto";

function withStats(customer: Customer & { invoices: Invoice[] }) {
  const { invoices, ...rest } = customer;
  return {
    ...rest,
    total_invoices: invoices.length,
    overdue_invoices: invoices.filter((inv) => inv.status === InvoiceStatus.OVERDUE).length,
    total_paid: invoices.reduce((sum, inv) => sum + inv.amount_paid, 0),
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: RecoveryService,
  ) {}

  async list(query: ListCustomersQueryDto) {
    const where: Prisma.CustomerWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
        { company: { contains: query.search } },
      ];
    }
    if (query.risk_level) {
      where.risk_level = query.risk_level;
    }

    const customers = await this.prisma.customer.findMany({
      where,
      include: { invoices: true },
      skip: query.skip,
      take: query.limit,
      orderBy: { created_at: "desc" },
    });

    return customers.map(withStats);
  }

  async create(payload: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new ConflictException("Customer with this email already exists");
    }
    return this.prisma.customer.create({ data: payload });
  }

  async get(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { invoices: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return withStats(customer);
  }

  async update(customerId: number, payload: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return this.prisma.customer.update({ where: { id: customerId }, data: payload });
  }

  async remove(customerId: number): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    await this.prisma.customer.delete({ where: { id: customerId } });
  }

  async refreshRisk(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { invoices: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    await this.recovery.refreshCustomerOutstanding(customerId);
    // Re-fetch so refreshCustomerRisk sees the freshly recalculated
    // total_outstanding (mirrors the Python version mutating the same
    // in-memory ORM object across both calls).
    const refreshed = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { invoices: true },
    });
    await this.recovery.refreshCustomerRisk(refreshed);

    return this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  }
}
