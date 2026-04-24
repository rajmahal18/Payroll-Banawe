import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { finalizePayrollAction, generatePayrollForDateAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getLivePayrollAttendanceMetrics } from "@/lib/payroll-live";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export default async function PayrollPage({
  searchParams
}: {
  searchParams?: Promise<{ payDate?: string; generated?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedPayDate = params.payDate ? new Date(params.payDate) : new Date();
  const user = await requireUser();

  const periods = await prisma.payrollPeriod.findMany({
    where: { shopId: user.shop.id },
    include: {
      payrollEntries: {
        include: { employee: true },
        orderBy: { employee: { fullName: "asc" } }
      }
    },
    orderBy: { payDate: "desc" },
    take: 10
  });
  const employeeIds = Array.from(new Set(periods.flatMap((period) => period.payrollEntries.map((entry) => entry.employee.id))));
  const rangeStart = periods.reduce<Date | null>(
    (min, period) => (min == null || period.periodStart < min ? period.periodStart : min),
    null
  );
  const rangeEnd = periods.reduce<Date | null>(
    (max, period) => (max == null || period.periodEnd > max ? period.periodEnd : max),
    null
  );
  const attendanceRecords =
    employeeIds.length && rangeStart && rangeEnd
      ? await prisma.attendanceRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: {
              gte: rangeStart,
              lte: rangeEnd
            }
          },
          select: {
            employeeId: true,
            date: true,
            status: true
          }
        })
      : [];
  const attendanceByEmployee = new Map<string, typeof attendanceRecords>();
  for (const employeeId of employeeIds) {
    attendanceByEmployee.set(
      employeeId,
      attendanceRecords.filter((record) => record.employeeId === employeeId)
    );
  }
  const periodsWithLiveAttendance = periods.map((period) => {
    const liveEntries = period.payrollEntries.map((entry) => {
      const liveMetrics = getLivePayrollAttendanceMetrics({
        employee: entry.employee,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        attendanceRecords: attendanceByEmployee.get(entry.employee.id) ?? []
      });
      const attendanceChanged =
        liveMetrics.daysPresent !== entry.daysPresent ||
        liveMetrics.daysHalf !== ("daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0) ||
        liveMetrics.daysAbsent !== entry.daysAbsent;

      return {
        entry,
        liveMetrics,
        attendanceChanged
      };
    });

    return {
      ...period,
      liveEntries,
      hasAttendanceMismatch: liveEntries.some((liveEntry) => liveEntry.attendanceChanged),
      savedNetTotal: period.payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0),
      liveGrossTotal: liveEntries.reduce((sum, liveEntry) => sum + liveEntry.liveMetrics.grossPay, 0)
    };
  });

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Generate payroll for a chosen pay date. Each employee is included only when their own payroll schedule is due."
        action={
          <Link
            href="/bonuses"
            className="inline-flex items-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.95)] px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-white hover:text-stone-950"
          >
            Record Bonus
          </Link>
        }
      />

      {params.generated ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll generated successfully.</div> : null}
      {params.error === "no-due-employees" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          No active employees are scheduled for payroll on that date.
        </div>
      ) : null}
      {params.error === "attendance-mismatch" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          Current attendance no longer matches the saved payroll entries. Review the highlighted payroll before finalizing or paying it.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Generate Payroll</h2>
          <form action={generatePayrollForDateAction} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pay date</label>
              <input name="targetDate" type="date" defaultValue={toDateInputValue(selectedPayDate)} required />
            </div>
            <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Generate Payroll</button>
          </form>

        </section>

        <section className="space-y-4">
          <div className="rounded-[24px] border border-[rgba(88,150,88,0.30)] bg-[rgba(250,255,247,0.88)] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7f73]">Snapshots</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">Previous payroll runs</h2>
            <p className="mt-1 text-sm text-[#7a7168]">Open any snapshot to review the saved payout, current attendance check, and employee-level totals.</p>
          </div>

          {periodsWithLiveAttendance.map((period) => {
            return (
              <details key={period.id} className="panel overflow-hidden group">
                <summary className="list-none cursor-pointer px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[rgba(229,245,224,0.92)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">
                          {period.status}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                            period.hasAttendanceMismatch
                              ? "bg-lime-50 text-lime-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {period.hasAttendanceMismatch ? "Needs Review" : "Attendance Aligned"}
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-stone-950">{period.label.replace(/^Payroll - /, "")}</h2>
                      <div className="mt-3 grid gap-2 text-sm text-[#7a7168] sm:grid-cols-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Pay Date</div>
                          <div className="mt-1 font-medium text-stone-950">{formatDate(period.payDate)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Saved Payout</div>
                          <div className="mt-1 font-medium text-stone-950">{formatMoney(period.savedNetTotal)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Employees</div>
                          <div className="mt-1 font-medium text-stone-950">{period.payrollEntries.length}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {period.status === "DRAFT" ? (
                        <form action={finalizePayrollAction}>
                          <input type="hidden" name="payrollPeriodId" value={period.id} />
                          <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Finalize
                          </button>
                        </form>
                      ) : null}
                      <span className="inline-flex rounded-2xl border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.95)] px-3 py-2 text-sm font-semibold text-stone-700 transition group-open:bg-[rgba(239,248,241,0.92)]">
                        {period.status === "DRAFT" ? "Open Snapshot" : "View Snapshot"}
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-[rgba(148,190,139,0.36)] px-4 py-4 sm:px-5">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      period.hasAttendanceMismatch
                        ? "border border-lime-200 bg-lime-50 text-lime-800"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {period.hasAttendanceMismatch
                      ? "Attendance changed after this payroll was generated. Review these live figures before releasing payout."
                      : "Current attendance still matches this saved payroll snapshot."}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {period.liveEntries.map(({ entry, liveMetrics, attendanceChanged }) => (
                      <div
                        key={entry.id}
                        className="rounded-[22px] border border-[rgba(148,190,139,0.36)] bg-[rgba(250,255,247,0.92)] px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-950">{entry.employee.fullName}</div>
                            <div className="mt-1 text-sm text-[#7a7168]">{entry.employee.position || "No position"}</div>
                            <div
                              className={`mt-2 text-xs font-medium ${
                                attendanceChanged ? "text-lime-700" : "text-emerald-700"
                              }`}
                            >
                              {attendanceChanged
                                ? `Saved: ${entry.daysPresent} present, ${"daysHalf" in entry ? Number(entry.daysHalf ?? 0) : 0} half day, ${entry.daysAbsent} absent`
                                : "Attendance still aligned"}
                            </div>
                          </div>
                          <div className="rounded-[18px] bg-white/80 px-3 py-2 text-right">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Saved Net</div>
                            <div className="mt-1 text-base font-semibold text-stone-950">{formatMoney(entry.netPay.toString())}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                          <div className="rounded-[16px] bg-white/80 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Attendance</div>
                            <div className="mt-1 text-stone-950">
                              {liveMetrics.daysPresent} P • {liveMetrics.daysHalf} H • {liveMetrics.daysAbsent} A
                            </div>
                          </div>
                          <div className="rounded-[16px] bg-white/80 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Gross Live</div>
                            <div className="mt-1 text-stone-950">{formatMoney(liveMetrics.grossPay)}</div>
                          </div>
                          <div className="rounded-[16px] bg-white/80 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Saved Additions</div>
                            <div className="mt-1 text-stone-950">
                              Bonus {formatMoney(("totalBonusesAdded" in entry ? entry.totalBonusesAdded : 0).toString())}
                            </div>
                          </div>
                          <div className="rounded-[16px] bg-white/80 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Saved Deductions</div>
                            <div className="mt-1 text-stone-950">
                              {formatMoney(entry.totalAdvancesDeducted.toString())} + {formatMoney(entry.totalPayablesDeducted.toString())}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}

          {periods.length === 0 ? (
            <div className="panel p-5 text-sm text-slate-600">No payroll periods yet. Generate your first payroll from the form on the left.</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
