import { PayrollFrequency, type PayrollSettings } from "@prisma/client";
import {
  addDays,
  endOfMonth,
  format,
  getDate,
  getDay,
  isSameDay,
  lastDayOfMonth,
  setDate,
  startOfMonth,
  subDays
} from "date-fns";

export type GeneratedPeriod = {
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  label: string;
};

function clampDay(day: number, referenceDate: Date) {
  return Math.min(day, getDate(lastDayOfMonth(referenceDate)));
}

function safeDateInMonth(referenceDate: Date, day: number) {
  return setDate(startOfMonth(referenceDate), clampDay(day, referenceDate));
}

export function getPayDateForDate(date: Date, settings: PayrollSettings): Date {
  switch (settings.frequency) {
    case PayrollFrequency.DAILY:
      return date;
    case PayrollFrequency.WEEKLY: {
      const targetDay = settings.weeklyPayDay ?? 5;
      let cursor = new Date(date);
      while (getDay(cursor) !== targetDay) {
        cursor = addDays(cursor, 1);
      }
      return cursor;
    }
    case PayrollFrequency.MONTHLY: {
      const targetDay = settings.monthlyPayDay ?? 15;
      const currentMonthPayDate = safeDateInMonth(date, targetDay);
      return date <= currentMonthPayDate ? currentMonthPayDate : safeDateInMonth(addDays(endOfMonth(date), 1), targetDay);
    }
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(settings.twiceMonthlyDayOne ?? 15, settings.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(settings.twiceMonthlyDayOne ?? 15, settings.twiceMonthlyDayTwo ?? 30);
      const firstDate = safeDateInMonth(date, first);
      const secondDate = safeDateInMonth(date, second);
      if (date <= firstDate) return firstDate;
      if (date <= secondDate) return secondDate;
      return safeDateInMonth(addDays(endOfMonth(date), 1), first);
    }
    default:
      return date;
  }
}

export function getPeriodForPayDate(payDate: Date, settings: PayrollSettings): GeneratedPeriod {
  switch (settings.frequency) {
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
      const targetDay = settings.monthlyPayDay ?? 15;
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
      const first = Math.min(settings.twiceMonthlyDayOne ?? 15, settings.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(settings.twiceMonthlyDayOne ?? 15, settings.twiceMonthlyDayTwo ?? 30);
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
  }
}
