import { createEmployeeAction, toggleEmployeeStatusAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({ orderBy: [{ status: "asc" }, { fullName: "asc" }] });

  return (
    <div>
      <PageHeader title="Employees" description="Maintain your worker master list and daily rates." />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Add Employee</h2>
          <form action={createEmployeeAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee Code</label>
              <input name="employeeCode" placeholder="EMP-004" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
              <input name="fullName" placeholder="Amina Santos" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
              <input name="position" placeholder="Warehouse Staff" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Daily Rate</label>
              <input name="dailyRate" type="number" min="0" step="0.01" placeholder="650" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact Number</label>
              <input name="contactNumber" placeholder="09xxxxxxxxx" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input name="startDate" type="date" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea name="notes" rows={3} placeholder="Optional notes" />
            </div>
            <div className="md:col-span-2">
              <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save Employee</button>
            </div>
          </form>
        </section>

        <section className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Daily Rate</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="font-medium text-slate-950">{employee.fullName}</div>
                    <div className="text-xs text-slate-500">{employee.employeeCode}</div>
                  </td>
                  <td>{employee.position || "—"}</td>
                  <td>{formatMoney(employee.dailyRate.toString())}</td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${employee.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td>{employee.startDate ? formatDate(employee.startDate) : "—"}</td>
                  <td>
                    <form action={toggleEmployeeStatusAction}>
                      <input type="hidden" name="employeeId" value={employee.id} />
                      <input type="hidden" name="currentStatus" value={employee.status} />
                      <button className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
