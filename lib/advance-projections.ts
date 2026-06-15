import type { Advance, Employee } from "@prisma/client";
import { getPayDateForDate, type PayrollScheduleLike } from "@/lib/payroll";
import { parseDateInputValue, startOfDayLocal, toDateInputValue } from "@/lib/utils";
import { nextWorkDate, type WorkCalendar } from "@/lib/work-schedule";

type ProjectableAdvance = Pick<Advance, "id" | "date" | "deductionPerPayroll" | "remainingBalance" | "reason"> & {
  employee: Pick<
    Employee,
    | "id"
    | "fullName"
    | "payrollFrequency"
    | "weeklyPayDay"
    | "monthlyPayDay"
    | "twiceMonthlyDayOne"
    | "twiceMonthlyDayTwo"
    | "everyNDays"
    | "startDate"
    | "lastPaidDate"
  >;
};

export type ProjectedAdvanceDeduction = {
  id: string;
  advanceId: string;
  date: Date;
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
};

const MAX_PROJECTED_DEDUCTIONS_PER_ADVANCE = 120;
const MAX_PAY_DATE_SEARCH_STEPS = 3700;

function getSuggestedPayDate(
  minimumDate: Date,
  schedule: PayrollScheduleLike,
  calendar: WorkCalendar
) {
  let payDate = getPayDateForDate(minimumDate, schedule, calendar);

  for (let step = 0; toDateInputValue(payDate) < toDateInputValue(minimumDate) && step < MAX_PAY_DATE_SEARCH_STEPS; step += 1) {
    schedule.lastPaidDate = payDate;
    payDate = getPayDateForDate(minimumDate, schedule, calendar);
  }

  // Preserve the hard invariant even if a malformed or unusually distant schedule exhausts the search guard.
  return toDateInputValue(payDate) < toDateInputValue(minimumDate) ? nextWorkDate(minimumDate, calendar) : payDate;
}

export function projectAdvanceDeductions(
  advances: ProjectableAdvance[],
  calendar: WorkCalendar,
  today = startOfDayLocal(new Date())
) {
  return advances.flatMap((advance) => {
    let remainingBalance = Number(advance.remainingBalance);
    const deductionPerPayroll = advance.deductionPerPayroll == null
      ? remainingBalance
      : Math.max(Number(advance.deductionPerPayroll), 0);
    if (remainingBalance <= 0 || deductionPerPayroll <= 0) return [];

    const schedule: PayrollScheduleLike = {
      payrollFrequency: advance.employee.payrollFrequency,
      weeklyPayDay: advance.employee.weeklyPayDay,
      monthlyPayDay: advance.employee.monthlyPayDay,
      twiceMonthlyDayOne: advance.employee.twiceMonthlyDayOne,
      twiceMonthlyDayTwo: advance.employee.twiceMonthlyDayTwo,
      everyNDays: advance.employee.everyNDays,
      startDate: advance.employee.startDate,
      lastPaidDate: advance.employee.lastPaidDate
    };
    const projections: ProjectedAdvanceDeduction[] = [];
    let referenceDate = parseDateInputValue(
      toDateInputValue(advance.date) > toDateInputValue(today) ? toDateInputValue(advance.date) : toDateInputValue(today)
    );

    for (let sequence = 1; remainingBalance > 0 && sequence <= MAX_PROJECTED_DEDUCTIONS_PER_ADVANCE; sequence += 1) {
      const payDate = getSuggestedPayDate(referenceDate, schedule, calendar);
      const amount = Math.min(remainingBalance, deductionPerPayroll);
      const balanceAfter = remainingBalance - amount;
      projections.push({
        id: `suggested-${advance.id}-${sequence}`,
        advanceId: advance.id,
        date: payDate,
        employeeId: advance.employee.id,
        employeeName: advance.employee.fullName,
        amount,
        reason: advance.reason ?? "",
        balanceBefore: remainingBalance,
        balanceAfter
      });
      remainingBalance = balanceAfter;
      schedule.lastPaidDate = payDate;
      referenceDate = payDate;
    }

    return projections;
  });
}
