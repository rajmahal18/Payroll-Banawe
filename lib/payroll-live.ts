import { Prisma } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { endOfDayLocal, startOfDayLocal } from "@/lib/utils";

type AttendanceRecordLike = {
  date: Date;
  status: "PRESENT" | "HALF_DAY" | "ABSENT";
};

type EmployeePayrollLike = {
  startDate: Date | null;
  dailyRate: Prisma.Decimal | number;
};

export function getEffectivePayrollStart(periodStart: Date, employeeStartDate: Date | null) {
  const normalizedPeriodStart = startOfDayLocal(periodStart);
  const normalizedEmployeeStart = employeeStartDate ? startOfDayLocal(employeeStartDate) : null;

  return normalizedEmployeeStart && normalizedEmployeeStart > normalizedPeriodStart
    ? normalizedEmployeeStart
    : normalizedPeriodStart;
}

export function getCoveredDaysForPayroll(periodStart: Date, periodEnd: Date, employeeStartDate: Date | null) {
  const effectiveStart = getEffectivePayrollStart(periodStart, employeeStartDate);

  if (effectiveStart > endOfDayLocal(periodEnd)) {
    return 0;
  }

  return differenceInCalendarDays(startOfDayLocal(periodEnd), effectiveStart) + 1;
}

export function getAdvanceDeductionForPreview({
  runningNet,
  remainingBalance,
  deductionPerPayroll
}: {
  runningNet: number;
  remainingBalance: number;
  deductionPerPayroll: number | null;
}) {
  const cappedBalance = deductionPerPayroll != null ? Math.min(remainingBalance, deductionPerPayroll) : remainingBalance;
  return Math.min(runningNet, cappedBalance);
}

export function getLedgerDeductionForPreview(runningNet: number, remainingBalance: number) {
  return Math.min(runningNet, remainingBalance);
}

export function getLivePayrollAttendanceMetrics({
  employee,
  periodStart,
  periodEnd,
  attendanceRecords
}: {
  employee: EmployeePayrollLike;
  periodStart: Date;
  periodEnd: Date;
  attendanceRecords: AttendanceRecordLike[];
}) {
  const effectiveAttendanceStart = getEffectivePayrollStart(periodStart, employee.startDate);
  const coveredAttendanceRecords = attendanceRecords.filter(
    (record) => record.date >= effectiveAttendanceStart && record.date <= endOfDayLocal(periodEnd)
  );
  const daysAbsent = coveredAttendanceRecords.filter((record) => record.status === "ABSENT").length;
  const daysHalf = coveredAttendanceRecords.filter((record) => record.status === "HALF_DAY").length;
  const coveredDays = getCoveredDaysForPayroll(periodStart, periodEnd, employee.startDate);
  const daysPresent = Math.max(coveredDays - daysAbsent - daysHalf, 0);
  const paidDayUnits = daysPresent + daysHalf * 0.5;
  const grossPay = paidDayUnits * Number(employee.dailyRate);
  const absentDates = coveredAttendanceRecords
    .filter((record) => record.status === "ABSENT")
    .map((record) => record.date);
  const halfDayDates = coveredAttendanceRecords
    .filter((record) => record.status === "HALF_DAY")
    .map((record) => record.date);

  return {
    daysAbsent,
    daysHalf,
    daysPresent,
    paidDayUnits,
    grossPay,
    absentDates,
    halfDayDates
  };
}
