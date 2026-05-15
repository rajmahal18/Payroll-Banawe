import Link from "next/link";
import { CalendarClock, CheckCheck, Gift, ReceiptText, RotateCcw, Save, Search, WalletCards } from "lucide-react";
import { markPayrollHistoryPaidAction, undoPayrollHistoryPaidAction, updatePayrollEntryAdjustmentsAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { PayrollDueTimeline } from "@/components/payroll-due-timeline";
import { requireUser } from "@/lib/auth";
import { getAdvanceDeductionForPreview, getLedgerDeductionForPreview, getLivePayrollAttendanceMetrics } from "@/lib/payroll-live";
import { getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";
import { getPayrollTimelineEntries } from "@/lib/payroll-timeline";
import { prisma } from "@/lib/prisma";
import { addBusinessDays, endOfDayLocal, formatDate, formatMoney, parseDateInputValue, startOfDayLocal, toDateInputValue } from "@/lib/utils";
import { getShopWorkCalendar } from "@/lib/work-schedule";

const PAGE_SIZE = 10;
const MAX_UNRECORDED_PERIODS_PER_EMPLOYEE = 520;

type PayrollHistoryRow = {
  id: string;
  payDate: Date;
  periodStart: Date;
  periodEnd: Date;
  label: string;
  status: "PAID" | "FINALIZED" | "DRAFT" | "UNRECORDED";
  employeeIds: string[];
  employeeNames: string[];
  employeeCount: number;
  netTotal: number;
  grossTotal: number;
  additions: number;
  deductions: number;
  auditEvents: Array<{
    id: string;
    eventType: string;
    reason: string | null;
    createdAt: Date;
    userName: string | null;
  }>;
  employeeBreakdowns: Array<{
    payrollEntryId: string | null;
    employeeId: string;
    employeeName: string;
    daysPresent: number;
    daysHalf: number;
    daysAbsent: number;
    dailyRate: number;
    grossPay: number;
    additions: number;
    advanceDeductionsTotal: number;
    otherDeductions: number;
    netPay: number;
    advanceDeductions: Array<{
      id: string;
      advanceDate: Date;
      advanceReason: string | null;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
    }>;
  }>;
};

function getPage(value: string | undefined) {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildPayrollHref(params: { tab?: string; historyPage?: number }) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "timeline") query.set("tab", params.tab);
  if (params.historyPage && params.historyPage > 1) query.set("historyPage", String(params.historyPage));

  const value = query.toString();
  return value ? `/payroll?${value}` : "/payroll";
}

function getStatusLabel(status: string) {
  if (status === "PAID") return "Paid";
  if (status === "FINALIZED") return "Ready to pay";
  if (status === "UNRECORDED") return "Not paid";
  return "Not paid";
}

function getStatusClass(status: string) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FINALIZED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "UNRECORDED") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function rowSort(left: PayrollHistoryRow, right: PayrollHistoryRow) {
  const payDateSort = right.payDate.getTime() - left.payDate.getTime();
  if (payDateSort !== 0) return payDateSort;
  return right.periodEnd.getTime() - left.periodEnd.getTime();
}

export default async function PayrollPage({
  searchParams
}: {
  searchParams?: Promise<{ paid?: string; undo?: string; adjusted?: string; error?: string; tab?: string; historyPage?: string; repairDate?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab = params.tab === "history" ? "history" : "timeline";
  const historyPage = getPage(params.historyPage);
  const repairDate = params.repairDate ? startOfDayLocal(parseDateInputValue(params.repairDate)) : null;
  const repairDateValue = repairDate ? toDateInputValue(repairDate) : "";
  const user = await requireUser();
  const todayStart = startOfDayLocal(new Date());
  const workCalendar = await getShopWorkCalendar(user.shop.id);
  const [timelineEntries, persistedHistoryPeriods, activeEmployees] = await Promise.all([
    getPayrollTimelineEntries({ shopId: user.shop.id, limit: 30 }),
    prisma.payrollPeriod.findMany({
      where: { shopId: user.shop.id },
      include: {
        auditEvents: {
          select: {
            id: true,
            eventType: true,
            reason: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 8
        },
        payrollEntries: {
          select: {
            id: true,
            daysPresent: true,
            daysHalf: true,
            daysAbsent: true,
            netPay: true,
            grossPay: true,
            totalBonusesAdded: true,
            totalAdvancesDeducted: true,
            totalPayablesDeducted: true,
            advanceDeductions: {
              select: {
                id: true,
                advanceDate: true,
                advanceReason: true,
                amount: true,
                balanceBefore: true,
                balanceAfter: true
              },
              orderBy: [{ advanceDate: "asc" }, { createdAt: "asc" }]
            },
            employee: {
              select: {
                id: true,
                fullName: true,
                dailyRate: true
              }
            }
          },
          orderBy: {
            employee: {
              fullName: "asc"
            }
          }
        }
      },
      orderBy: [{ payDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.employee.findMany({
      where: { shopId: user.shop.id, status: "ACTIVE" },
      include: {
        attendanceRecords: {
          select: {
            date: true,
            status: true
          }
        },
        advances: {
          where: { status: "OPEN" },
          select: {
            id: true,
            date: true,
            remainingBalance: true,
            deductionPerPayroll: true,
            reason: true
          },
          orderBy: { date: "asc" }
        },
        bonuses: {
          where: { status: "OPEN" },
          select: {
            id: true,
            date: true,
            amount: true,
            reason: true
          },
          orderBy: { date: "asc" }
        },
        payables: {
          where: { status: "OPEN" },
          select: {
            id: true,
            date: true,
            remainingBalance: true,
            type: true,
            remarks: true
          },
          orderBy: { date: "asc" }
        }
      },
      orderBy: { fullName: "asc" }
    }),
  ]);
  const todayValue = toDateInputValue(todayStart);
  const persistedEmployeePeriodKeys = new Set(
    persistedHistoryPeriods.flatMap((period) =>
      period.payrollEntries.map(
        (entry) =>
          `${entry.employee.id}|${toDateInputValue(period.periodStart)}|${toDateInputValue(period.periodEnd)}|${toDateInputValue(period.payDate)}`
      )
    )
  );
  const latestPaidDateByEmployee = new Map<string, Date>();
  const employeesWithOpenPayroll = new Set<string>();
  persistedHistoryPeriods.forEach((period) => {
    period.payrollEntries.forEach((entry) => {
      if (period.status === "PAID") {
        const current = latestPaidDateByEmployee.get(entry.employee.id);
        if (!current || period.payDate > current) {
          latestPaidDateByEmployee.set(entry.employee.id, period.payDate);
        }
      } else {
        employeesWithOpenPayroll.add(entry.employee.id);
      }
    });
  });
  const unrecordedRowsByPeriod = new Map<string, PayrollHistoryRow>();
  const trackingStart = activeEmployees.length
    ? activeEmployees
        .map((employee) => startOfDayLocal(employee.startDate ?? employee.createdAt))
        .reduce((earliest, date) => (date < earliest ? date : earliest))
    : todayStart;

  activeEmployees.forEach((employee) => {
    if (employeesWithOpenPayroll.has(employee.id)) return;

    const employeeStart = startOfDayLocal(employee.startDate ?? employee.createdAt ?? trackingStart);
    const latestPersistedPaidDate = latestPaidDateByEmployee.get(employee.id) ?? null;
    const effectiveLastPaidDate =
      employee.lastPaidDate && latestPersistedPaidDate
        ? employee.lastPaidDate > latestPersistedPaidDate
          ? employee.lastPaidDate
          : latestPersistedPaidDate
        : employee.lastPaidDate ?? latestPersistedPaidDate;
    let cursor = startOfDayLocal(effectiveLastPaidDate ?? employeeStart);
    let scanLastPaidDate = effectiveLastPaidDate ? startOfDayLocal(effectiveLastPaidDate) : null;
    if (cursor < employeeStart) cursor = employeeStart;
    if (cursor < trackingStart) cursor = trackingStart;

    for (let scan = 0; scan < MAX_UNRECORDED_PERIODS_PER_EMPLOYEE; scan += 1) {
      const scanSchedule = { ...employee, lastPaidDate: scanLastPaidDate };
      const payDate = getPayDateForDate(cursor, scanSchedule, workCalendar);
      if (payDate > todayStart) break;

      const period = getPeriodForPayDate(payDate, scanSchedule, workCalendar);
      const employeePeriodKey = `${employee.id}|${toDateInputValue(period.periodStart)}|${toDateInputValue(period.periodEnd)}|${toDateInputValue(payDate)}`;

      if (!persistedEmployeePeriodKeys.has(employeePeriodKey)) {
        const key = `${toDateInputValue(period.periodStart)}|${toDateInputValue(period.periodEnd)}|${toDateInputValue(payDate)}`;
        const metrics = getLivePayrollAttendanceMetrics({
          employee,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          attendanceRecords: employee.attendanceRecords,
          calendar: workCalendar
        });
        const periodCutoff = endOfDayLocal(period.periodEnd);
        const bonuses = employee.bonuses.filter((bonus) => bonus.date <= periodCutoff);
        const additions = bonuses.reduce((total, bonus) => total + Number(bonus.amount), 0);
        const advanceDeductions: PayrollHistoryRow["employeeBreakdowns"][number]["advanceDeductions"] = [];
        let runningNet = metrics.grossPay + additions;
        let advanceDeductionsTotal = 0;
        let otherDeductions = 0;

        for (const advance of employee.advances) {
          if (runningNet <= 0) break;
          if (advance.date > periodCutoff) continue;
          const balanceBefore = Number(advance.remainingBalance);
          const deduction = getAdvanceDeductionForPreview({
            runningNet,
            remainingBalance: balanceBefore,
            deductionPerPayroll: advance.deductionPerPayroll == null ? null : Number(advance.deductionPerPayroll)
          });

          if (deduction > 0) {
            runningNet -= deduction;
            advanceDeductionsTotal += deduction;
            advanceDeductions.push({
              id: `preview-${employee.id}-${advance.id}-${toDateInputValue(payDate)}`,
              advanceDate: advance.date,
              advanceReason: advance.reason,
              amount: deduction,
              balanceBefore,
              balanceAfter: balanceBefore - deduction
            });
          }
        }

        for (const payable of employee.payables) {
          if (runningNet <= 0) break;
          if (payable.date > periodCutoff) continue;
          const deduction = getLedgerDeductionForPreview(runningNet, Number(payable.remainingBalance));

          if (deduction > 0) {
            runningNet -= deduction;
            otherDeductions += deduction;
          }
        }

        const existing = unrecordedRowsByPeriod.get(key) ?? {
          id: `unrecorded-${key}`,
          payDate,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          label: period.label,
          status: "UNRECORDED" as const,
          employeeIds: [],
          employeeNames: [],
          employeeCount: 0,
          netTotal: 0,
          grossTotal: 0,
          additions: 0,
          deductions: 0,
          auditEvents: [],
          employeeBreakdowns: []
        };

        existing.employeeIds.push(employee.id);
        existing.employeeNames.push(employee.fullName);
        existing.employeeCount += 1;
        existing.netTotal += runningNet;
        existing.grossTotal += metrics.grossPay;
        existing.additions += additions;
        existing.deductions += advanceDeductionsTotal + otherDeductions;
        existing.employeeBreakdowns.push({
          payrollEntryId: null,
          employeeId: employee.id,
          employeeName: employee.fullName,
          daysPresent: metrics.daysPresent,
          daysHalf: metrics.daysHalf,
          daysAbsent: metrics.daysAbsent,
          dailyRate: Number(employee.dailyRate),
          grossPay: metrics.grossPay,
          additions,
          advanceDeductionsTotal,
          otherDeductions,
          netPay: runningNet,
          advanceDeductions
        });
        unrecordedRowsByPeriod.set(key, existing);
      }

      scanLastPaidDate = payDate;
      cursor = addBusinessDays(payDate, 1);
    }
  });

  if (repairDate && repairDate <= todayStart) {
    activeEmployees.forEach((employee) => {
      if (employeesWithOpenPayroll.has(employee.id)) return;

      const repairSchedule = { ...employee, lastPaidDate: null };
      const repairPayDate = getPayDateForDate(repairDate, repairSchedule, workCalendar);
      if (toDateInputValue(repairPayDate) !== repairDateValue) return;

      const period = getPeriodForPayDate(repairDate, repairSchedule, workCalendar);
      const employeePeriodKey = `${employee.id}|${toDateInputValue(period.periodStart)}|${toDateInputValue(period.periodEnd)}|${repairDateValue}`;
      if (persistedEmployeePeriodKeys.has(employeePeriodKey)) return;

      const key = `${toDateInputValue(period.periodStart)}|${toDateInputValue(period.periodEnd)}|${repairDateValue}`;
      const metrics = getLivePayrollAttendanceMetrics({
        employee,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        attendanceRecords: employee.attendanceRecords,
        calendar: workCalendar
      });
      const periodCutoff = endOfDayLocal(period.periodEnd);
      const bonuses = employee.bonuses.filter((bonus) => bonus.date <= periodCutoff);
      const additions = bonuses.reduce((total, bonus) => total + Number(bonus.amount), 0);
      const advanceDeductions: PayrollHistoryRow["employeeBreakdowns"][number]["advanceDeductions"] = [];
      let runningNet = metrics.grossPay + additions;
      let advanceDeductionsTotal = 0;
      let otherDeductions = 0;

      for (const advance of employee.advances) {
        if (runningNet <= 0) break;
        if (advance.date > periodCutoff) continue;
        const balanceBefore = Number(advance.remainingBalance);
        const deduction = getAdvanceDeductionForPreview({
          runningNet,
          remainingBalance: balanceBefore,
          deductionPerPayroll: advance.deductionPerPayroll == null ? null : Number(advance.deductionPerPayroll)
        });

        if (deduction > 0) {
          runningNet -= deduction;
          advanceDeductionsTotal += deduction;
          advanceDeductions.push({
            id: `repair-${employee.id}-${advance.id}-${repairDateValue}`,
            advanceDate: advance.date,
            advanceReason: advance.reason,
            amount: deduction,
            balanceBefore,
            balanceAfter: balanceBefore - deduction
          });
        }
      }

      for (const payable of employee.payables) {
        if (runningNet <= 0) break;
        if (payable.date > periodCutoff) continue;
        const deduction = getLedgerDeductionForPreview(runningNet, Number(payable.remainingBalance));

        if (deduction > 0) {
          runningNet -= deduction;
          otherDeductions += deduction;
        }
      }

      const existing = unrecordedRowsByPeriod.get(key) ?? {
        id: `unrecorded-${key}`,
        payDate: repairDate,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        label: period.label,
        status: "UNRECORDED" as const,
        employeeIds: [],
        employeeNames: [],
        employeeCount: 0,
        netTotal: 0,
        grossTotal: 0,
        additions: 0,
        deductions: 0,
        auditEvents: [],
        employeeBreakdowns: []
      };

      if (existing.employeeIds.includes(employee.id)) return;
      existing.employeeIds.push(employee.id);
      existing.employeeNames.push(employee.fullName);
      existing.employeeCount += 1;
      existing.netTotal += runningNet;
      existing.grossTotal += metrics.grossPay;
      existing.additions += additions;
      existing.deductions += advanceDeductionsTotal + otherDeductions;
      existing.employeeBreakdowns.push({
        payrollEntryId: null,
        employeeId: employee.id,
        employeeName: employee.fullName,
        daysPresent: metrics.daysPresent,
        daysHalf: metrics.daysHalf,
        daysAbsent: metrics.daysAbsent,
        dailyRate: Number(employee.dailyRate),
        grossPay: metrics.grossPay,
        additions,
        advanceDeductionsTotal,
        otherDeductions,
        netPay: runningNet,
        advanceDeductions
      });
      unrecordedRowsByPeriod.set(key, existing);
    });
  }

  const persistedRows: PayrollHistoryRow[] = persistedHistoryPeriods.map((period) => {
    const employeeIds = period.payrollEntries.map((entry) => entry.employee.id);
    const employeeNames = period.payrollEntries.map((entry) => entry.employee.fullName);
    const netTotal = period.payrollEntries.reduce((total, entry) => total + Number(entry.netPay), 0);
    const grossTotal = period.payrollEntries.reduce((total, entry) => total + Number(entry.grossPay), 0);
    const additions = period.payrollEntries.reduce((total, entry) => total + Number(entry.totalBonusesAdded), 0);
    const deductions = period.payrollEntries.reduce(
      (total, entry) => total + Number(entry.totalAdvancesDeducted) + Number(entry.totalPayablesDeducted),
      0
    );
    const employeeBreakdowns = period.payrollEntries.map((entry) => ({
      payrollEntryId: entry.id,
      employeeId: entry.employee.id,
      employeeName: entry.employee.fullName,
      daysPresent: entry.daysPresent,
      daysHalf: entry.daysHalf,
      daysAbsent: entry.daysAbsent,
      dailyRate: Number(entry.employee.dailyRate),
      grossPay: Number(entry.grossPay),
      additions: Number(entry.totalBonusesAdded),
      advanceDeductionsTotal: Number(entry.totalAdvancesDeducted),
      otherDeductions: Number(entry.totalPayablesDeducted),
      netPay: Number(entry.netPay),
      advanceDeductions: entry.advanceDeductions.map((deduction) => ({
        id: deduction.id,
        advanceDate: deduction.advanceDate,
        advanceReason: deduction.advanceReason,
        amount: Number(deduction.amount),
        balanceBefore: Number(deduction.balanceBefore),
        balanceAfter: Number(deduction.balanceAfter)
      }))
    }));
    const auditEvents = period.auditEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      reason: event.reason,
      createdAt: event.createdAt,
      userName: event.user?.name || event.user?.email || null
    }));

    return {
      id: period.id,
      payDate: period.payDate,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      label: period.label.replace(/^Payroll - /, ""),
      status: period.status,
      employeeIds,
      employeeNames,
      employeeCount: period.payrollEntries.length,
      netTotal,
      grossTotal,
      additions,
      deductions,
      auditEvents,
      employeeBreakdowns
    };
  });
  const historyRows = [...persistedRows, ...Array.from(unrecordedRowsByPeriod.values())].sort(rowSort);
  const historyTotal = historyRows.length;
  const historyPeriods = historyRows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);
  const paidHistoryCount = historyRows.filter((row) => row.status === "PAID").length;
  const unpaidHistoryCount = historyRows.filter((row) => row.status !== "PAID").length;
  const totalPaidAmount = historyRows.filter((row) => row.status === "PAID").reduce((total, row) => total + row.netTotal, 0);
  const totalUnpaidAmount = historyRows.filter((row) => row.status !== "PAID").reduce((total, row) => total + row.netTotal, 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={
          activeTab === "history"
            ? "Check every payroll batch by date, status, headcount, and payout amount."
            : "Review sahod days, open the full breakdown, then mark payroll as paid from one timeline."
        }
        action={
          <Link
            href="/advances?tab=bonuses"
            className="secondary-action"
          >
            <Gift className="h-4 w-4 text-[#2f7d5b]" />
            Record Bonus
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-[rgba(121,150,118,0.24)] bg-white p-1 shadow-sm">
        <a
          href={buildPayrollHref({ tab: "timeline" })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "timeline" ? "bg-[#e7f3e7] text-[#176b4d]" : "text-stone-600 hover:bg-[#f5f8f2]"
          }`}
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="truncate">Timeline</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{timelineEntries.length}</span>
        </a>
        <a
          href={buildPayrollHref({ tab: "history" })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "history" ? "bg-amber-50 text-amber-700" : "text-stone-600 hover:bg-[#f5f8f2]"
          }`}
        >
          <ReceiptText className="h-4 w-4 shrink-0" />
          <span className="truncate">Payment History</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{historyTotal}</span>
        </a>
      </div>

      {params.paid ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll marked as paid.</div> : null}
      {params.undo ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Paid status undone. Payroll is ready to review again.</div> : null}
      {params.adjusted ? <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-700">Payroll adjustments saved.</div> : null}
      {params.error === "no-due-payroll" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          No due payroll found for that day.
        </div>
      ) : null}
      {params.error === "attendance-mismatch" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          Attendance changed for that payroll. Review the highlighted sahod day before marking it as paid.
        </div>
      ) : null}

      {activeTab === "history" ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[rgba(148,190,139,0.35)] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">Payment History</h2>
                <p className="mt-1 text-sm text-[#7a7168]">Database-style payroll records with clear paid and unpaid states.</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    <CheckCheck className="h-3.5 w-3.5" />
                    {paidHistoryCount} Paid
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                    <WalletCards className="h-3.5 w-3.5" />
                    {unpaidHistoryCount} Not paid
                  </span>
                </div>
                <form action="/payroll" className="grid gap-2 sm:grid-cols-[auto_140px_auto] sm:items-center">
                  <input type="hidden" name="tab" value="history" />
                  <div className="text-xs font-medium text-[#66746a]">Repair past date</div>
                  <input name="repairDate" type="date" defaultValue={repairDateValue} className="h-9 py-1.5 text-xs" />
                  <button className="secondary-action h-9 px-3 text-xs">
                    <Search className="h-3.5 w-3.5" />
                    Find
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="grid gap-2 border-b border-[rgba(121,150,118,0.22)] bg-[#fbfdf9] px-4 py-3 text-sm sm:grid-cols-2 sm:px-5">
            <div className="text-[#66746a]">Paid total <span className="font-semibold text-stone-950">{formatMoney(totalPaidAmount)}</span></div>
            <div className="text-[#66746a] sm:text-right">Unpaid total <span className="font-semibold text-stone-950">{formatMoney(totalUnpaidAmount)}</span></div>
          </div>

          <div className="hidden grid-cols-[140px_1fr_110px_130px_130px] gap-3 border-b border-[rgba(121,150,118,0.22)] bg-[#f8fbf6] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66746a] lg:grid">
            <div>Pay Date</div>
            <div>Period</div>
            <div>Status</div>
            <div>Employees</div>
            <div className="text-right">Net Payout</div>
          </div>

          <div className="divide-y divide-[rgba(148,190,139,0.28)]">
            {historyPeriods.length ? (
              historyPeriods.map((period) => {
                const canPay = period.status !== "PAID" && period.employeeIds.length > 0;
                const canUndoPaid = period.status === "PAID" && !period.id.startsWith("unrecorded-");

                return (
                  <details key={period.id} className="note-toggle group">
                    <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 text-sm transition hover:bg-[#f8fbf6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[rgba(23,107,77,0.14)] lg:grid-cols-[140px_1fr_110px_130px_130px] lg:items-center lg:px-5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73] lg:hidden">Pay Date</div>
                        <div className="mt-1 font-semibold text-stone-950 lg:mt-0">{formatDate(period.payDate)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73] lg:hidden">Period</div>
                        <div className="mt-1 font-semibold text-stone-950 lg:mt-0">{period.label}</div>
                        <div className="mt-1 text-xs text-[#7a7168]">
                          {formatDate(period.periodStart)} to {formatDate(period.periodEnd)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73] lg:hidden">Status</div>
                        <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold lg:mt-0 ${getStatusClass(period.status)}`}>
                          {getStatusLabel(period.status)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73] lg:hidden">Employees</div>
                        <div className="mt-1 font-semibold text-stone-950 lg:mt-0">
                          {period.employeeCount} employee{period.employeeCount !== 1 ? "s" : ""}
                        </div>
                        <div className="mt-1 truncate text-xs text-[#7a7168]">{period.employeeNames.length ? period.employeeNames.join(", ") : "No entries yet"}</div>
                      </div>
                      <div className="min-w-0 lg:text-right">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73] lg:hidden">Net Payout</div>
                        <div className="mt-1 font-semibold text-stone-950 lg:mt-0">{formatMoney(period.netTotal)}</div>
                        <div className="mt-1 text-xs text-[#7a7168]">
                          Gross {formatMoney(period.grossTotal)} / +{formatMoney(period.additions)} / -{formatMoney(period.deductions)}
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-[rgba(121,150,118,0.18)] bg-[#fbfdf9] px-4 py-4 sm:px-5">
                      <div className="grid gap-2 text-sm sm:grid-cols-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Gross</div>
                          <div className="mt-1 font-semibold text-stone-950">{formatMoney(period.grossTotal)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Additions</div>
                          <div className="mt-1 font-semibold text-emerald-700">+{formatMoney(period.additions)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Deductions</div>
                          <div className="mt-1 font-semibold text-[#9a5b05]">-{formatMoney(period.deductions)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Net</div>
                          <div className="mt-1 font-semibold text-[#2d6258]">{formatMoney(period.netTotal)}</div>
                        </div>
                      </div>

                      {period.employeeBreakdowns.length ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(121,150,118,0.24)] bg-white">
                          <div className="grid gap-2 border-b border-[rgba(121,150,118,0.18)] bg-[#f8fbf6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66746a] sm:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(90px,1fr))]">
                            <div>Employee</div>
                            <div>Gross</div>
                            <div>Additions</div>
                            <div>Deductions</div>
                            <div>Net</div>
                          </div>
                          <div className="divide-y divide-[rgba(148,190,139,0.20)]">
                            {period.employeeBreakdowns.map((employee) => {
                              const deductionTotal = employee.advanceDeductionsTotal + employee.otherDeductions;
                              const canEditAdjustments = period.status !== "PAID" && Boolean(employee.payrollEntryId);

                              return (
                                <div key={employee.employeeId} className="px-3 py-3">
                                  <div className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(90px,1fr))] sm:items-start">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-stone-950">{employee.employeeName}</div>
                                      <div className="mt-1 text-xs text-[#7a7168]">
                                        {employee.daysPresent} present, {employee.daysHalf} half, {employee.daysAbsent} absent
                                      </div>
                                    </div>

                                    <details className="note-toggle rounded-xl border border-stone-200 bg-white">
                                      <summary className="cursor-pointer list-none px-3 py-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a7f73] sm:hidden">Gross</div>
                                        <div className="font-semibold text-stone-950">{formatMoney(employee.grossPay)}</div>
                                      </summary>
                                      <div className="border-t border-stone-200 px-3 py-2 text-xs leading-5 text-[#7a7168]">
                                        {employee.daysPresent + employee.daysHalf * 0.5} paid day equivalent x {formatMoney(employee.dailyRate)} daily rate.
                                      </div>
                                    </details>

                                    <details className="note-toggle rounded-xl border border-emerald-200 bg-emerald-50/60">
                                      <summary className="cursor-pointer list-none px-3 py-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 sm:hidden">Additions</div>
                                        <div className="font-semibold text-emerald-700">+{formatMoney(employee.additions)}</div>
                                      </summary>
                                      <div className="border-t border-emerald-200 px-3 py-2 text-xs leading-5 text-emerald-800">
                                        {employee.additions > 0
                                          ? "Bonus/addition total included in this payroll."
                                          : "No additions recorded for this employee in this payroll."}
                                        {canEditAdjustments ? <div className="mt-1 text-[11px] font-semibold">Editable below while payroll is unpaid.</div> : null}
                                      </div>
                                    </details>

                                    <details className="note-toggle rounded-xl border border-amber-200 bg-amber-50/70">
                                      <summary className="cursor-pointer list-none px-3 py-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a5b05] sm:hidden">Deductions</div>
                                        <div className="font-semibold text-[#9a5b05]">-{formatMoney(deductionTotal)}</div>
                                      </summary>
                                      <div className="border-t border-amber-200 px-3 py-2 text-xs leading-5 text-[#7a7168]">
                                        <div className="font-semibold text-stone-950">Advances: -{formatMoney(employee.advanceDeductionsTotal)}</div>
                                        {employee.advanceDeductions.length ? (
                                          <div className="mt-2 grid gap-1.5">
                                            {employee.advanceDeductions.map((deduction) => (
                                              <div key={deduction.id} className="rounded-xl bg-white/75 px-2 py-1.5">
                                                <div className="font-semibold text-stone-950">
                                                  {formatDate(deduction.advanceDate)}: -{formatMoney(deduction.amount)}
                                                </div>
                                                <div>
                                                  {formatMoney(deduction.balanceBefore)} to {formatMoney(deduction.balanceAfter)}
                                                  {deduction.advanceReason ? ` / ${deduction.advanceReason}` : ""}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : employee.advanceDeductionsTotal > 0 ? (
                                          <div className="mt-2 rounded-xl bg-orange-100 px-2 py-1.5 text-orange-800">
                                            This has an advance deduction total but no per-advance audit rows, likely from before lookback was added.
                                          </div>
                                        ) : (
                                          <div className="mt-1">No advance deductions.</div>
                                        )}
                                        <div className="mt-2 font-semibold text-stone-950">Other deductions: -{formatMoney(employee.otherDeductions)}</div>
                                        {canEditAdjustments ? (
                                          <div className="mt-2 rounded-xl bg-white/80 px-2 py-1.5 text-[11px] text-[#7a7168]">
                                            Advance deductions are locked to the advance ledger. Edit only non-advance deductions here.
                                          </div>
                                        ) : null}
                                      </div>
                                    </details>

                                    <div className="rounded-xl border border-[rgba(160,205,190,0.9)] bg-[rgba(236,247,243,0.96)] px-3 py-2 font-semibold text-[#2d6258]">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5f8f85] sm:hidden">Net</div>
                                      {formatMoney(employee.netPay)}
                                    </div>
                                  </div>
                                  {canEditAdjustments ? (
                                    <form
                                      action={updatePayrollEntryAdjustmentsAction}
                                      className="mt-3 grid gap-2 rounded-xl border border-[rgba(121,150,118,0.22)] bg-[#fbfdf9] p-3 text-xs sm:grid-cols-[120px_120px_minmax(0,1fr)_auto] sm:items-end"
                                    >
                                      <input type="hidden" name="payrollEntryId" value={employee.payrollEntryId ?? ""} />
                                      <label className="grid gap-1 font-semibold text-[#66746a]">
                                        Additions
                                        <input
                                          name="bonusesAdded"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          defaultValue={employee.additions.toFixed(2)}
                                          className="h-9 py-1.5 text-xs"
                                        />
                                      </label>
                                      <label className="grid gap-1 font-semibold text-[#66746a]">
                                        Other deductions
                                        <input
                                          name="otherDeductions"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          defaultValue={employee.otherDeductions.toFixed(2)}
                                          className="h-9 py-1.5 text-xs"
                                        />
                                      </label>
                                      <label className="grid gap-1 font-semibold text-[#66746a]">
                                        Reason
                                        <input name="reason" placeholder="Optional audit note" className="h-9 py-1.5 text-xs" />
                                      </label>
                                      <button className="secondary-action h-9 px-3 text-xs">
                                        <Save className="h-3.5 w-3.5" />
                                        Save
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[18px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                          No per-employee payroll entries yet. Use Mark as Paid to create the payroll entries and apply the displayed period.
                        </div>
                      )}
                      {period.auditEvents.length ? (
                        <details className="note-toggle mt-4 rounded-xl border border-[rgba(121,150,118,0.24)] bg-white">
                          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-stone-800">
                            Activity log
                          </summary>
                          <div className="divide-y divide-[rgba(121,150,118,0.16)] border-t border-[rgba(121,150,118,0.18)]">
                            {period.auditEvents.map((event) => (
                              <div key={event.id} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[150px_minmax(0,1fr)_160px]">
                                <div className="font-semibold text-stone-950">{event.eventType.replace(/_/g, " ")}</div>
                                <div className="text-[#66746a]">{event.reason || "No reason added"}</div>
                                <div className="text-[#66746a] sm:text-right">
                                  {formatDate(event.createdAt)}
                                  {event.userName ? ` / ${event.userName}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        {canPay ? (
                          <form action={markPayrollHistoryPaidAction}>
                            <input type="hidden" name="payDate" value={toDateInputValue(period.payDate)} />
                            <input type="hidden" name="periodStart" value={toDateInputValue(period.periodStart)} />
                            <input type="hidden" name="periodEnd" value={toDateInputValue(period.periodEnd)} />
                            <input type="hidden" name="employeeIds" value={period.employeeIds.join(",")} />
                            <button className="primary-action">
                              <CheckCheck className="h-4 w-4" />
                              Mark as Paid
                            </button>
                          </form>
                        ) : null}
                        {canUndoPaid ? (
                          <form action={undoPayrollHistoryPaidAction} className="grid gap-2 sm:grid-cols-[220px_auto]">
                            <input type="hidden" name="payrollPeriodId" value={period.id} />
                            <input name="reason" placeholder="Reason for reopening" className="h-10 py-2 text-xs" />
                            <button className="secondary-action text-amber-700 hover:text-amber-800" title="Move this payroll back to ready-to-pay without deleting its entries or deduction history.">
                              <RotateCcw className="h-4 w-4" />
                              Reopen payroll
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </details>
                );
              })
            ) : (
              <div className="px-5 py-8 text-sm text-[#7a7168]">No payroll records yet. Generated payroll will appear here.</div>
            )}
          </div>

          <div className="px-4 pb-4 sm:px-5">
            <PaginationControls
              pathname="/payroll"
              params={{ tab: "history", historyPage }}
              pageParam="historyPage"
              page={historyPage}
              total={historyTotal}
              pageSize={PAGE_SIZE}
            />
          </div>
        </section>
      ) : (
        <PayrollDueTimeline entries={timelineEntries} todayValue={todayValue} mode="full" />
      )}
    </div>
  );
}
