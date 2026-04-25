import { prisma } from "@/lib/prisma";
import { parseDateInputValue, toDateInputValue } from "@/lib/utils";

export type WorkCalendar = {
  workWeekdays: Set<number>;
  noWorkDates: Set<string>;
};

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];
const MAX_CALENDAR_SCAN_DAYS = 370;
const MAX_RANGE_DAYS = 3700;

export function parseWorkDays(value?: string | null) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);

  return parsed.length ? Array.from(new Set(parsed)).sort((a, b) => a - b) : DEFAULT_WORK_DAYS;
}

export function serializeWorkDays(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)))
    .sort((a, b) => a - b)
    .join(",");
}

function normalizeCalendar(calendar?: WorkCalendar): WorkCalendar | undefined {
  if (!calendar) return undefined;
  return {
    workWeekdays: calendar.workWeekdays.size ? calendar.workWeekdays : new Set(DEFAULT_WORK_DAYS),
    noWorkDates: calendar.noWorkDates ?? new Set<string>()
  };
}

function shiftDate(date: Date, direction: 1 | -1) {
  return parseDateInputValue(toDateInputValue(new Date(date.getTime() + direction * 24 * 60 * 60 * 1000)));
}

export async function getShopWorkCalendar(shopId: string): Promise<WorkCalendar> {
  const settingsRows = await prisma.$queryRaw<Array<{ workDays: string | null }>>`
    SELECT "workDays" FROM "PayrollSettings" WHERE "shopId" = ${shopId} LIMIT 1
  `;
  const noWorkRows = await prisma.$queryRaw<Array<{ date: Date }>>`
    SELECT "date" FROM "ShopNoWorkDay" WHERE "shopId" = ${shopId}
  `;

  return {
    workWeekdays: new Set(parseWorkDays(settingsRows[0]?.workDays)),
    noWorkDates: new Set(noWorkRows.map((row) => toDateInputValue(row.date)))
  };
}

export function isWorkDate(date: Date, calendar?: WorkCalendar) {
  const usableCalendar = normalizeCalendar(calendar);
  if (!usableCalendar) return true;
  const dateValue = toDateInputValue(date);
  const businessDate = parseDateInputValue(dateValue);
  return usableCalendar.workWeekdays.has(businessDate.getUTCDay()) && !usableCalendar.noWorkDates.has(dateValue);
}

export function nextWorkDate(date: Date, calendar?: WorkCalendar) {
  const usableCalendar = normalizeCalendar(calendar);
  let cursor = parseDateInputValue(toDateInputValue(date));

  for (let scanned = 0; scanned <= MAX_CALENDAR_SCAN_DAYS; scanned += 1) {
    if (isWorkDate(cursor, usableCalendar)) return cursor;
    cursor = shiftDate(cursor, 1);
  }

  return parseDateInputValue(toDateInputValue(date));
}

export function addWorkDays(date: Date, amount: number, calendar?: WorkCalendar) {
  const usableCalendar = normalizeCalendar(calendar);
  if (!usableCalendar) {
    const shifted = new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
    return parseDateInputValue(toDateInputValue(shifted));
  }

  const direction: 1 | -1 = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = parseDateInputValue(toDateInputValue(date));

  for (let scanned = 0; remaining > 0 && scanned <= MAX_RANGE_DAYS; scanned += 1) {
    cursor = shiftDate(cursor, direction);
    if (isWorkDate(cursor, usableCalendar)) {
      remaining -= 1;
    }
  }

  return cursor;
}

export function differenceInWorkDays(left: Date | string, right: Date | string, calendar?: WorkCalendar) {
  const usableCalendar = normalizeCalendar(calendar);
  const leftValue = toDateInputValue(new Date(left));
  const rightValue = toDateInputValue(new Date(right));
  if (!usableCalendar) {
    const leftDate = parseDateInputValue(leftValue);
    const rightDate = parseDateInputValue(rightValue);
    return Math.round((leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000));
  }
  if (leftValue === rightValue) return 0;

  const direction: 1 | -1 = leftValue > rightValue ? 1 : -1;
  let cursor = parseDateInputValue(rightValue);
  let count = 0;

  for (let scanned = 0; toDateInputValue(cursor) !== leftValue && scanned <= MAX_RANGE_DAYS; scanned += 1) {
    cursor = shiftDate(cursor, direction);
    if (isWorkDate(cursor, usableCalendar)) {
      count += direction;
    }
  }

  return count;
}

export function countWorkDaysInclusive(start: Date, end: Date, calendar?: WorkCalendar) {
  const usableCalendar = normalizeCalendar(calendar);
  if (start > end) return 0;
  let cursor = parseDateInputValue(toDateInputValue(start));
  const endValue = toDateInputValue(end);
  let count = 0;

  for (let scanned = 0; toDateInputValue(cursor) <= endValue && scanned <= MAX_RANGE_DAYS; scanned += 1) {
    if (isWorkDate(cursor, usableCalendar)) {
      count += 1;
    }
    cursor = shiftDate(cursor, 1);
  }

  return count;
}
