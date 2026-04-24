-- Add per-employee payroll schedule fields so each worker can follow a different salary cadence.
ALTER TABLE "Employee"
ADD COLUMN "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN "weeklyPayDay" INTEGER,
ADD COLUMN "monthlyPayDay" INTEGER,
ADD COLUMN "twiceMonthlyDayOne" INTEGER,
ADD COLUMN "twiceMonthlyDayTwo" INTEGER;
