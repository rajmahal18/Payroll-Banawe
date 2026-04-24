"use client";

import { useEffect, useState } from "react";
import { PayrollFrequency } from "@prisma/client";
import { getWeekdayLabel } from "@/lib/utils";

type PayrollScheduleValues = {
  payrollFrequency?: PayrollFrequency;
  weeklyPayDay?: number | null;
  monthlyPayDay?: number | null;
  twiceMonthlyDayOne?: number | null;
  twiceMonthlyDayTwo?: number | null;
};

export function PayrollScheduleFields({ initialValues }: { initialValues?: PayrollScheduleValues }) {
  const [payrollFrequency, setPayrollFrequency] = useState<PayrollFrequency>(
    initialValues?.payrollFrequency ?? PayrollFrequency.WEEKLY
  );

  useEffect(() => {
    setPayrollFrequency(initialValues?.payrollFrequency ?? PayrollFrequency.WEEKLY);
  }, [
    initialValues?.monthlyPayDay,
    initialValues?.payrollFrequency,
    initialValues?.twiceMonthlyDayOne,
    initialValues?.twiceMonthlyDayTwo,
    initialValues?.weeklyPayDay
  ]);

  return (
    <div className="md:col-span-2">
      <div className="rounded-[24px] border border-[rgba(226,219,211,0.84)] bg-[rgba(250,247,242,0.8)] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Payroll Schedule</div>
        <p className="mt-1 text-sm text-[#7a7168]">Each employee can follow their own sahod cycle.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Frequency</label>
            <select
              name="payrollFrequency"
              value={payrollFrequency}
              onChange={(event) => setPayrollFrequency(event.target.value as PayrollFrequency)}
            >
              <option value={PayrollFrequency.DAILY}>Daily</option>
              <option value={PayrollFrequency.WEEKLY}>Weekly</option>
              <option value={PayrollFrequency.TWICE_MONTHLY}>Twice a month</option>
              <option value={PayrollFrequency.MONTHLY}>Monthly</option>
            </select>
          </div>

          {payrollFrequency === PayrollFrequency.WEEKLY ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Weekly pay day</label>
              <select name="weeklyPayDay" defaultValue={String(initialValues?.weeklyPayDay ?? 5)}>
                {Array.from({ length: 7 }).map((_, day) => (
                  <option key={day} value={day}>
                    {getWeekdayLabel(day)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {payrollFrequency === PayrollFrequency.MONTHLY ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Monthly pay day</label>
              <input
                name="monthlyPayDay"
                type="number"
                min="1"
                max="31"
                defaultValue={initialValues?.monthlyPayDay ?? 15}
                required
              />
            </div>
          ) : null}

          {payrollFrequency === PayrollFrequency.TWICE_MONTHLY ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First pay day</label>
                <input
                  name="twiceMonthlyDayOne"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={initialValues?.twiceMonthlyDayOne ?? 15}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Second pay day</label>
                <input
                  name="twiceMonthlyDayTwo"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={initialValues?.twiceMonthlyDayTwo ?? 30}
                  required
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-xs text-[#7a7168]">
          {payrollFrequency === PayrollFrequency.DAILY
            ? "This employee can be included in payroll every day."
            : payrollFrequency === PayrollFrequency.WEEKLY
              ? "Payroll will be generated when the selected weekly pay day is chosen."
              : payrollFrequency === PayrollFrequency.MONTHLY
                ? "Payroll will be generated on the chosen recurring day of the month."
                : "Payroll will be generated on two recurring days each month."}
        </div>
      </div>
    </div>
  );
}
