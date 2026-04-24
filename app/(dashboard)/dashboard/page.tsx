import { addDays, differenceInCalendarDays, endOfDay, format, isSameDay, isToday, isTomorrow, startOfDay, subDays } from "date-fns";
import { AttendanceChecklist } from "@/components/attendance-checklist";
import { DashboardStatsStrip } from "@/components/dashboard-stats-strip";
import { EmployeeCreateModal } from "@/components/employee-create-modal";
import { PayrollDueTimeline } from "@/components/payroll-due-timeline";
import { requireUser } from "@/lib/auth";
import {
  getAdvanceDeductionForPreview,
  getLedgerDeductionForPreview,
  getLivePayrollAttendanceMetrics
} from "@/lib/payroll-live";
import { describePayrollFrequency, getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { endOfDayLocal, parseDateInputValue, startOfDayLocal, toDateInputValue } from "@/lib/utils";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string; saved?: string; edit?: string; paid?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedDate = params.date ? new Date(params.date) : new Date();
  const today = new Date();
  const dateValue = toDateInputValue(selectedDate);
  const stripStart = startOfDay(subDays(selectedDate, 3));
  const stripEnd = endOfDay(addDays(selectedDate, 3));
  const todayStart = startOfDayLocal(today);
  const user = await requireUser();
  const employees = await prisma.employee.findMany({ where: { shopId: user.shop.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } });
  const employeeIds = employees.map((employee) => employee.id);
  const hasEmployees = employeeIds.length > 0;

  const [employeeCount, absentToday, advancesOpen, records, stripRecords, timelineBonuses, timelineAdvances, timelinePayables] = await Promise.all([
    Promise.resolve(employees.length),
    prisma.attendanceRecord.count({
      where: {
        employee: { shopId: user.shop.id },
        date: { gte: startOfDay(selectedDate), lte: endOfDay(selectedDate) },
        status: "ABSENT"
      }
    }),
    hasEmployees
      ? prisma.advance.aggregate({
          where: { status: "OPEN", employeeId: { in: employeeIds } },
          _sum: { remainingBalance: true }
        })
      : Promise.resolve({ _sum: { remainingBalance: null } }),
    prisma.attendanceRecord.findMany({
      where: {
        employee: { shopId: user.shop.id },
        date: { gte: startOfDay(selectedDate), lte: endOfDay(selectedDate) }
      }
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employee: { shopId: user.shop.id },
        date: { gte: stripStart, lte: stripEnd }
      },
      include: {
        employee: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: [{ date: "asc" }, { employee: { fullName: "asc" } }]
    }),
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
      : Promise.resolve([])
  ]);

  const presentToday = Math.max(employeeCount - absentToday, 0);
  const byEmployee = new Map(records.map((record) => [record.employeeId, record]));
  const hasSavedAttendance = records.length > 0;
  const isEditingAttendance = params.edit === "1";
  const nextPayrollEvents = employees
    .map((employee) => {
      const baseDate = employee.startDate && startOfDayLocal(employee.startDate) > todayStart ? startOfDayLocal(employee.startDate) : todayStart;
      const payDate = getPayDateForDate(baseDate, employee);
      const period = getPeriodForPayDate(payDate, employee);

      return {
        employee,
        payDate,
        period
      };
    })
    .sort((a, b) => a.payDate.getTime() - b.payDate.getTime());

  const upcomingPayDates = Array.from(new Set(nextPayrollEvents.map((event) => toDateInputValue(event.payDate))));
  const recentPaidPeriods = await prisma.payrollPeriod.findMany({
    where: {
      shopId: user.shop.id,
      status: "PAID",
      payDate: {
        gte: startOfDayLocal(subDays(todayStart, 7)),
        lte: endOfDayLocal(todayStart)
      }
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
  });
  const timelineRangeStartCandidates = [
    nextPayrollEvents[0]?.period.periodStart,
    ...recentPaidPeriods.map((period) => period.periodStart)
  ].filter((value): value is Date => Boolean(value));
  const timelineRangeEndCandidates = [
    nextPayrollEvents[nextPayrollEvents.length - 1]?.period.periodEnd,
    ...recentPaidPeriods.map((period) => period.periodEnd)
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
      ...recentPaidPeriods.flatMap((period) => period.payrollEntries.map((entry) => entry.employeeId))
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
  const existingUpcomingPeriods = upcomingPayDates.length
    ? await prisma.payrollPeriod.findMany({
        where: {
          shopId: user.shop.id,
          payDate: {
            gte: startOfDayLocal(todayStart),
            lte: endOfDayLocal(addDays(todayStart, 60))
          }
        },
        select: {
          payDate: true,
          status: true
        }
      })
    : [];
  const periodStatusByDate = new Map<string, string[]>();
  existingUpcomingPeriods.forEach((period) => {
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
    nextPayrollEvents.reduce(
      (groups, event) => {
        const employeeRecords = attendanceByEmployee.get(event.employee.id) ?? [];
        const liveMetrics = getLivePayrollAttendanceMetrics({
          employee: event.employee,
          periodStart: event.period.periodStart,
          periodEnd: event.period.periodEnd,
          attendanceRecords: employeeRecords
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
        const key = payDateKey;
        const dueOffset = differenceInCalendarDays(startOfDayLocal(event.payDate), todayStart);
        const periodStatuses = periodStatusByDate.get(payDateKey) ?? [];
        const isPaid = periodStatuses.length > 0 && periodStatuses.every((status) => status === "PAID");
        const dueLabel = isPaid
          ? "Paid"
          : isToday(event.payDate)
          ? "Today"
          : isTomorrow(event.payDate)
            ? "Due tomorrow"
            : dueOffset > 1
              ? `Due in ${dueOffset} days`
              : format(event.payDate, "EEE");
        const existing = groups.get(key) ?? {
          id: key,
          payDateValue: payDateKey,
          payDateLabel: format(event.payDate, "MMM d, yyyy"),
          dueLabel: isPaid ? "Paid" : dueLabel,
          isPaid,
          expectedTotal: 0,
          employeeNames: [] as string[],
          details: [] as Array<{
            employeeId: string;
            employeeName: string;
            employeeCode: string;
            position: string | null;
            frequencyLabel: string;
            periodLabel: string;
            absentDates: string[];
            halfDayDates: string[];
            daysAbsent: number;
            daysHalf: number;
            estimatedDays: number;
            paidDayUnits: number;
            dailyRate: number;
            grossPay: number;
            bonusesAdded: number;
            advancesDeducted: number;
            payablesDeducted: number;
            expectedAmount: number;
          }>
        };

        existing.expectedTotal += expectedAmount;
        existing.employeeNames.push(event.employee.fullName);
        existing.details.push({
          employeeId: event.employee.id,
          employeeName: event.employee.fullName,
          employeeCode: event.employee.employeeCode,
          position: event.employee.position,
          frequencyLabel: describePayrollFrequency(event.employee),
          periodLabel: event.period.label,
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
        groups.set(key, existing);

        return groups;
      },
      new Map<string, {
        id: string;
        payDateValue: string;
        payDateLabel: string;
        dueLabel: string;
        isPaid: boolean;
        expectedTotal: number;
        employeeNames: string[];
        details: Array<{
          employeeId: string;
          employeeName: string;
          employeeCode: string;
          position: string | null;
          frequencyLabel: string;
          periodLabel: string;
          absentDates: string[];
          halfDayDates: string[];
          daysAbsent: number;
          daysHalf: number;
          estimatedDays: number;
          paidDayUnits: number;
          dailyRate: number;
          grossPay: number;
          bonusesAdded: number;
          advancesDeducted: number;
          payablesDeducted: number;
          expectedAmount: number;
        }>;
      }>()
    ).values()
  );
  const recentPaidTimelineEntries = recentPaidPeriods.map((period) => ({
    id: `paid-${period.id}`,
    payDateValue: toDateInputValue(period.payDate),
    payDateLabel: format(period.payDate, "MMM d, yyyy"),
    dueLabel: "Paid",
    isPaid: true,
    expectedTotal: period.payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0),
    employeeNames: period.payrollEntries.map((entry) => entry.employee.fullName),
    details: period.payrollEntries.map((entry) => {
      const liveMetrics = getLivePayrollAttendanceMetrics({
        employee: entry.employee,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        attendanceRecords: attendanceByEmployee.get(entry.employee.id) ?? []
      });

      return {
        employeeId: entry.employee.id,
        employeeName: entry.employee.fullName,
        employeeCode: entry.employee.employeeCode,
        position: entry.employee.position,
        frequencyLabel: describePayrollFrequency(entry.employee),
        periodLabel: period.label.replace(/^Payroll - /, ""),
        absentDates: liveMetrics.absentDates.map((date) => toDateInputValue(date)),
        halfDayDates: liveMetrics.halfDayDates.map((date) => toDateInputValue(date)),
        daysAbsent: entry.daysAbsent,
        daysHalf: "daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0,
        estimatedDays: entry.daysPresent,
        paidDayUnits: entry.daysPresent + ("daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0) * 0.5,
        dailyRate: Number(entry.employee.dailyRate),
        grossPay: Number(entry.grossPay),
        bonusesAdded: "totalBonusesAdded" in entry ? Number(entry.totalBonusesAdded ?? 0) : 0,
        advancesDeducted: Number(entry.totalAdvancesDeducted),
        payablesDeducted: Number(entry.totalPayablesDeducted),
        expectedAmount: Number(entry.netPay)
      };
    })
  }));
  const mergedTimelineEntries = [...recentPaidTimelineEntries, ...payrollTimelineEntries]
    .filter((entry, index, collection) => collection.findIndex((candidate) => candidate.payDateValue === entry.payDateValue) === index)
    .sort((a, b) => {
      if (a.isPaid !== b.isPaid) {
        return a.isPaid ? -1 : 1;
      }
      return parseDateInputValue(a.payDateValue).getTime() - parseDateInputValue(b.payDateValue).getTime();
    })
    .slice(0, 8);
  const dateSnapshots = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(selectedDate), index - 3);
    const snapshotDateValue = toDateInputValue(date);
    const dayRecords = stripRecords.filter((record) => toDateInputValue(record.date) === snapshotDateValue);
    const absentEmployees = dayRecords
      .filter((record) => record.status === "ABSENT")
      .map((record) => record.employee.fullName.split(" ")[0]);
    const halfDayEmployees = dayRecords
      .filter((record) => String(record.status) === "HALF_DAY")
      .map((record) => record.employee.fullName.split(" ")[0]);
    const summary =
      dayRecords.length === 0
        ? "Not yet saved"
        : absentEmployees.length === 0 && halfDayEmployees.length === 0
          ? "Perfect attendance"
          : [
              absentEmployees.length
                ? `${absentEmployees.length} absent${absentEmployees.length ? `: ${absentEmployees.slice(0, 2).join(", ")}${absentEmployees.length > 2 ? ` +${absentEmployees.length - 2}` : ""}` : ""}`
                : null,
              halfDayEmployees.length
                ? `${halfDayEmployees.length} half day${halfDayEmployees.length > 1 ? "s" : ""}: ${halfDayEmployees.slice(0, 2).join(", ")}${halfDayEmployees.length > 2 ? ` +${halfDayEmployees.length - 2}` : ""}`
                : null
            ]
              .filter(Boolean)
              .join(" • ");

    return {
      dateValue: snapshotDateValue,
      dayLabel: format(date, "EEE"),
      dateLabel: format(date, "d MMM"),
      summary,
      active: snapshotDateValue === dateValue,
      today: isSameDay(date, today)
    };
  });

  return (
    <div>
      {params.saved ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Attendance saved successfully.</div> : null}
      {params.paid ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Payroll marked as paid.</div> : null}
      {params.error === "no-due-payroll" ? <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">No due payroll found for that day.</div> : null}
      {params.error === "attendance-mismatch" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          Attendance changed for that payroll. Open the Payroll page and review the highlighted period before marking it as paid.
        </div>
      ) : null}

      <DashboardStatsStrip
        entries={[
          { label: "Attendance Logged", value: hasSavedAttendance ? "Yes" : "No", icon: "attendance", tone: hasSavedAttendance ? "green" : "red" },
          { label: "Active Employees", value: employeeCount, icon: "employees", tone: "blue" },
          { label: "Present", value: presentToday, icon: "present", tone: "green" },
          { label: "Absent", value: absentToday, icon: "absent", tone: "red" },
          { label: "Open Advances", value: Number(advancesOpen._sum.remainingBalance || 0), icon: "advances", tone: "amber", money: true }
        ]}
      />

      {employeeCount === 0 ? (
        <section className="mt-4 overflow-hidden rounded-[28px] border border-[rgba(232,191,115,0.54)] bg-[linear-gradient(135deg,rgba(250,238,224,0.84)_0%,rgba(245,250,247,0.96)_54%,rgba(255,255,255,0.98)_100%)] shadow-[0_22px_44px_-34px_rgba(108,89,70,0.18)]">
          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.15fr_0.85fr] lg:px-6">
            <div>
              <div className="inline-flex rounded-full border border-[rgba(232,191,115,0.74)] bg-[rgba(255,248,234,0.96)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ab781d]">
                Quick Setup
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-stone-950">Start by adding your first employee.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#786f66]">
                Once your first team member is saved, attendance, advances, and payroll will all have real data to work with.
              </p>
              <div className="mt-5">
                <EmployeeCreateModal />
              </div>
            </div>

            <div className="grid gap-3 self-start">
              <div className="rounded-[22px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.92)] px-4 py-4 text-sm text-stone-700">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Step 1</div>
                <div className="mt-1 font-semibold text-stone-950">Enter employee basics</div>
                <div className="mt-1">Add the name, position, daily rate, and start date.</div>
              </div>
              <div className="rounded-[22px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.92)] px-4 py-4 text-sm text-stone-700">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Step 2</div>
                <div className="mt-1 font-semibold text-stone-950">Save and continue daily tracking</div>
                <div className="mt-1">The app will auto-generate the employee code for this shop and unlock attendance flow.</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-4">
        <AttendanceChecklist
          title={`Attendance for ${selectedDate.toDateString()}`}
          subtitle={
            hasSavedAttendance && !isEditingAttendance
              ? "Attendance for this day is already saved. Indicators are now read-only until you choose to edit."
              : "Everyone starts as present by default. Use Absent or Half Day only when needed, then add notes for exceptions."
          }
          dateValue={dateValue}
          redirectTo="/dashboard"
          hasSavedAttendance={hasSavedAttendance}
          isEditing={isEditingAttendance}
          dateSnapshots={dateSnapshots}
          items={employees.map((employee) => {
            const record = byEmployee.get(employee.id);
            return {
              id: employee.id,
              fullName: employee.fullName,
              position: employee.position,
              status: record?.status ?? "PRESENT",
              remarks: record?.remarks || null
            };
          })}
        />
      </div>

      <div className="mt-4">
        <PayrollDueTimeline entries={mergedTimelineEntries} />
      </div>
    </div>
  );
}
