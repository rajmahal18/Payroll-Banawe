import Link from "next/link";
import { MessageSquareMore } from "lucide-react";
import { saveAttendanceAction } from "@/app/actions";
import { DatePickerForm } from "@/components/date-picker-form";

type AttendanceChecklistItem = {
  id: string;
  fullName: string;
  position: string | null;
  isPresent: boolean;
  remarks: string | null;
};

type AttendanceDateSnapshot = {
  dateValue: string;
  dayLabel: string;
  dateLabel: string;
  summary: string;
  active: boolean;
  today: boolean;
};

export function AttendanceChecklist({
  title,
  subtitle,
  dateValue,
  redirectTo,
  hasSavedAttendance,
  isEditing,
  dateSnapshots,
  items
}: {
  title: string;
  subtitle: string;
  dateValue: string;
  redirectTo: string;
  hasSavedAttendance: boolean;
  isEditing: boolean;
  dateSnapshots: AttendanceDateSnapshot[];
  items: AttendanceChecklistItem[];
}) {
  const isReadOnly = hasSavedAttendance && !isEditing;
  const submitLabel = isReadOnly ? "Edit Today's Attendance" : "Save Today's Attendance";

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-stone-200/80 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-stone-950">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{subtitle}</p>
          </div>
          <DatePickerForm action={redirectTo} value={dateValue} />
        </div>

        <div className="attendance-strip -mx-4 overflow-x-auto sm:-mx-5">
          <div className="min-w-[780px] px-4 sm:px-5">
            <div className="overflow-hidden rounded-[24px] border border-[rgba(218,210,200,0.78)] bg-[rgba(255,251,246,0.96)] shadow-[0_14px_30px_-26px_rgba(108,89,70,0.16)]">
              <div className="grid grid-cols-7">
                {dateSnapshots.map((snapshot) => (
                  <Link
                    key={snapshot.dateValue}
                    href={`${redirectTo}?date=${snapshot.dateValue}`}
                    className={`min-w-0 border-r border-[rgba(226,219,211,0.82)] px-3 py-4 text-center transition last:border-r-0 ${
                      snapshot.active
                        ? "bg-[#ffd95c] text-stone-900"
                        : snapshot.today
                          ? "bg-[#eef6f3] text-stone-900 hover:bg-[#e7f1ed]"
                          : "bg-[rgba(255,251,246,0.9)] text-stone-700 hover:bg-[rgba(248,243,235,0.96)]"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className={snapshot.active ? "text-[#8a6a10]" : snapshot.today ? "text-[#5f9f91]" : "text-stone-500"}>{snapshot.dayLabel}</span>
                      {snapshot.today ? <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${snapshot.active ? "bg-[#fff3bf] text-[#8a6a10]" : "bg-white text-[#5f9f91]"}`}>Today</span> : null}
                    </div>
                    <div className={`mt-1 text-sm font-medium ${snapshot.active ? "text-[#6b5310]" : "text-stone-700"}`}>{snapshot.dateLabel}</div>
                    <div className={`mt-2 min-h-[2.5rem] text-sm font-semibold leading-5 ${snapshot.active ? "text-[#0f6f67]" : "text-stone-900"}`}>{snapshot.summary}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form action={saveAttendanceAction}>
        <input type="hidden" name="date" value={dateValue} />
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="divide-y divide-stone-200/80">
          {items.length ? (
            items.map((employee) => (
              <div key={employee.id} className="px-4 py-4 sm:px-5">
                <div className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <label className={`min-w-0 ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}>
                    <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                      <input
                        type="checkbox"
                        name={`present_${employee.id}`}
                        defaultChecked={employee.isPresent}
                        disabled={isReadOnly}
                        className={`h-5 w-5 shrink-0 rounded-lg border-stone-300 text-emerald-600 focus:ring-emerald-200 ${isReadOnly ? "pointer-events-none opacity-100" : ""}`}
                      />
                      <span className="grid min-w-0 grid-cols-2 items-center gap-x-2 gap-y-0.5 sm:block">
                        <span className="truncate text-sm font-semibold text-stone-950">{employee.fullName}</span>
                        <span className="truncate text-right text-xs text-stone-500 sm:mt-1 sm:block sm:text-left">{employee.position || "No position"}</span>
                        {isReadOnly ? (
                          <span
                            className={`col-span-2 mt-1 inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:hidden ${
                              employee.isPresent ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {employee.isPresent ? "Present" : "Absent"}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>

                  {isReadOnly ? (
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline-flex ${
                          employee.isPresent ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {employee.isPresent ? "Present" : "Absent"}
                      </span>
                      <div className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-sm text-stone-600">
                        {employee.remarks || "No note"}
                      </div>
                    </div>
                  ) : (
                    <details className="note-toggle group w-full" open={Boolean(employee.remarks)}>
                      <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-stone-50 px-2 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white sm:px-3">
                        <MessageSquareMore className="h-4 w-4 text-emerald-700" />
                        {employee.remarks ? "Edit note" : "Add note"}
                      </summary>
                      <div className="mt-3">
                        <input
                          name={`remarks_${employee.id}`}
                          defaultValue={employee.remarks || ""}
                          placeholder="Optional note"
                        />
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-stone-600 sm:px-5">No active employees yet.</div>
          )}
        </div>

        {items.length ? (
          <div className="border-t border-stone-200/80 px-4 py-4 sm:px-5">
            {isReadOnly ? (
              <Link
                href={`${redirectTo}?date=${dateValue}&edit=1`}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:w-auto"
              >
                  {submitLabel}
              </Link>
            ) : (
              <button
                className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold sm:w-auto ${
                  isEditing || !hasSavedAttendance
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {submitLabel}
              </button>
            )}
          </div>
        ) : null}
      </form>
    </section>
  );
}
