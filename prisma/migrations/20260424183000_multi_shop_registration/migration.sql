-- Introduce shop scoping so each account owns its own branding and employee code space.
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Shop" ("id", "name")
VALUES ('legacy-shop', 'My Shop')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "User" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "shopId" TEXT;
ALTER TABLE "PayrollSettings" ADD COLUMN "shopId" TEXT;
ALTER TABLE "PayrollPeriod" ADD COLUMN "shopId" TEXT;

UPDATE "User" SET "shopId" = 'legacy-shop' WHERE "shopId" IS NULL;
UPDATE "Employee" SET "shopId" = 'legacy-shop' WHERE "shopId" IS NULL;
UPDATE "PayrollSettings" SET "shopId" = 'legacy-shop' WHERE "shopId" IS NULL;
UPDATE "PayrollPeriod" SET "shopId" = 'legacy-shop' WHERE "shopId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "PayrollSettings" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "PayrollPeriod" ALTER COLUMN "shopId" SET NOT NULL;

DROP INDEX "Employee_employeeCode_key";
DROP INDEX "PayrollPeriod_periodStart_periodEnd_key";

CREATE UNIQUE INDEX "Employee_shopId_employeeCode_key" ON "Employee"("shopId", "employeeCode");
CREATE INDEX "Employee_shopId_status_idx" ON "Employee"("shopId", "status");
CREATE UNIQUE INDEX "PayrollSettings_shopId_key" ON "PayrollSettings"("shopId");
CREATE UNIQUE INDEX "PayrollPeriod_shopId_periodStart_periodEnd_key" ON "PayrollPeriod"("shopId", "periodStart", "periodEnd");
CREATE INDEX "PayrollPeriod_shopId_payDate_idx" ON "PayrollPeriod"("shopId", "payDate");

ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollSettings" ADD CONSTRAINT "PayrollSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
