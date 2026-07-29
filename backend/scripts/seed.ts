// Run: npm run seed — populates the DB with realistic global demo data.
// Mirrors backend-fastapi-archive/seed.py; reuses the same seeding logic as
// the periodic public-demo reset job (src/seed/seed-runner.ts).

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/seed/seed-runner";

async function seed() {
  const prisma = new PrismaClient();
  try {
    await prisma.reminder.deleteMany({});
    await prisma.paymentPlan.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.customer.deleteMany({});
    await seedDatabase(prisma);
    console.log("\n✓ Demo data seeded successfully");
    console.log("\nRun the app and visit http://localhost:3000");
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
