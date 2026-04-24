-- Allow advances to be collected partially across multiple payroll runs.
ALTER TABLE "Advance"
ADD COLUMN "deductionPerPayroll" DECIMAL(10,2);
