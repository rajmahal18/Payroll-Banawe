import { createBonusAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export default async function BonusesPage() {
  const user = await requireUser();
  const employees = await prisma.employee.findMany({
    where: { shopId: user.shop.id, status: "ACTIVE" },
    orderBy: { fullName: "asc" }
  });
  const employeeIds = employees.map((employee) => employee.id);
  const bonuses = await prisma.bonus.findMany({
    where: { employeeId: { in: employeeIds } },
    include: { employee: true },
    orderBy: [{ status: "asc" }, { date: "desc" }]
  });

  return (
    <div>
      <PageHeader title="Bonuses" description="Record one-time performance bonuses and let payroll pick them up once." />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Record Bonus</h2>
          <form action={createBonusAction} className="mt-4 space-y-4">
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Bonus date</label>
                <input name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                <input name="amount" type="number" min="0" step="0.01" placeholder="500" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
              <textarea name="reason" rows={3} placeholder="Optional performance note" />
            </div>
            <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Bonus</button>
          </form>
        </section>

        <section className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {bonuses.map((bonus) => (
                <tr key={bonus.id}>
                  <td>{bonus.employee.fullName}</td>
                  <td>{formatDate(bonus.date)}</td>
                  <td>{formatMoney(bonus.amount.toString())}</td>
                  <td>{bonus.status}</td>
                  <td>{bonus.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
