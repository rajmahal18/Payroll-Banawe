import { PageHeader } from "@/components/page-header";
import { finalizePayrollAction, generatePayrollForDateAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export default async function PayrollPage({
  searchParams
}: {
  searchParams?: Promise<{ payDate?: string; generated?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedPayDate = params.payDate ? new Date(params.payDate) : new Date();

  const periods = await prisma.payrollPeriod.findMany({
    include: {
      payrollEntries: {
        include: { employee: true },
        orderBy: { employee: { fullName: "asc" } }
      }
    },
    orderBy: { payDate: "desc" },
    take: 10
  });

  return (
    <div>
      <PageHeader title="Payroll" description="Generate payroll for a chosen pay date. Each employee is included only when their own payroll schedule is due." />

      {params.generated ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll generated successfully.</div> : null}
      {params.error === "no-due-employees" ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No active employees are scheduled for payroll on that date.
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
            <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Generate Payroll</button>
          </form>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            The app checks every active employee against their own payroll setup, then creates payroll entries only for employees due on the selected date.
          </div>
        </section>

        <section className="space-y-4">
          {periods.map((period) => {
            const netTotal = period.payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
            return (
              <div key={period.id} className="panel p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{period.status}</div>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{period.label}</h2>
                    <div className="mt-3 inline-flex min-w-[180px] flex-col rounded-[20px] bg-[#ffd95c] px-4 py-3 text-stone-900 shadow-[0_12px_24px_-20px_rgba(184,143,18,0.55)]">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6a10]">Pay Date</span>
                      <span className="mt-1 text-base font-semibold text-[#0f6f67]">{formatDate(period.payDate)}</span>
                    </div>
                    <div className="text-sm text-slate-600">Total net payout: {formatMoney(netTotal)}</div>
                  </div>
                  {period.status === "DRAFT" ? (
                    <form action={finalizePayrollAction}>
                      <input type="hidden" name="payrollPeriodId" value={period.id} />
                      <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Finalize</button>
                    </form>
                  ) : null}
                </div>

                <div className="table-shell mt-4">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Gross</th>
                        <th>Advances</th>
                        <th>Payables</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {period.payrollEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.employee.fullName}</td>
                          <td>{entry.daysPresent}</td>
                          <td>{entry.daysAbsent}</td>
                          <td>{formatMoney(entry.grossPay.toString())}</td>
                          <td>{formatMoney(entry.totalAdvancesDeducted.toString())}</td>
                          <td>{formatMoney(entry.totalPayablesDeducted.toString())}</td>
                          <td className="font-semibold text-slate-950">{formatMoney(entry.netPay.toString())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
