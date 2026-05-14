import Link from "next/link";
import { CalendarClock, CheckCheck, Gift, ReceiptText, WalletCards } from "lucide-react";
import { markPayrollHistoryPaidAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { PayrollDueTimeline } from "@/components/payroll-due-timeline";
import { requireUser } from "@/lib/auth";
import { getLivePayrollAttendanceMetrics } from "@/lib/payroll-live";
import { getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";
import { getPayrollTimelineEntries } from "@/lib/payroll-timeline";
import { prisma } from "@/lib/prisma";
import { addBusinessDays, formatDate, formatMoney, startOfDayLocal, toDateInputValue } from "@/lib/utils";
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
  searchParams?: Promise<{ paid?: string; error?: string; tab?: string; historyPage?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab = params.tab === "history" ? "history" : "timeline";
  const historyPage = getPage(params.historyPage);
  const user = await requireUser();
  const todayStart = startOfDayLocal(new Date());
  const workCalendar = await getShopWorkCalendar(user.shop.id);
  const [timelineEntries, persistedHistoryPeriods, activeEmployees] = await Promise.all([
    getPayrollTimelineEntries({ shopId: user.shop.id, limit: 30 }),
    prisma.payrollPeriod.findMany({
      where: { shopId: user.shop.id },
      include: {
        payrollEntries: {
          select: {
            netPay: true,
            grossPay: true,
            totalBonusesAdded: true,
            totalAdvancesDeducted: true,
            totalPayablesDeducted: true,
            employee: {
              select: {
                id: true,
                fullName: true
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
  const unrecordedRowsByPeriod = new Map<string, PayrollHistoryRow>();
  const trackingStart = activeEmployees.length
    ? activeEmployees
        .map((employee) => startOfDayLocal(employee.startDate ?? employee.createdAt))
        .reduce((earliest, date) => (date < earliest ? date : earliest))
    : todayStart;

  activeEmployees.forEach((employee) => {
    const employeeStart = startOfDayLocal(employee.startDate ?? employee.createdAt ?? trackingStart);
    let cursor = startOfDayLocal(employee.lastPaidDate ?? employeeStart);
    let scanLastPaidDate = employee.lastPaidDate ? startOfDayLocal(employee.lastPaidDate) : null;
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
          deductions: 0
        };

        existing.employeeIds.push(employee.id);
        existing.employeeNames.push(employee.fullName);
        existing.employeeCount += 1;
        existing.netTotal += metrics.grossPay;
        existing.grossTotal += metrics.grossPay;
        unrecordedRowsByPeriod.set(key, existing);
      }

      scanLastPaidDate = payDate;
      cursor = addBusinessDays(payDate, 1);
    }
  });
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
      deductions
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
            className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.95)] px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-white hover:text-stone-950"
          >
            <Gift className="h-4 w-4 text-[#2f7d5b]" />
            Record Bonus
          </Link>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-[22px] border border-[rgba(88,150,88,0.30)] bg-[rgba(250,255,247,0.86)] p-2">
        <a
          href={buildPayrollHref({ tab: "timeline" })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "timeline" ? "bg-[#e2f2d9] text-[#2f7d5b] shadow-sm" : "text-stone-600 hover:bg-white/70"
          }`}
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="truncate">Timeline</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{timelineEntries.length}</span>
        </a>
        <a
          href={buildPayrollHref({ tab: "history" })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "history" ? "bg-[#fff1cf] text-[#9a5b05] shadow-sm" : "text-stone-600 hover:bg-white/70"
          }`}
        >
          <ReceiptText className="h-4 w-4 shrink-0" />
          <span className="truncate">Payment History</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{historyTotal}</span>
        </a>
      </div>

      {params.paid ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll marked as paid.</div> : null}
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
            </div>
          </div>

          <div className="grid gap-2 border-b border-[rgba(148,190,139,0.28)] px-4 py-3 sm:grid-cols-2 sm:px-5">
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                <CheckCheck className="h-4 w-4" />
                Total Paid
              </div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{formatMoney(totalPaidAmount)}</div>
              <div className="mt-1 text-xs text-emerald-700">{paidHistoryCount} paid payroll record{paidHistoryCount !== 1 ? "s" : ""}</div>
            </div>
            <div className="rounded-[20px] border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                <WalletCards className="h-4 w-4" />
                Total Unpaid
              </div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{formatMoney(totalUnpaidAmount)}</div>
              <div className="mt-1 text-xs text-orange-700">{unpaidHistoryCount} unpaid payroll record{unpaidHistoryCount !== 1 ? "s" : ""}</div>
            </div>
          </div>

          <div className="hidden grid-cols-[150px_1fr_120px_150px_140px] gap-3 border-b border-[rgba(148,190,139,0.28)] bg-[rgba(225,243,219,0.72)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f6f45] lg:grid">
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

                return (
                  <details key={period.id} className="note-toggle group">
                    <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 text-sm transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[rgba(245,158,11,0.24)] lg:grid-cols-[150px_1fr_120px_150px_140px] lg:items-center lg:px-5">
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

                    <div className="border-t border-[rgba(148,190,139,0.18)] bg-white/45 px-4 py-4 sm:px-5">
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
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
                      </div>
                      <div className="mt-3 text-xs leading-5 text-[#7a7168]">{period.employeeNames.join(", ")}</div>
                      {canPay ? (
                        <form action={markPayrollHistoryPaidAction} className="mt-4">
                          <input type="hidden" name="payDate" value={toDateInputValue(period.payDate)} />
                          <input type="hidden" name="periodStart" value={toDateInputValue(period.periodStart)} />
                          <input type="hidden" name="periodEnd" value={toDateInputValue(period.periodEnd)} />
                          <input type="hidden" name="employeeIds" value={period.employeeIds.join(",")} />
                          <button className="inline-flex items-center gap-2 rounded-2xl bg-[#0f766e] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0b5f59]">
                            <CheckCheck className="h-4 w-4" />
                            Mark as Paid
                          </button>
                        </form>
                      ) : null}
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
