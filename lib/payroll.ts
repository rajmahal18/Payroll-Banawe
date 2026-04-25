import { PayrollFrequency } from "@prisma/client";
import {
  BUSINESS_TIME_ZONE,
  formatDate,
  isSameBusinessDate,
  parseDateInputValue,
  startOfDayLocal,
  toDateInputValue
} from "@/lib/utils";
import { addWorkDays, differenceInWorkDays, nextWorkDate, type WorkCalendar } from "@/lib/work-schedule";

const MAX_SCHEDULE_SCAN_STEPS = 3700;

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

function safeDateInMonth(referenceDate: Date, day: number) {
  const { year, month } = getDateParts(referenceDate);
  return createDateFromParts(year, month, Math.min(day, getDaysInMonth(year, month)));
}

function startOfMonthBusiness(date: Date) {
  const { year, month } = getDateParts(date);
  return createDateFromParts(year, month, 1);
}

function shiftCalendarDays(date: Date, amount: number) {
  return parseDateInputValue(toDateInputValue(new Date(date.getTime() + amount * 24 * 60 * 60 * 1000)));
}

function shiftMonthStart(date: Date, offset: number) {
  const { year, month } = getDateParts(date);
  const normalized = normalizeMonth(year, month + offset);
  return createDateFromParts(normalized.year, normalized.month, 1);
}

function getEveryNDaysAnchor(schedule: PayrollScheduleLike, fallbackDate: Date) {
  return startOfDayLocal(schedule.lastPaidDate ?? schedule.startDate ?? fallbackDate);
}

function compareDateValues(left: Date, right: Date) {
  return toDateInputValue(left).localeCompare(toDateInputValue(right));
}

function isAfterAnchor(candidate: Date, anchor: Date, strict: boolean) {
  const comparison = compareDateValues(candidate, anchor);
  return strict ? comparison > 0 : comparison >= 0;
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

export function getPayDateForDate(date: Date, schedule: PayrollScheduleLike, calendar?: WorkCalendar): Date {
  const anchor = startOfDayLocal(schedule.lastPaidDate ?? schedule.startDate ?? date);
  const hasAnchor = Boolean(schedule.lastPaidDate || schedule.startDate);
  const strictAfterAnchor = Boolean(schedule.lastPaidDate);
  const referenceDate = hasAnchor ? anchor : parseDateInputValue(toDateInputValue(date));

  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return strictAfterAnchor ? addWorkDays(anchor, 1, calendar) : nextWorkDate(referenceDate, calendar);
    case PayrollFrequency.WEEKLY: {
      const targetDay = schedule.weeklyPayDay ?? 5;
      let cursor = referenceDate;
      for (let scanned = 0; scanned <= MAX_SCHEDULE_SCAN_STEPS; scanned += 1) {
        while (cursor.getUTCDay() !== targetDay) {
          cursor = shiftCalendarDays(cursor, 1);
        }
        const payDate = nextWorkDate(cursor, calendar);
        if (isAfterAnchor(payDate, anchor, strictAfterAnchor)) {
          return payDate;
        }
        cursor = shiftCalendarDays(cursor, 1);
      }
      return nextWorkDate(referenceDate, calendar);
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = schedule.monthlyPayDay ?? 15;
      let monthCursor = startOfMonthBusiness(referenceDate);
      for (let scanned = 0; scanned <= MAX_SCHEDULE_SCAN_STEPS; scanned += 1) {
        const payDate = nextWorkDate(safeDateInMonth(monthCursor, targetDay), calendar);
        if (isAfterAnchor(payDate, anchor, strictAfterAnchor)) {
          return payDate;
        }
        monthCursor = shiftMonthStart(monthCursor, 1);
      }
      return nextWorkDate(referenceDate, calendar);
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(schedule.twiceMonthlyDayOne ?? 15, schedule.twiceMonthlyDayTwo ?? 30);
      let monthCursor = startOfMonthBusiness(referenceDate);
      for (let scanned = 0; scanned <= MAX_SCHEDULE_SCAN_STEPS; scanned += 1) {
        const firstDate = nextWorkDate(safeDateInMonth(monthCursor, first), calendar);
        if (isAfterAnchor(firstDate, anchor, strictAfterAnchor)) return firstDate;
        const secondDate = nextWorkDate(safeDateInMonth(monthCursor, second), calendar);
        if (isAfterAnchor(secondDate, anchor, strictAfterAnchor)) return secondDate;
        monthCursor = shiftMonthStart(monthCursor, 1);
      }
      return nextWorkDate(referenceDate, calendar);
    }
    case PayrollFrequency.EVERY_N_DAYS: {
      const interval = Math.max(schedule.everyNDays ?? 7, 2);
      const anchor = getEveryNDaysAnchor(schedule, date);
      const hasPreviousPayout = Boolean(schedule.lastPaidDate);
      return hasPreviousPayout ? addWorkDays(anchor, interval, calendar) : addWorkDays(anchor, interval - 1, calendar);
    }
    default:
      return nextWorkDate(parseDateInputValue(toDateInputValue(date)), calendar);
  }
}

export function getPeriodForPayDate(payDate: Date, schedule: PayrollScheduleLike, calendar?: WorkCalendar): GeneratedPeriod {
  const anchoredStart = schedule.lastPaidDate ? addWorkDays(startOfDayLocal(schedule.lastPaidDate), 1, calendar) : null;

  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return {
        periodStart: payDate,
        periodEnd: payDate,
        payDate,
        label: formatDate(payDate)
      };
    case PayrollFrequency.WEEKLY: {
      const targetDay = schedule.weeklyPayDay ?? 5;
      let scheduledPayDate = parseDateInputValue(toDateInputValue(payDate));

      for (let scanned = 0; scanned <= MAX_SCHEDULE_SCAN_STEPS; scanned += 1) {
        const matchesTargetDay = scheduledPayDate.getUTCDay() === targetDay;
        const resolvesToPayDate = toDateInputValue(nextWorkDate(scheduledPayDate, calendar)) === toDateInputValue(payDate);
        if (matchesTargetDay && resolvesToPayDate) break;
        scheduledPayDate = shiftCalendarDays(scheduledPayDate, -1);
      }

      const previousPayDate = nextWorkDate(shiftCalendarDays(scheduledPayDate, -7), calendar);
      const start = anchoredStart && compareDateValues(anchoredStart, payDate) <= 0 ? anchoredStart : addWorkDays(previousPayDate, 1, calendar);
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
      const previousPayDate = nextWorkDate(safeDateInMonth(previousMonth, targetDay), calendar);
      const start = anchoredStart && compareDateValues(anchoredStart, payDate) <= 0 ? anchoredStart : addWorkDays(previousPayDate, 1, calendar);
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
      const firstDate = nextWorkDate(safeDateInMonth(payDate, first), calendar);
      const secondDate = nextWorkDate(safeDateInMonth(payDate, second), calendar);

      if (isSameBusinessDate(payDate, firstDate)) {
        const start = anchoredStart && compareDateValues(anchoredStart, payDate) <= 0 ? anchoredStart : startOfMonthBusiness(payDate);
        return {
          periodStart: start,
          periodEnd: firstDate,
          payDate,
          label: `${formatShortDate(start)} - ${formatDate(firstDate)}`
        };
      }

      if (isSameBusinessDate(payDate, secondDate)) {
        const start = anchoredStart && compareDateValues(anchoredStart, payDate) <= 0 ? anchoredStart : addWorkDays(firstDate, 1, calendar);
        return {
          periodStart: start,
          periodEnd: secondDate,
          payDate,
          label: `${formatShortDate(start)} - ${formatDate(secondDate)}`
        };
      }

      const prevMonth = shiftMonthStart(payDate, -1);
      const prevSecond = nextWorkDate(safeDateInMonth(prevMonth, second), calendar);
      const start = anchoredStart && compareDateValues(anchoredStart, payDate) <= 0 ? anchoredStart : addWorkDays(prevSecond, 1, calendar);
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
      const startCandidate = anchoredStart ?? addWorkDays(payDate, -(interval - 1), calendar);
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

export function getPayrollCycleDays(schedule: PayrollScheduleLike, payDate?: Date, calendar?: WorkCalendar) {
  switch (schedule.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return 1;
    case PayrollFrequency.WEEKLY: {
      const referencePayDate = payDate ?? getPayDateForDate(new Date(), schedule, calendar);
      const period = getPeriodForPayDate(referencePayDate, schedule, calendar);
      return Math.max(differenceInWorkDays(period.periodEnd, period.periodStart, calendar) + 1, 1);
    }
    case PayrollFrequency.EVERY_N_DAYS:
      return Math.max(schedule.everyNDays ?? 7, 2);
    case PayrollFrequency.MONTHLY:
    case PayrollFrequency.TWICE_MONTHLY: {
      const referencePayDate = payDate ?? getPayDateForDate(new Date(), schedule, calendar);
      const period = getPeriodForPayDate(referencePayDate, schedule, calendar);
      return Math.max(differenceInWorkDays(period.periodEnd, period.periodStart, calendar) + 1, 1);
    }
    default:
      return 1;
  }
}

export function getTimelineRetentionDays(schedule: PayrollScheduleLike, payDate?: Date, calendar?: WorkCalendar) {
  return Math.ceil(getPayrollCycleDays(schedule, payDate, calendar) / 2);
}
