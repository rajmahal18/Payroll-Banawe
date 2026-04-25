import { prisma } from "@/lib/prisma";
import { parseDateInputValue, toDateInputValue } from "@/lib/utils";

export type WorkCalendar = {
  workWeekdays: Set<number>;
  noWorkDates: Set<string>;
};

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];

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
  if (!calendar) return true;
  const dateValue = toDateInputValue(date);
  const businessDate = parseDateInputValue(dateValue);
  return calendar.workWeekdays.has(businessDate.getUTCDay()) && !calendar.noWorkDates.has(dateValue);
}

export function nextWorkDate(date: Date, calendar?: WorkCalendar) {
  let cursor = parseDateInputValue(toDateInputValue(date));
  while (!isWorkDate(cursor, calendar)) {
    cursor = addWorkDays(cursor, 1);
  }
  return cursor;
}

export function addWorkDays(date: Date, amount: number, calendar?: WorkCalendar) {
  if (!calendar) {
    const shifted = new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
    return parseDateInputValue(toDateInputValue(shifted));
  }

  const direction = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = parseDateInputValue(toDateInputValue(date));

  while (remaining > 0) {
    cursor = parseDateInputValue(toDateInputValue(new Date(cursor.getTime() + direction * 24 * 60 * 60 * 1000)));
    if (isWorkDate(cursor, calendar)) {
      remaining -= 1;
    }
  }

  return cursor;
}

export function differenceInWorkDays(left: Date | string, right: Date | string, calendar?: WorkCalendar) {
  const leftValue = toDateInputValue(new Date(left));
  const rightValue = toDateInputValue(new Date(right));
  if (!calendar) {
    const leftDate = parseDateInputValue(leftValue);
    const rightDate = parseDateInputValue(rightValue);
    return Math.round((leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000));
  }
  if (leftValue === rightValue) return 0;

  const direction = leftValue > rightValue ? 1 : -1;
  let cursor = parseDateInputValue(rightValue);
  let count = 0;

  while (toDateInputValue(cursor) !== leftValue) {
    cursor = parseDateInputValue(toDateInputValue(new Date(cursor.getTime() + direction * 24 * 60 * 60 * 1000)));
    if (isWorkDate(cursor, calendar)) {
      count += direction;
    }
  }

  return count;
}

export function countWorkDaysInclusive(start: Date, end: Date, calendar?: WorkCalendar) {
  if (start > end) return 0;
  let cursor = parseDateInputValue(toDateInputValue(start));
  const endValue = toDateInputValue(end);
  let count = 0;

  while (toDateInputValue(cursor) <= endValue) {
    if (isWorkDate(cursor, calendar)) {
      count += 1;
    }
    cursor = parseDateInputValue(toDateInputValue(new Date(cursor.getTime() + 24 * 60 * 60 * 1000)));
  }

  return count;
}
