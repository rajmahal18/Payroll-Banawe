import { PayrollFrequency } from "@prisma/client";
import {
  BUSINESS_TIME_ZONE,
  addBusinessDays,
  differenceInBusinessDays,
  formatDate,
  isSameBusinessDate,
  parseDateInputValue,
  startOfDayLocal,
  toDateInputValue
} from "@/lib/utils";

const shortDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "short",
  day: "numeric"
});

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

function getDateParts(date: Date) {
  const [year, month, day] = toDateInputValue(date).split("-").map(Number);
  return { year, month, day };
}

function createDateFromParts(year: number, month: number, day: number) {
  return parseDateInputValue(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function normalizeMonth(year: number, month: number) {
  let normalizedYear = year;
  let normalizedMonth = month;

  while (normalizedMonth < 1) {
    normalizedMonth += 12;
    normalizedYear -= 1;
  }

  while (normalizedMonth > 12) {
    normalizedMonth -= 12;
    normalizedYear += 1;
  }

  return { year: normalizedYear, month: normalizedMonth };
}

function clampDay(day: number, referenceDate: Date) {
  const { year, month } = getDateParts(referenceDate);
  return Math.min(day, getDaysInMonth(year, month));
}

function safeDateInMonth(referenceDate: Date, day: number) {
  const { year, month } = getDateParts(referenceDate);
  return createDateFromParts(year, month, Math.min(day, getDaysInMonth(year, month)));
}

function startOfMonthBusiness(date: Date) {
  const { year, month } = getDateParts(date);
  return createDateFromParts(year, month, 1);
}

function shiftMonthStart(date: Date, offset: number) {
  const { year, month } = getDateParts(date);
  const normalized = normalizeMonth(year, month + offset);
  return createDateFromParts(normalized.year, normalized.month, 1);
}

function getEveryNDaysAnchor(schedule: PayrollScheduleLike, fallbackDate: Date) {
  return startOfDayLocal(schedule.lastPaidDate ?? schedule.startDate ?? fallbackDate);
}

function formatShortDate(date: Date) {
  return shortDateFormatter.format(date);
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
      return parseDateInputValue(toDateInputValue(date));
    case PayrollFrequency.WEEKLY: {
      const targetDay = schedule.weeklyPayDay ?? 5;
      let cursor = parseDateInputValue(toDateInputValue(date));
      while (cursor.getUTCDay() !== targetDay) {
        cursor = addBusinessDays(cursor, 1);
      }
      return cursor;
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = schedule.monthlyPayDay ?? 15;
      const currentMonthPayDate = safeDateInMonth(date, targetDay);
      return toDateInputValue(date) <= toDateInputValue(currentMonthPayDate)
        ? currentMonthPayDate
        : safeDateInMonth(shiftMonthStart(date, 1), targetDay);
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const firstDate = safeDateInMonth(date, first);
      const secondDate = safeDateInMonth(date, second);
      if (toDateInputValue(date) <= toDateInputValue(firstDate)) return firstDate;
      if (toDateInputValue(date) <= toDateInputValue(secondDate)) return secondDate;
      return safeDateInMonth(shiftMonthStart(date, 1), first);
    }
    case PayrollFrequency.EVERY_N_DAYS: {
      const interval = Math.max(schedule.everyNDays ?? 7, 2);
      const anchor = getEveryNDaysAnchor(schedule, date);
      const hasPreviousPayout = Boolean(schedule.lastPaidDate);
      const firstPayDate = hasPreviousPayout ? addBusinessDays(anchor, interval) : addBusinessDays(anchor, interval - 1);
      if (toDateInputValue(date) <= toDateInputValue(firstPayDate)) {
        return firstPayDate;
      }

      const daysSinceFirstPayDate = differenceInBusinessDays(date, firstPayDate);
      const cyclesToAdvance = Math.ceil(daysSinceFirstPayDate / interval);
      return addBusinessDays(firstPayDate, cyclesToAdvance * interval);
    }
    default:
      return parseDateInputValue(toDateInputValue(date));
  }
}

export function getPeriodForPayDate(payDate: Date, schedule: PayrollScheduleLike): GeneratedPeriod {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return {
        periodStart: payDate,
        periodEnd: payDate,
        payDate,
        label: formatDate(payDate)
      };
    case PayrollFrequency.WEEKLY: {
      const start = addBusinessDays(payDate, -6);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${formatShortDate(start)} - ${formatDate(payDate)}`
      };
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = schedule.monthlyPayDay ?? 15;
      const previousMonth = shiftMonthStart(payDate, -1);
      const previousPayDate = safeDateInMonth(previousMonth, targetDay);
      const start = addBusinessDays(previousPayDate, 1);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${formatShortDate(start)} - ${formatDate(payDate)}`
      };
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const firstDate = safeDateInMonth(payDate, first);
      const secondDate = safeDateInMonth(payDate, second);

      if (isSameBusinessDate(payDate, firstDate)) {
        const start = startOfMonthBusiness(payDate);
        return {
          periodStart: start,
          periodEnd: firstDate,
          payDate,
          label: `${formatShortDate(start)} - ${formatDate(firstDate)}`
        };
      }

      if (isSameBusinessDate(payDate, secondDate)) {
        const start = addBusinessDays(firstDate, 1);
        return {
          periodStart: start,
          periodEnd: secondDate,
          payDate,
          label: `${formatShortDate(start)} - ${formatDate(secondDate)}`
        };
      }

      const prevMonth = shiftMonthStart(payDate, -1);
      const prevSecond = safeDateInMonth(prevMonth, second);
      const start = addBusinessDays(prevSecond, 1);
      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${formatShortDate(start)} - ${formatDate(payDate)}`
      };
    }
    case PayrollFrequency.EVERY_N_DAYS: {
      const interval = Math.max(schedule.everyNDays ?? 7, 2);
      const anchor = getEveryNDaysAnchor(schedule, payDate);
      const startCandidate = schedule.lastPaidDate ? addBusinessDays(anchor, 1) : addBusinessDays(payDate, -(interval - 1));
      const start = toDateInputValue(startCandidate) < toDateInputValue(anchor) ? anchor : startCandidate;

      return {
        periodStart: start,
        periodEnd: payDate,
        payDate,
        label: `${formatShortDate(start)} - ${formatDate(payDate)}`
      };
    }
    default:
      return {
        periodStart: payDate,
        periodEnd: payDate,
        payDate,
        label: formatDate(payDate)
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
      return Math.max(differenceInBusinessDays(period.periodEnd, period.periodStart) + 1, 1);
    }
    default:
      return 1;
  }
}

export function getTimelineRetentionDays(schedule: PayrollScheduleLike, payDate?: Date) {
  return Math.ceil(getPayrollCycleDays(schedule, payDate) / 2);
}
