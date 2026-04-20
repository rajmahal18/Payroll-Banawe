import { endOfDay, startOfDay } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const today = new Date();
  const [employeeCount, absentToday, advancesOpen, payablesOpen, latestPeriod] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceRecord.count({
      where: {
        date: { gte: startOfDay(today), lte: endOfDay(today) },
        status: "ABSENT"
      }
    }),
    prisma.advance.aggregate({
      where: { status: "OPEN" },
      _sum: { remainingBalance: true }
    }),
    prisma.payable.aggregate({
      where: { status: "OPEN" },
      _sum: { remainingBalance: true }
    }),
    prisma.payrollPeriod.findFirst({ orderBy: { payDate: "desc" }, include: { payrollEntries: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } } })
  ]);

  const presentToday = Math.max(employeeCount - absentToday, 0);
  const totalNet = latestPeriod?.payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0) ?? 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="Quick view of headcount, absences, deductions, and the latest payroll run." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Employees" value={employeeCount} />
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent Today" value={absentToday} tone="danger" />
        <StatCard label="Open Advances" value={Number(advancesOpen._sum.remainingBalance || 0)} tone="warning" money />
        <StatCard label="Open Payables" value={Number(payablesOpen._sum.remainingBalance || 0)} tone="danger" money />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Latest Payroll Period</h2>
          {latestPeriod ? (
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Label</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">{latestPeriod.label}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">{latestPeriod.status}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Net Payout</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">{formatMoney(totalNet)}</div>
                </div>
              </div>

              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestPeriod.payrollEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.employee.fullName}</td>
                        <td>{entry.daysPresent}</td>
                        <td>{entry.daysAbsent}</td>
                        <td>{formatMoney(entry.netPay.toString())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No payroll generated yet.</div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Owner Workflow</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">1.</span> Open Attendance and mark absences for the day.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">2.</span> Record advances and payables as they happen.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">3.</span> Generate payroll using the schedule from Settings.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">4.</span> Finalize the payroll after review.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
