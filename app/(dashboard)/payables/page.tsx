import { createPayableAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export default async function PayablesPage() {
  const [employees, payables] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.payable.findMany({ include: { employee: true }, orderBy: [{ status: "asc" }, { date: "desc" }] })
  ]);

  return (
    <div>
      <PageHeader title="Payables" description="Record shortages, damages, loans, and other deduction items." />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Record Payable</h2>
          <form action={createPayableAction} className="mt-4 space-y-4">
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
                <input name="amount" type="number" min="0" step="0.01" placeholder="500" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select name="type" required>
                <option value="SHORTAGE">Shortage</option>
                <option value="DAMAGE">Damage</option>
                <option value="LOAN">Loan</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
              <textarea name="remarks" rows={3} placeholder="Optional remarks" />
            </div>
            <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save Payable</button>
          </form>
        </section>

        <section className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payables.map((payable) => (
                <tr key={payable.id}>
                  <td>
                    <div>{payable.employee.fullName}</div>
                    <div className="text-xs text-slate-500">{payable.remarks || "—"}</div>
                  </td>
                  <td>{formatDate(payable.date)}</td>
                  <td>{payable.type}</td>
                  <td>{formatMoney(payable.amount.toString())}</td>
                  <td>{formatMoney(payable.remainingBalance.toString())}</td>
                  <td>{payable.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
