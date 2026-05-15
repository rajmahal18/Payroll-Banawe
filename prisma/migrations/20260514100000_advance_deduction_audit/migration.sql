-- Keep a per-payroll audit trail for every advance balance deduction.
CREATE TABLE "AdvanceDeduction" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT,
    "payrollEntryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceBefore" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "advanceDate" TIMESTAMP(3) NOT NULL,
    "advanceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvanceDeduction_advanceId_idx" ON "AdvanceDeduction"("advanceId");
CREATE INDEX "AdvanceDeduction_employeeId_payDate_idx" ON "AdvanceDeduction"("employeeId", "payDate");
CREATE INDEX "AdvanceDeduction_payrollEntryId_idx" ON "AdvanceDeduction"("payrollEntryId");

ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
