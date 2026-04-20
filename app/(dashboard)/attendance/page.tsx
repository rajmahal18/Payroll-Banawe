import { endOfDay, startOfDay } from "date-fns";
import { saveAttendanceAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/utils";

export default async function AttendancePage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string; saved?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedDate = params.date ? new Date(params.date) : new Date();
  const dateValue = toDateInputValue(selectedDate);

  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } });
  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: startOfDay(selectedDate), lte: endOfDay(selectedDate) }
    }
  });
  const byEmployee = new Map(records.map((record) => [record.employeeId, record]));

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="All active employees default to present. Mark only the absences and save once."
        action={
          <form className="flex items-center gap-2" method="GET">
            <input name="date" type="date" defaultValue={dateValue} className="min-w-[180px]" />
            <button className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Load</button>
          </form>
        }
      />

      {params.saved ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Attendance saved successfully.</div> : null}

      <form action={saveAttendanceAction} className="panel p-5">
        <input type="hidden" name="date" value={dateValue} />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{selectedDate.toDateString()}</h2>
            <p className="text-sm text-slate-600">Toggle an employee to absent only when needed.</p>
          </div>
          <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save Attendance</button>
        </div>

        <div className="space-y-3">
          {employees.map((employee) => {
            const record = byEmployee.get(employee.id);
            const isAbsent = record?.status === "ABSENT";
            return (
              <div key={employee.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.4fr_0.7fr_1fr] lg:items-center">
                <div>
                  <div className="font-medium text-slate-950">{employee.fullName}</div>
                  <div className="text-xs text-slate-500">{employee.position || "No position"}</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                  <select name={`status_${employee.id}`} defaultValue={isAbsent ? "absent" : "present"}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                  <input name={`remarks_${employee.id}`} defaultValue={record?.remarks || ""} placeholder="Optional note" />
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </div>
  );
}
