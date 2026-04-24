import { clsx, type ClassValue } from "clsx";

export const BUSINESS_TIME_ZONE = "Asia/Manila";
const BUSINESS_UTC_OFFSET_MINUTES = 8 * 60;
const BUSINESS_UTC_OFFSET_MS = BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000;

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

export function formatShortWeekday(date: Date | string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short"
  }).format(new Date(date));
}

export function formatDayMonth(date: Date | string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "numeric",
    month: "short"
  }).format(new Date(date));
}

function getBusinessDateParts(date: Date) {
  const shifted = new Date(date.getTime() + BUSINESS_UTC_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function createBusinessDate(year: number, month: number, day: number, hour = 12, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - BUSINESS_UTC_OFFSET_MS);
}

export function toDateInputValue(date: Date) {
  const { year, month, day } = getBusinessDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return new Date(value);
  }
  return createBusinessDate(year, month, day);
}

export function startOfDayLocal(date: Date) {
  const { year, month, day } = getBusinessDateParts(date);
  return createBusinessDate(year, month, day, 0, 0, 0, 0);
}

export function endOfDayLocal(date: Date) {
  const { year, month, day } = getBusinessDateParts(date);
  return createBusinessDate(year, month, day, 23, 59, 59, 999);
}

export function getWeekdayLabel(day: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "Unknown";
}

export function isSameBusinessDate(left: Date | string, right: Date | string) {
  return toDateInputValue(new Date(left)) === toDateInputValue(new Date(right));
}

export function compareBusinessDates(left: Date | string, right: Date | string) {
  return toDateInputValue(new Date(left)).localeCompare(toDateInputValue(new Date(right)));
}

export function addBusinessDays(date: Date, amount: number) {
  const shifted = new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
  return parseDateInputValue(toDateInputValue(shifted));
}

export function differenceInBusinessDays(left: Date | string, right: Date | string) {
  const leftDate = parseDateInputValue(toDateInputValue(new Date(left)));
  const rightDate = parseDateInputValue(toDateInputValue(new Date(right)));
  return Math.round((leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000));
}
