-- DropIndex
DROP INDEX "PayrollPeriod_payDate_idx";

-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "updatedAt" DROP DEFAULT;
