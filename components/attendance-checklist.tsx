import Link from "next/link";
import { MessageSquareMore } from "lucide-react";
import { saveAttendanceAction } from "@/app/actions";
import { DatePickerForm } from "@/components/date-picker-form";

type AttendanceChecklistItem = {
  id: string;
  fullName: string;
  position: string | null;
  status: "PRESENT" | "HALF_DAY" | "ABSENT";
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
  const getStatusBadge = (status: AttendanceChecklistItem["status"]) =>
    status === "ABSENT"
      ? "bg-rose-50 text-rose-700"
      : status === "HALF_DAY"
        ? "bg-lime-50 text-lime-700"
        : "bg-emerald-50 text-emerald-700";
  const getStatusLabel = (status: AttendanceChecklistItem["status"]) =>
    status === "ABSENT" ? "Absent" : status === "HALF_DAY" ? "Half Day" : "Present";
  const getStatusShell = (status: AttendanceChecklistItem["status"]) =>
    status === "ABSENT"
      ? "border-l-[6px] border-rose-500 bg-[rgba(255,241,242,0.72)]"
      : status === "HALF_DAY"
        ? "border-l-[6px] border-[#84a83b] bg-[rgba(247,252,231,0.9)]"
        : "border-l-[6px] border-[#2f7d5b] bg-[rgba(232,248,226,0.78)]";
  const getStatusIcon = (status: AttendanceChecklistItem["status"]) =>
    status === "ABSENT"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : status === "HALF_DAY"
        ? "border-lime-200 bg-lime-50 text-lime-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const getOptionStyles = (option: AttendanceChecklistItem["status"]) =>
    option === "ABSENT"
      ? "has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50 has-[:checked]:text-rose-700"
      : option === "HALF_DAY"
        ? "has-[:checked]:border-lime-300 has-[:checked]:bg-lime-50 has-[:checked]:text-lime-700"
        : "has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700";

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[rgba(148,190,139,0.35)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-stone-950">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{subtitle}</p>
          </div>
          <DatePickerForm action={redirectTo} value={dateValue} />
        </div>

        <div className="attendance-strip -mx-4 overflow-x-auto sm:-mx-5">
          <div className="min-w-[780px] px-4 sm:px-5">
            <div className="overflow-hidden rounded-[24px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.96)] shadow-[0_14px_30px_-26px_rgba(22,78,43,0.18)]">
              <div className="grid grid-cols-7">
                {dateSnapshots.map((snapshot) => (
                  <Link
                    key={snapshot.dateValue}
                    href={`${redirectTo}?date=${snapshot.dateValue}`}
                    className={`min-w-0 border-r border-[rgba(148,190,139,0.35)] px-3 py-4 text-center transition last:border-r-0 ${
                      snapshot.active
                        ? "bg-[linear-gradient(180deg,#b7efb4_0%,#80cf89_100%)] text-[#123524]"
                        : snapshot.today
                          ? "bg-[#e1f5dc] text-[#173624] hover:bg-[#d4efcf]"
                          : "bg-[rgba(250,255,247,0.9)] text-[#45624f] hover:bg-[rgba(232,248,226,0.96)]"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className={snapshot.active ? "text-[#14532d]" : snapshot.today ? "text-[#16784f]" : "text-stone-500"}>{snapshot.dayLabel}</span>
                      {snapshot.today ? <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${snapshot.active ? "bg-[#fff3bf] text-[#14532d]" : "bg-white text-[#16784f]"}`}>Today</span> : null}
                    </div>
                    <div className={`mt-1 text-sm font-medium ${snapshot.active ? "text-[#14532d]" : "text-stone-700"}`}>{snapshot.dateLabel}</div>
                    <div className={`mt-2 min-h-[2.5rem] text-sm font-semibold leading-5 ${snapshot.active ? "text-[#14532d]" : "text-stone-900"}`}>{snapshot.summary}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form key={dateValue} action={saveAttendanceAction}>
        <input type="hidden" name="date" value={dateValue} />
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="divide-y divide-[rgba(148,190,139,0.28)]">
          {items.length ? (
            items.map((employee) => (
              <div key={employee.id} className={`px-4 py-4 transition sm:px-5 ${!isReadOnly ? getStatusShell(employee.status) : ""}`}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                  <label className={`min-w-0 ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}>
                    <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                      <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-xl border text-[10px] font-semibold ${getStatusIcon(employee.status)}`}>
                        {employee.status === "ABSENT" ? "A" : employee.status === "HALF_DAY" ? "1/2" : "P"}
                      </span>
                      <span className="grid min-w-0 grid-cols-2 items-center gap-x-2 gap-y-0.5 sm:block">
                        <span className="truncate text-sm font-semibold text-stone-950">{employee.fullName}</span>
                        <span className="truncate text-right text-xs text-stone-500 sm:mt-1 sm:block sm:text-left">{employee.position || "No position"}</span>
                        {isReadOnly ? (
                          <span
                            className={`col-span-2 mt-1 inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:hidden ${getStatusBadge(employee.status)}`}
                          >
                            {getStatusLabel(employee.status)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>

                  {isReadOnly ? (
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline-flex ${getStatusBadge(employee.status)}`}
                      >
                        {getStatusLabel(employee.status)}
                      </span>
                      {employee.remarks ? (
                        <div className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-sm text-stone-600">
                          {employee.remarks}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="grid grid-cols-3 gap-2">
                        <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-400 ${getOptionStyles("PRESENT")}`}>
                          <input
                            type="radio"
                            name={`status_${employee.id}`}
                            value="present"
                            defaultChecked={employee.status === "PRESENT"}
                            className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-200"
                          />
                          Present
                        </label>
                        <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-400 ${getOptionStyles("HALF_DAY")}`}>
                          <input
                            type="radio"
                            name={`status_${employee.id}`}
                            value="half_day"
                            defaultChecked={employee.status === "HALF_DAY"}
                            className="h-4 w-4 border-stone-300 text-lime-700 focus:ring-lime-200"
                          />
                          Half Day
                        </label>
                        <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-400 ${getOptionStyles("ABSENT")}`}>
                          <input
                            type="radio"
                            name={`status_${employee.id}`}
                            value="absent"
                            defaultChecked={employee.status === "ABSENT"}
                            className="h-4 w-4 border-stone-300 text-rose-600 focus:ring-rose-200"
                          />
                          Absent
                        </label>
                      </div>
                      <div className="mt-2 text-right text-[11px] text-stone-500">
                        One status only per employee. Default is present.
                      </div>
                      <details className="note-toggle group mt-3 w-full" open={Boolean(employee.remarks)}>
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
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-stone-600 sm:px-5">No active employees yet.</div>
          )}
        </div>

        {items.length ? (
          <div className="border-t border-[rgba(148,190,139,0.35)] px-4 py-4 sm:px-5">
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
