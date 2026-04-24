import { addDays, endOfDay, format, isSameDay, startOfDay, subDays } from "date-fns";
import { AttendanceChecklist } from "@/components/attendance-checklist";
import { DashboardStatsStrip } from "@/components/dashboard-stats-strip";
import { prisma } from "@/lib/prisma";
import { formatMoney, toDateInputValue } from "@/lib/utils";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string; saved?: string; edit?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedDate = params.date ? new Date(params.date) : new Date();
  const today = new Date();
  const dateValue = toDateInputValue(selectedDate);
  const stripStart = startOfDay(subDays(selectedDate, 3));
  const stripEnd = endOfDay(addDays(selectedDate, 3));

  const [employeeCount, absentToday, advancesOpen, latestPeriod, employees, records, stripRecords] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceRecord.count({
      where: {
        date: { gte: startOfDay(selectedDate), lte: endOfDay(selectedDate) },
        status: "ABSENT"
      }
    }),
    prisma.advance.aggregate({
      where: { status: "OPEN" },
      _sum: { remainingBalance: true }
    }),
    prisma.payrollPeriod.findFirst({ orderBy: { payDate: "desc" }, include: { payrollEntries: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: startOfDay(selectedDate), lte: endOfDay(selectedDate) }
      }
    }),
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: stripStart, lte: stripEnd }
      },
      include: {
        employee: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: [{ date: "asc" }, { employee: { fullName: "asc" } }]
    })
  ]);

  const presentToday = Math.max(employeeCount - absentToday, 0);
  const totalNet = latestPeriod?.payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0) ?? 0;
  const byEmployee = new Map(records.map((record) => [record.employeeId, record]));
  const hasSavedAttendance = records.length > 0;
  const isEditingAttendance = params.edit === "1";
  const dateSnapshots = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(selectedDate), index - 3);
    const snapshotDateValue = toDateInputValue(date);
    const dayRecords = stripRecords.filter((record) => toDateInputValue(record.date) === snapshotDateValue);
    const absentEmployees = dayRecords
      .filter((record) => record.status === "ABSENT")
      .map((record) => record.employee.fullName.split(" ")[0]);
    const summary =
      dayRecords.length === 0
        ? "Not yet saved"
        : absentEmployees.length === 0
          ? "Perfect attendance"
          : `${absentEmployees.length} absent: ${absentEmployees.slice(0, 2).join(", ")}${absentEmployees.length > 2 ? ` +${absentEmployees.length - 2}` : ""}`;

    return {
      dateValue: snapshotDateValue,
      dayLabel: format(date, "EEE"),
      dateLabel: format(date, "d MMM"),
      summary,
      active: snapshotDateValue === dateValue,
      today: isSameDay(date, today)
    };
  });

  return (
    <div>
      {params.saved ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Attendance saved successfully.</div> : null}

      <DashboardStatsStrip
        entries={[
          { label: "Attendance Logged", value: hasSavedAttendance ? "Yes" : "No", icon: "attendance", tone: hasSavedAttendance ? "green" : "red" },
          { label: "Active Employees", value: employeeCount, icon: "employees", tone: "blue" },
          { label: "Present", value: presentToday, icon: "present", tone: "green" },
          { label: "Absent", value: absentToday, icon: "absent", tone: "red" },
          { label: "Open Advances", value: Number(advancesOpen._sum.remainingBalance || 0), icon: "advances", tone: "amber", money: true }
        ]}
      />

      <div className="mt-4">
        <AttendanceChecklist
          title={`Attendance for ${selectedDate.toDateString()}`}
          subtitle={
            hasSavedAttendance && !isEditingAttendance
              ? "Attendance for this day is already saved. Indicators are now read-only until you choose to edit."
              : "Everything starts checked as present. Uncheck absences and open notes only for employees who need a remark."
          }
          dateValue={dateValue}
          redirectTo="/dashboard"
          hasSavedAttendance={hasSavedAttendance}
          isEditing={isEditingAttendance}
          dateSnapshots={dateSnapshots}
          items={employees.map((employee) => {
            const record = byEmployee.get(employee.id);
            return {
              id: employee.id,
              fullName: employee.fullName,
              position: employee.position,
              isPresent: record?.status !== "ABSENT",
              remarks: record?.remarks || null
            };
          })}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Latest Payroll Period</h2>
          {latestPeriod ? (
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="overflow-hidden rounded-[22px] border border-stone-200/80 bg-stone-50/80">
                <div className="grid divide-y divide-stone-200/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Label</div>
                    <div className="mt-1 text-base font-semibold text-stone-950">{latestPeriod.label}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Status</div>
                    <div className="mt-1 text-base font-semibold text-stone-950">{latestPeriod.status}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Net Payout</div>
                    <div className="mt-1 text-base font-semibold text-stone-950">{formatMoney(totalNet)}</div>
                  </div>
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
          <h2 className="text-lg font-semibold text-slate-950">Daily Flow</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">1.</span> Tick present employees and save attendance from the dashboard.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">2.</span> Record advances when they happen.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">3.</span> Generate payroll using the schedule from Settings.</li>
            <li className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">4.</span> Review the latest payroll summary before finalizing.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
