-- Track payroll operational events for reconciliation and correction history.
CREATE TABLE "PayrollAuditEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "payrollPeriodId" TEXT,
    "employeeId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollAuditEvent_shopId_createdAt_idx" ON "PayrollAuditEvent"("shopId", "createdAt");
CREATE INDEX "PayrollAuditEvent_payrollPeriodId_createdAt_idx" ON "PayrollAuditEvent"("payrollPeriodId", "createdAt");
CREATE INDEX "PayrollAuditEvent_employeeId_createdAt_idx" ON "PayrollAuditEvent"("employeeId", "createdAt");

ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
