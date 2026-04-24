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
  everyNDays?: number | null;
  lastPaidDate?: string | null;
};

export function PayrollScheduleFields({
  initialValues,
  compact = false
}: {
  initialValues?: PayrollScheduleValues;
  compact?: boolean;
}) {
  const [payrollFrequency, setPayrollFrequency] = useState<PayrollFrequency>(
    initialValues?.payrollFrequency ?? PayrollFrequency.WEEKLY
  );

  useEffect(() => {
    setPayrollFrequency(initialValues?.payrollFrequency ?? PayrollFrequency.WEEKLY);
  }, [
    initialValues?.monthlyPayDay,
    initialValues?.payrollFrequency,
    initialValues?.everyNDays,
    initialValues?.twiceMonthlyDayOne,
    initialValues?.twiceMonthlyDayTwo,
    initialValues?.weeklyPayDay
  ]);

  return (
    <div className="md:col-span-2">
      <div className={`rounded-[22px] border border-[rgba(226,219,211,0.84)] bg-[rgba(250,247,242,0.8)] ${compact ? "p-3" : "p-3.5"}`}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Payroll Schedule</div>
        <p className="mt-0.5 text-sm text-[#7a7168]">Each employee can follow their own sahod cycle.</p>

        <div className={`mt-3 grid gap-3 ${compact ? "xl:grid-cols-3" : "md:grid-cols-2"}`}>
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
              <option value={PayrollFrequency.EVERY_N_DAYS}>Every N days</option>
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

          {payrollFrequency === PayrollFrequency.EVERY_N_DAYS ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Repeat every</label>
                <input
                  name="everyNDays"
                  type="number"
                  min="2"
                  max="365"
                  defaultValue={initialValues?.everyNDays ?? 7}
                  required
                />
                <p className="mt-1 text-xs text-[#7a7168]">Set the number of days in this employee's sahod cycle.</p>
              </div>
              <div className={compact ? "xl:col-span-1" : ""}>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last paid date</label>
                <input
                  name="lastPaidDate"
                  type="date"
                  defaultValue={initialValues?.lastPaidDate ?? ""}
                />
                <p className="mt-1 text-xs text-[#7a7168]">Optional but recommended so the next payout auto-adjusts correctly. If blank, start date is used.</p>
              </div>
            </>
          ) : null}
        </div>

        <div className={`mt-2.5 rounded-2xl bg-white/80 text-xs text-[#7a7168] ${compact ? "px-3 py-2 leading-5" : "px-3 py-2"}`}>
          {payrollFrequency === PayrollFrequency.DAILY
            ? "This employee can be included in payroll every day."
            : payrollFrequency === PayrollFrequency.WEEKLY
              ? "Payroll will be generated when the selected weekly pay day is chosen."
              : payrollFrequency === PayrollFrequency.MONTHLY
                ? "Payroll will be generated on the chosen recurring day of the month."
                : payrollFrequency === PayrollFrequency.EVERY_N_DAYS
                  ? "Payroll will be generated every N days using the last paid date first, then the start date as fallback."
                  : "Payroll will be generated on two recurring days each month."}
        </div>
      </div>
    </div>
  );
}
