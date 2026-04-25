import type { TimelineEntry } from "@/components/payroll-due-timeline";
import {
  getAdvanceDeductionForPreview,
  getLedgerDeductionForPreview,
  getLivePayrollAttendanceMetrics
} from "@/lib/payroll-live";
import { describePayrollFrequency, getPayDateForDate, getPeriodForPayDate, getTimelineRetentionDays } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import {
  addBusinessDays,
  endOfDayLocal,
  formatDate,
  formatShortWeekday,
  parseDateInputValue,
  startOfDayLocal,
  toDateInputValue
} from "@/lib/utils";
import { addWorkDays, differenceInWorkDays, getShopWorkCalendar, isWorkDate, type WorkCalendar } from "@/lib/work-schedule";

type AttendanceRecordLike = {
  date: Date;
  status: "PRESENT" | "HALF_DAY" | "ABSENT";
};

type AttendanceCalendarStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "NO_WORK";

function addCalendarDays(date: Date, amount: number) {
  return parseDateInputValue(toDateInputValue(new Date(date.getTime() + amount * 24 * 60 * 60 * 1000)));
}

function buildAttendanceCalendarDays({
  periodStart,
  periodEnd,
  attendanceRecords,
  workCalendar
}: {
  periodStart: Date;
  periodEnd: Date;
  attendanceRecords: AttendanceRecordLike[];
  workCalendar: WorkCalendar;
}) {
  const recordsByDate = new Map(attendanceRecords.map((record) => [toDateInputValue(record.date), record]));
  const days = [];
  let cursor = parseDateInputValue(toDateInputValue(periodStart));
  const endValue = toDateInputValue(periodEnd);

  while (toDateInputValue(cursor) <= endValue) {
    const dateValue = toDateInputValue(cursor);
    const record = recordsByDate.get(dateValue);
    const workDay = isWorkDate(cursor, workCalendar);
    const status: AttendanceCalendarStatus = !workDay
      ? "NO_WORK"
      : record?.status === "ABSENT"
        ? "ABSENT"
        : record?.status === "HALF_DAY"
          ? "HALF_DAY"
          : "PRESENT";

    days.push({
      dateValue,
      dayLabel: formatShortWeekday(cursor),
      dateLabel: String(Number(dateValue.slice(-2))),
      status
    });

    cursor = addCalendarDays(cursor, 1);
  }

  return days;
}

export async function getPayrollTimelineEntries({
  shopId,
  limit = 8
}: {
  shopId: string;
  limit?: number;
}): Promise<TimelineEntry[]> {
  const todayStart = startOfDayLocal(new Date());
  const workCalendar = await getShopWorkCalendar(shopId);
  const employees = await prisma.employee.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: { fullName: "asc" }
  });
  const employeeIds = employees.map((employee) => employee.id);
  const hasEmployees = employeeIds.length > 0;

  const [timelineBonuses, timelineAdvances, timelinePayables, existingTimelinePeriods] = await Promise.all([
    hasEmployees
      ? prisma.bonus.findMany({
          where: {
            status: "OPEN",
            employeeId: { in: employeeIds }
          },
          select: {
            id: true,
            employeeId: true,
            date: true,
            amount: true
          },
          orderBy: [{ employeeId: "asc" }, { date: "asc" }]
        })
      : Promise.resolve([]),
    hasEmployees
      ? prisma.advance.findMany({
          where: {
            status: "OPEN",
            employeeId: { in: employeeIds }
          },
          select: {
            id: true,
            employeeId: true,
            date: true,
            remainingBalance: true,
            deductionPerPayroll: true
          },
          orderBy: [{ employeeId: "asc" }, { date: "asc" }]
        })
      : Promise.resolve([]),
    hasEmployees
      ? prisma.payable.findMany({
          where: {
            status: "OPEN",
            employeeId: { in: employeeIds }
          },
          select: {
            id: true,
            employeeId: true,
            date: true,
            remainingBalance: true
          },
          orderBy: [{ employeeId: "asc" }, { date: "asc" }]
        })
      : Promise.resolve([]),
    prisma.payrollPeriod.findMany({
      where: {
        shopId,
        OR: [
          { status: { not: "PAID" } },
          {
            status: "PAID",
            payDate: {
              gte: startOfDayLocal(addBusinessDays(todayStart, -400)),
              lte: endOfDayLocal(todayStart)
            }
          }
        ]
      },
      include: {
        payrollEntries: {
          include: {
            employee: true
          },
          orderBy: {
            employee: {
              fullName: "asc"
            }
          }
        }
      },
      orderBy: {
        payDate: "desc"
      }
    })
  ]);

  const nextPayrollEvents = employees
    .map((employee) => {
      const baseDate = employee.startDate && startOfDayLocal(employee.startDate) > todayStart ? startOfDayLocal(employee.startDate) : todayStart;
      const payDate = getPayDateForDate(baseDate, employee, workCalendar);
      const period = getPeriodForPayDate(payDate, employee, workCalendar);

      return {
        employee,
        payDate,
        period
      };
    })
    .sort((a, b) => a.payDate.getTime() - b.payDate.getTime());

  const retainedTimelinePeriods = existingTimelinePeriods.filter((period) => {
    if (period.status !== "PAID") {
      return true;
    }

    const maxRetentionDays = period.payrollEntries.reduce((maxDays, entry) => {
      return Math.max(maxDays, getTimelineRetentionDays(entry.employee, period.payDate, workCalendar));
    }, 0);

    return addWorkDays(startOfDayLocal(period.payDate), maxRetentionDays, workCalendar) >= todayStart;
  });

  const timelineRangeStartCandidates = [
    nextPayrollEvents[0]?.period.periodStart,
    ...retainedTimelinePeriods.map((period) => period.periodStart)
  ].filter((value): value is Date => Boolean(value));
  const timelineRangeEndCandidates = [
    nextPayrollEvents[nextPayrollEvents.length - 1]?.period.periodEnd,
    ...retainedTimelinePeriods.map((period) => period.periodEnd)
  ].filter((value): value is Date => Boolean(value));
  const timelineRangeStart = timelineRangeStartCandidates.length
    ? timelineRangeStartCandidates.reduce((min, value) => (value < min ? value : min))
    : null;
  const timelineRangeEnd = timelineRangeEndCandidates.length
    ? timelineRangeEndCandidates.reduce((max, value) => (value > max ? value : max))
    : null;
  const timelineEmployeeIds = Array.from(
    new Set([
      ...nextPayrollEvents.map((event) => event.employee.id),
      ...retainedTimelinePeriods.flatMap((period) => period.payrollEntries.map((entry) => entry.employeeId))
    ])
  );
  const payrollWindowAttendance =
    timelineRangeStart && timelineRangeEnd && timelineEmployeeIds.length
      ? await prisma.attendanceRecord.findMany({
          where: {
            employeeId: { in: timelineEmployeeIds },
            date: {
              gte: startOfDayLocal(timelineRangeStart),
              lte: endOfDayLocal(timelineRangeEnd)
            }
          }
        })
      : [];
  const periodStatusByDate = new Map<string, string[]>();
  existingTimelinePeriods.forEach((period) => {
    const key = toDateInputValue(period.payDate);
    const current = periodStatusByDate.get(key) ?? [];
    current.push(period.status);
    periodStatusByDate.set(key, current);
  });

  const simulatedAdvancesByEmployee = new Map(
    employees.map((employee) => [
      employee.id,
      timelineAdvances
        .filter((advance) => advance.employeeId === employee.id)
        .map((advance) => ({
          id: advance.id,
          date: advance.date,
          remainingBalance: Number(advance.remainingBalance),
          deductionPerPayroll: advance.deductionPerPayroll == null ? null : Number(advance.deductionPerPayroll)
        }))
    ])
  );
  const simulatedBonusesByEmployee = new Map(
    employees.map((employee) => [
      employee.id,
      timelineBonuses
        .filter((bonus) => bonus.employeeId === employee.id)
        .map((bonus) => ({
          id: bonus.id,
          date: bonus.date,
          amount: Number(bonus.amount)
        }))
    ])
  );
  const simulatedPayablesByEmployee = new Map(
    employees.map((employee) => [
      employee.id,
      timelinePayables
        .filter((payable) => payable.employeeId === employee.id)
        .map((payable) => ({
          id: payable.id,
          date: payable.date,
          remainingBalance: Number(payable.remainingBalance)
        }))
    ])
  );
  const attendanceByEmployee = new Map<string, typeof payrollWindowAttendance>(
    nextPayrollEvents.map((event) => [event.employee.id, payrollWindowAttendance.filter((record) => record.employeeId === event.employee.id)])
  );
  const payrollTimelineEntries = Array.from(
    nextPayrollEvents.reduce((groups, event) => {
      const employeeRecords = attendanceByEmployee.get(event.employee.id) ?? [];
      const liveMetrics = getLivePayrollAttendanceMetrics({
        employee: event.employee,
        periodStart: event.period.periodStart,
        periodEnd: event.period.periodEnd,
        attendanceRecords: employeeRecords,
        calendar: workCalendar
      });
      let bonusAdded = 0;
      const employeeBonuses = simulatedBonusesByEmployee.get(event.employee.id) ?? [];
      for (const bonus of employeeBonuses) {
        if (bonus.date > endOfDayLocal(event.period.periodEnd)) continue;
        bonusAdded += bonus.amount;
        bonus.amount = 0;
      }

      let runningNet = liveMetrics.grossPay + bonusAdded;
      let advancesDeducted = 0;
      let payablesDeducted = 0;
      const employeeAdvances = simulatedAdvancesByEmployee.get(event.employee.id) ?? [];
      const employeePayables = simulatedPayablesByEmployee.get(event.employee.id) ?? [];

      for (const advance of employeeAdvances) {
        if (runningNet <= 0) break;
        if (advance.remainingBalance <= 0) continue;
        if (advance.date > endOfDayLocal(event.period.periodEnd)) continue;

        const deduction = getAdvanceDeductionForPreview({
          runningNet,
          remainingBalance: advance.remainingBalance,
          deductionPerPayroll: advance.deductionPerPayroll
        });

        if (deduction > 0) {
          runningNet -= deduction;
          advancesDeducted += deduction;
          advance.remainingBalance -= deduction;
        }
      }

      for (const payable of employeePayables) {
        if (runningNet <= 0) break;
        if (payable.remainingBalance <= 0) continue;
        if (payable.date > endOfDayLocal(event.period.periodEnd)) continue;

        const deduction = getLedgerDeductionForPreview(runningNet, payable.remainingBalance);

        if (deduction > 0) {
          runningNet -= deduction;
          payablesDeducted += deduction;
          payable.remainingBalance -= deduction;
        }
      }

      const expectedAmount = runningNet;
      const payDateKey = toDateInputValue(event.payDate);
      const dueOffset = differenceInWorkDays(event.payDate, todayStart, workCalendar);
      const periodStatuses = periodStatusByDate.get(payDateKey) ?? [];
      const isPaid = periodStatuses.length > 0 && periodStatuses.every((status) => status === "PAID");
      const dueLabel = isPaid
        ? "Paid"
        : dueOffset === 0
          ? "Today"
          : dueOffset === 1
            ? "Due tomorrow"
            : dueOffset > 1
              ? `Due in ${dueOffset} days`
              : dueOffset < 0
                ? `Overdue by ${Math.abs(dueOffset)} day${Math.abs(dueOffset) > 1 ? "s" : ""}`
                : formatShortWeekday(event.payDate);
      const existing = groups.get(payDateKey) ?? {
        id: payDateKey,
        payDateValue: payDateKey,
        payDateLabel: formatDate(event.payDate),
        dueLabel: isPaid ? "Paid" : dueLabel,
        isPaid,
        expectedTotal: 0,
        employeeNames: [],
        details: []
      };

      existing.expectedTotal += expectedAmount;
      existing.employeeNames.push(event.employee.fullName);
      const attendanceCalendarDays = buildAttendanceCalendarDays({
        periodStart: event.period.periodStart,
        periodEnd: event.period.periodEnd,
        attendanceRecords: employeeRecords,
        workCalendar
      });
      existing.details.push({
        employeeId: event.employee.id,
        employeeName: event.employee.fullName,
        employeeCode: event.employee.employeeCode,
        position: event.employee.position,
        frequencyLabel: describePayrollFrequency(event.employee),
        periodLabel: event.period.label,
        calendarMode: event.employee.payrollFrequency === "WEEKLY" ? "weekday" : "date",
        attendanceCalendarDays,
        absentDates: liveMetrics.absentDates.map((date) => toDateInputValue(date)),
        halfDayDates: liveMetrics.halfDayDates.map((date) => toDateInputValue(date)),
        daysAbsent: liveMetrics.daysAbsent,
        daysHalf: liveMetrics.daysHalf,
        estimatedDays: liveMetrics.daysPresent,
        paidDayUnits: liveMetrics.paidDayUnits,
        dailyRate: Number(event.employee.dailyRate),
        grossPay: liveMetrics.grossPay,
        bonusesAdded: bonusAdded,
        advancesDeducted,
        payablesDeducted,
        expectedAmount
      });
      groups.set(payDateKey, existing);

      return groups;
    }, new Map<string, TimelineEntry>()).values()
  );
  const attendanceForEmployee = (employeeId: string) => payrollWindowAttendance.filter((record) => record.employeeId === employeeId);
  const actualTimelineEntries = Array.from(
    retainedTimelinePeriods.reduce((groups, period) => {
      const payDateValue = toDateInputValue(period.payDate);
      const dueOffset = differenceInWorkDays(period.payDate, todayStart, workCalendar);
      const isPaid = period.status === "PAID";
      const dueLabel = isPaid
        ? "Paid"
        : dueOffset === 0
          ? "Today"
          : dueOffset === 1
            ? "Due tomorrow"
            : dueOffset > 1
              ? `Due in ${dueOffset} days`
              : dueOffset < 0
                ? `Overdue by ${Math.abs(dueOffset)} day${Math.abs(dueOffset) > 1 ? "s" : ""}`
                : formatShortWeekday(period.payDate);

      const existing = groups.get(payDateValue) ?? {
        id: `actual-${payDateValue}`,
        payDateValue,
        payDateLabel: formatDate(period.payDate),
        dueLabel,
        isPaid,
        expectedTotal: 0,
        employeeNames: [],
        details: []
      };

      existing.isPaid = existing.isPaid && isPaid;
      if (!existing.isPaid) {
        existing.dueLabel = dueLabel;
      }

      period.payrollEntries.forEach((entry) => {
        const alreadyIncluded = existing.details.some((detail) => detail.employeeId === entry.employee.id);
        if (alreadyIncluded) return;

        const liveMetrics = getLivePayrollAttendanceMetrics({
          employee: entry.employee,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          attendanceRecords: attendanceForEmployee(entry.employee.id),
          calendar: workCalendar
        });

        const bonusesAdded = "totalBonusesAdded" in entry ? Number(entry.totalBonusesAdded ?? 0) : 0;
        const advancesDeducted = Number(entry.totalAdvancesDeducted);
        const payablesDeducted = Number(entry.totalPayablesDeducted);
        const actualPaidAmount = Number(entry.netPay);
        const liveExpectedAmount = Math.max(liveMetrics.grossPay + bonusesAdded - advancesDeducted - payablesDeducted, 0);
        const displayedAmount = period.status === "PAID" ? actualPaidAmount : liveExpectedAmount;

        existing.expectedTotal += displayedAmount;
        if (!existing.employeeNames.includes(entry.employee.fullName)) {
          existing.employeeNames.push(entry.employee.fullName);
        }
        const employeeAttendance = attendanceForEmployee(entry.employee.id);
        const attendanceCalendarDays = buildAttendanceCalendarDays({
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          attendanceRecords: employeeAttendance,
          workCalendar
        });
        existing.details.push({
          employeeId: entry.employee.id,
          employeeName: entry.employee.fullName,
          employeeCode: entry.employee.employeeCode,
          position: entry.employee.position,
          frequencyLabel: describePayrollFrequency(entry.employee),
          periodLabel: period.label.replace(/^Payroll - /, ""),
          calendarMode: entry.employee.payrollFrequency === "WEEKLY" ? "weekday" : "date",
          attendanceCalendarDays,
          absentDates: liveMetrics.absentDates.map((date) => toDateInputValue(date)),
          halfDayDates: liveMetrics.halfDayDates.map((date) => toDateInputValue(date)),
          daysAbsent: period.status === "PAID" ? entry.daysAbsent : liveMetrics.daysAbsent,
          daysHalf: period.status === "PAID" ? ("daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0) : liveMetrics.daysHalf,
          estimatedDays: period.status === "PAID" ? entry.daysPresent : liveMetrics.daysPresent,
          paidDayUnits:
            period.status === "PAID"
              ? entry.daysPresent + ("daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0) * 0.5
              : liveMetrics.paidDayUnits,
          dailyRate: Number(entry.employee.dailyRate),
          grossPay: period.status === "PAID" ? Number(entry.grossPay) : liveMetrics.grossPay,
          bonusesAdded,
          advancesDeducted,
          payablesDeducted,
          expectedAmount: displayedAmount
        });
      });

      groups.set(payDateValue, existing);
      return groups;
    }, new Map<string, TimelineEntry>()).values()
  );
  const actualPayDates = new Set(actualTimelineEntries.map((entry) => entry.payDateValue));

  return [...actualTimelineEntries, ...payrollTimelineEntries.filter((entry) => !actualPayDates.has(entry.payDateValue))]
    .sort((a, b) => {
      if (a.isPaid !== b.isPaid) {
        return a.isPaid ? -1 : 1;
      }
      return parseDateInputValue(a.payDateValue).getTime() - parseDateInputValue(b.payDateValue).getTime();
    })
    .slice(0, limit);
}
