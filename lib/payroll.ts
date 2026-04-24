import { PayrollFrequency } from "@prisma/client";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDate,
  getDay,
  isSameDay,
  lastDayOfMonth,
  setDate,
  startOfDay,
  startOfMonth,
  subDays
} from "date-fns";

export type GeneratedPeriod = {
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  label: string;
};

export type PayrollScheduleLike = {
  payrollFrequency: PayrollFrequency;
  weeklyPayDay: number | null;
  monthlyPayDay: number | null;
  twiceMonthlyDayOne: number | null;
  twiceMonthlyDayTwo: number | null;
  everyNDays?: number | null;
  startDate?: Date | null;
  lastPaidDate?: Date | null;
};

function clampDay(day: number, referenceDate: Date) {
  return Math.min(day, getDate(lastDayOfMonth(referenceDate)));
}

function safeDateInMonth(referenceDate: Date, day: number) {
  return setDate(startOfMonth(referenceDate), clampDay(day, referenceDate));
}

function getEveryNDaysAnchor(schedule: PayrollScheduleLike, fallbackDate: Date) {
  return startOfDay(schedule.lastPaidDate ?? schedule.startDate ?? fallbackDate);
}

export function describePayrollFrequency(schedule: PayrollScheduleLike) {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return "Daily";
    case PayrollFrequency.WEEKLY:
      return "Weekly";
    case PayrollFrequency.TWICE_MONTHLY:
      return "Twice Monthly";
    case PayrollFrequency.MONTHLY:
      return "Monthly";
    case PayrollFrequency.EVERY_N_DAYS:
      return `Every ${schedule.everyNDays ?? 7} Days`;
    default:
      return "Payroll";
  }
}

export function getPayDateForDate(date: Date, schedule: PayrollScheduleLike): Date {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return date;
    case PayrollFrequency.WEEKLY: {
      const targetDay = schedule.weeklyPayDay ?? 5;
      let cursor = new Date(date);
      while (getDay(cursor) !== targetDay) {
        cursor = addDays(cursor, 1);
      }
      return cursor;
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = schedule.monthlyPayDay ?? 15;
      const currentMonthPayDate = safeDateInMonth(date, targetDay);
      return date <= currentMonthPayDate ? currentMonthPayDate : safeDateInMonth(addDays(endOfMonth(date), 1), targetDay);
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const firstDate = safeDateInMonth(date, first);
      const secondDate = safeDateInMonth(date, second);
      if (date <= firstDate) return firstDate;
      if (date <= secondDate) return secondDate;
      return safeDateInMonth(addDays(endOfMonth(date), 1), first);
    }
    case PayrollFrequency.EVERY_N_DAYS: {
      const interval = Math.max(schedule.everyNDays ?? 7, 2);
      const anchor = getEveryNDaysAnchor(schedule, date);
      const hasPreviousPayout = Boolean(schedule.lastPaidDate);
      const firstPayDate = hasPreviousPayout ? addDays(anchor, interval) : addDays(anchor, interval - 1);
      if (date <= firstPayDate) {
        return firstPayDate;
      }

      const daysSinceFirstPayDate = differenceInCalendarDays(startOfDay(date), firstPayDate);
      const cyclesToAdvance = Math.ceil(daysSinceFirstPayDate / interval);
      return addDays(firstPayDate, cyclesToAdvance * interval);
    }
    default:
      return date;
  }
}

export function getPeriodForPayDate(payDate: Date, schedule: PayrollScheduleLike): GeneratedPeriod {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return {
        periodStart: payDate,
        periodEnd: payDate,
        payDate,
        label: format(payDate, "MMM d, yyyy")
      };
    case PayrollFrequency.WEEKLY: {
      const start = subDays(payDate, 6);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${format(start, "MMM d")} - ${format(payDate, "MMM d, yyyy")}`
      };
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = schedule.monthlyPayDay ?? 15;
      const previousMonth = subDays(startOfMonth(payDate), 1);
      const previousPayDate = safeDateInMonth(previousMonth, targetDay);
      const start = addDays(previousPayDate, 1);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${format(start, "MMM d")} - ${format(payDate, "MMM d, yyyy")}`
      };
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const firstDate = safeDateInMonth(payDate, first);
      const secondDate = safeDateInMonth(payDate, second);

      if (isSameDay(payDate, firstDate)) {
        const start = startOfMonth(payDate);
        return {
          periodStart: start,
          periodEnd: firstDate,
          payDate,
          label: `${format(start, "MMM d")} - ${format(firstDate, "MMM d, yyyy")}`
        };
      }

      if (isSameDay(payDate, secondDate)) {
        const start = addDays(firstDate, 1);
        return {
          periodStart: start,
          periodEnd: secondDate,
          payDate,
          label: `${format(start, "MMM d")} - ${format(secondDate, "MMM d, yyyy")}`
        };
      }

      const prevMonth = subDays(startOfMonth(payDate), 1);
      const prevSecond = safeDateInMonth(prevMonth, second);
      const start = addDays(prevSecond, 1);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${format(start, "MMM d")} - ${format(payDate, "MMM d, yyyy")}`
      };
    }
    case PayrollFrequency.EVERY_N_DAYS: {
      const interval = Math.max(schedule.everyNDays ?? 7, 2);
      const anchor = getEveryNDaysAnchor(schedule, payDate);
      const startCandidate = schedule.lastPaidDate ? addDays(anchor, 1) : subDays(payDate, interval - 1);
      const start = startCandidate < anchor ? anchor : startCandidate;

      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${format(start, "MMM d")} - ${format(payDate, "MMM d, yyyy")}`
      };
    }
    default:
      return {
        periodStart: payDate,
        periodEnd: payDate,
        payDate,
        label: format(payDate, "MMM d, yyyy")
      };
  }
}

export function getPayrollCycleDays(schedule: PayrollScheduleLike, payDate?: Date) {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return 1;
    case PayrollFrequency.WEEKLY:
      return 7;
    case PayrollFrequency.EVERY_N_DAYS:
      return Math.max(schedule.everyNDays ?? 7, 2);
    case PayrollFrequency.MONTHLY:
    case PayrollFrequency.TWICE_MONTHLY: {
      const referencePayDate = payDate ?? getPayDateForDate(new Date(), schedule);
      const period = getPeriodForPayDate(referencePayDate, schedule);
      return Math.max(differenceInCalendarDays(period.periodEnd, period.periodStart) + 1, 1);
    }
    default:
      return 1;
  }
}

export function getTimelineRetentionDays(schedule: PayrollScheduleLike, payDate?: Date) {
  return Math.ceil(getPayrollCycleDays(schedule, payDate) / 2);
}
