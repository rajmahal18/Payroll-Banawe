import { createAdvanceAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export default async function AdvancesPage() {
  const user = await requireUser();
  const employees = await prisma.employee.findMany({ where: { shopId: user.shop.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } });
  const employeeIds = employees.map((employee) => employee.id);
  const advances = await prisma.advance.findMany({
    where: { employeeId: { in: employeeIds } },
    include: { employee: true },
    orderBy: [{ status: "asc" }, { date: "desc" }]
  });

  return (
    <div>
      <PageHeader title="Advances" description="Track cash advances and see remaining balances by employee." />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Record Advance</h2>
          <form action={createAdvanceAction} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
              <select name="employeeId" required>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                <input name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                <input name="amount" type="number" min="0" step="0.01" placeholder="1000" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Deduct Per Payroll</label>
              <input name="deductionPerPayroll" type="number" min="0" step="0.01" placeholder="Optional partial deduction amount" />
              <p className="mt-1 text-xs text-slate-500">
                Example: set `1000` on a `2000` advance to deduct `1000` this sahod and `1000` on the next one.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
              <textarea name="reason" rows={3} placeholder="Optional reason" />
            </div>
            <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Advance</button>
          </form>
        </section>

        <section className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Per Payroll</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((advance) => (
                <tr key={advance.id}>
                  <td>{advance.employee.fullName}</td>
                  <td>{formatDate(advance.date)}</td>
                  <td>{formatMoney(advance.amount.toString())}</td>
                  <td>{advance.deductionPerPayroll ? formatMoney(advance.deductionPerPayroll.toString()) : "Full"}</td>
                  <td>{formatMoney(advance.remainingBalance.toString())}</td>
                  <td>{advance.status}</td>
                  <td>{advance.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
