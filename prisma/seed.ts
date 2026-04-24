import bcrypt from "bcryptjs";
import { PrismaClient, EmployeeStatus, PayrollFrequency } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeThisPassword123!";
  const shopName = process.env.ADMIN_SHOP_NAME ?? "Demo Shop";
  const passwordHash = await bcrypt.hash(password, 10);

  const shop = await prisma.shop.upsert({
    where: { id: "seed-shop" },
    update: { name: shopName },
    create: {
      id: "seed-shop",
      name: shopName
    }
  });

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, shopId: shop.id },
    create: {
      email,
      name: "Owner",
      passwordHash,
      shopId: shop.id
    }
  });

  const settings = await prisma.payrollSettings.findFirst({ where: { shopId: shop.id } });
  if (!settings) {
    await prisma.payrollSettings.create({
      data: {
        shopId: shop.id,
        frequency: PayrollFrequency.WEEKLY,
        weeklyPayDay: 5,
        autoGenerate: true
      }
    });
  }

  const count = await prisma.employee.count({ where: { shopId: shop.id } });
  if (count === 0) {
    await prisma.employee.createMany({
      data: [
        { shopId: shop.id, employeeCode: "EMP-001", fullName: "Juan Dela Cruz", position: "Delivery Rider", dailyRate: 650, status: EmployeeStatus.ACTIVE },
        { shopId: shop.id, employeeCode: "EMP-002", fullName: "Ali Hassan", position: "Warehouse Staff", dailyRate: 700, status: EmployeeStatus.ACTIVE },
        { shopId: shop.id, employeeCode: "EMP-003", fullName: "Mark Santos", position: "Helper", dailyRate: 550, status: EmployeeStatus.ACTIVE }
      ]
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
