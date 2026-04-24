"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PayrollFrequency } from "@prisma/client";
import { Clock3, EllipsisVertical, Eye, Pencil, Power, Trash2, X } from "lucide-react";
import { deleteEmployeeAction, toggleEmployeeStatusAction, updateEmployeeAction } from "@/app/actions";
import { PayrollScheduleFields } from "@/components/employee-payroll-schedule-fields";
import { BUSINESS_TIME_ZONE, formatDate, getWeekdayLabel, toDateInputValue } from "@/lib/utils";

type EmployeeCardItem = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  dailyRate: string;
  status: "ACTIVE" | "INACTIVE";
  payrollFrequency: PayrollFrequency;
  weeklyPayDay: number | null;
  monthlyPayDay: number | null;
  twiceMonthlyDayOne: number | null;
  twiceMonthlyDayTwo: number | null;
  everyNDays: number | null;
  startDate: string | null;
  lastPaidDate: string | null;
  contactNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attendanceRecords: Array<{
    date: string;
    status: "PRESENT" | "HALF_DAY" | "ABSENT";
    remarks: string | null;
  }>;
  payrollDates: Array<{
    date: string;
    label: string;
  }>;
};

function formatDateLabel(value?: string | null) {
  if (!value) return "Not set";
  return formatDate(value);
}

function formatMoneyLabel(value: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatOrdinal(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function describeEmployeePayrollSchedule(employee: Pick<
  EmployeeCardItem,
  "payrollFrequency" | "weeklyPayDay" | "monthlyPayDay" | "twiceMonthlyDayOne" | "twiceMonthlyDayTwo" | "everyNDays"
>) {
  switch (employee.payrollFrequency) {
    case PayrollFrequency.DAILY:
      return "Daily payroll";
    case PayrollFrequency.WEEKLY:
      return `Weekly every ${getWeekdayLabel(employee.weeklyPayDay ?? 5)}`;
    case PayrollFrequency.MONTHLY:
      return `Monthly every ${formatOrdinal(employee.monthlyPayDay ?? 15)}`;
    case PayrollFrequency.TWICE_MONTHLY: {
      const first = Math.min(employee.twiceMonthlyDayOne ?? 15, employee.twiceMonthlyDayTwo ?? 30);
      const second = Math.max(employee.twiceMonthlyDayOne ?? 15, employee.twiceMonthlyDayTwo ?? 30);
      return `Twice monthly every ${formatOrdinal(first)} and ${formatOrdinal(second)}`;
    }
    case PayrollFrequency.EVERY_N_DAYS:
      return `Every ${employee.everyNDays ?? 7} days`;
    default:
      return "Payroll schedule not set";
  }
}

function formatDateKey(value: string | Date) {
  return toDateInputValue(new Date(value));
}

function EmployeeEditModal({
  employee,
  open,
  onClose
}: {
  employee: EmployeeCardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open || !employee) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Edit Employee</h2>
            <p className="mt-1 text-sm text-[#7a7168]">Update this employee record without leaving the list.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
            aria-label="Close edit employee modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <form action={updateEmployeeAction} className="grid gap-3 xl:grid-cols-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <div className="xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee Code</label>
              <div className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-[rgba(229,245,224,0.86)] px-4 py-2.5 text-sm font-semibold text-stone-900">
                {employee.employeeCode}
              </div>
              <p className="mt-1 text-xs text-[#7a7168]">Employee codes are generated automatically per shop and can't be edited manually.</p>
            </div>
            <div className="xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
              <input name="fullName" defaultValue={employee.fullName} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
              <input name="position" defaultValue={employee.position || ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Daily Rate</label>
              <input name="dailyRate" type="number" min="0" step="0.01" defaultValue={employee.dailyRate} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact Number</label>
              <input name="contactNumber" defaultValue={employee.contactNumber || ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input name="startDate" type="date" defaultValue={employee.startDate ? toDateInputValue(new Date(employee.startDate)) : ""} />
            </div>
            <PayrollScheduleFields
              compact
              initialValues={{
                payrollFrequency: employee.payrollFrequency,
                weeklyPayDay: employee.weeklyPayDay,
                monthlyPayDay: employee.monthlyPayDay,
                twiceMonthlyDayOne: employee.twiceMonthlyDayOne,
                twiceMonthlyDayTwo: employee.twiceMonthlyDayTwo,
                everyNDays: employee.everyNDays,
                lastPaidDate: employee.lastPaidDate
              }}
            />
            <div className="xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea name="notes" rows={2} defaultValue={employee.notes || ""} />
            </div>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end xl:col-span-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-[#edf8e9]"
              >
                Cancel
              </button>
              <button className="rounded-2xl bg-[#6f9c90] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#628b81]">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EmployeeViewModal({
  employee,
  open,
  onClose
}: {
  employee: EmployeeCardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open || !employee) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-2xl rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Employee Details</h2>
            <p className="mt-1 text-sm text-[#7a7168]">{employee.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
            aria-label="Close employee details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-4 rounded-[24px] border border-[rgba(226,219,211,0.82)] bg-[linear-gradient(135deg,rgba(250,238,224,0.72)_0%,rgba(245,250,247,0.92)_56%,rgba(255,255,255,0.96)_100%)] p-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(135deg,#e6f1ed_0%,#edf3fa_100%)] text-2xl font-semibold text-[#678c84] shadow-[0_14px_24px_-18px_rgba(103,140,132,0.45)]">
              {initials(employee.fullName)}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7f73]">{employee.employeeCode}</div>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-stone-950">{employee.fullName}</h3>
              <p className="mt-1 text-sm text-[#7a7168]">{employee.position || "No position assigned yet"}</p>
              <div className="mt-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "ACTIVE" ? "bg-[#e6f1ed] text-[#5f9f91]" : "bg-stone-100 text-stone-600"}`}>
                  {employee.status}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Daily Rate</div>
              <div className="mt-1 text-sm font-semibold text-stone-950">{formatMoneyLabel(employee.dailyRate)}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Employment Start</div>
              <div className="mt-1 text-sm font-semibold text-stone-950">{formatDateLabel(employee.startDate)}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Last Paid</div>
              <div className="mt-1 text-sm font-semibold text-stone-950">{formatDateLabel(employee.lastPaidDate)}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4 sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Payroll Schedule</div>
              <div className="mt-1 text-sm font-semibold text-stone-950">{describeEmployeePayrollSchedule(employee)}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4 sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Contact Number</div>
              <div className="mt-1 text-sm font-semibold text-stone-950">{employee.contactNumber || "Not set"}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(255,255,255,0.72)] p-4 sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Notes</div>
              <div className="mt-1 text-sm text-stone-800">{employee.notes || "No notes recorded."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EmployeeTimelineModal({
  employee,
  open,
  onClose
}: {
  employee: EmployeeCardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));

  useEffect(() => {
    if (!employee) return;
    const defaultDate = employee.startDate ? new Date(employee.startDate) : new Date();
    setVisibleMonth(new Date(defaultDate.getFullYear(), defaultDate.getMonth(), 1));
    setSelectedDateKey(formatDateKey(defaultDate));
  }, [employee]);

  const dateEvents = useMemo(() => {
    if (!employee) return new Map<string, Array<{ type: string; label: string; tone: "green" | "red" | "amber" | "stone" }>>();

    const events = new Map<string, Array<{ type: string; label: string; tone: "green" | "red" | "amber" | "stone" }>>();
    const pushEvent = (date: string, event: { type: string; label: string; tone: "green" | "red" | "amber" | "stone" }) => {
      const key = formatDateKey(date);
      const current = events.get(key) || [];
      current.push(event);
      events.set(key, current);
    };

    pushEvent(employee.createdAt, { type: "record", label: "Employee record created", tone: "stone" });

    if (employee.startDate) {
      pushEvent(employee.startDate, { type: "start", label: "Employment start date", tone: "amber" });
    }

    employee.attendanceRecords.forEach((record) => {
      pushEvent(record.date, {
        type: "attendance",
        label:
          record.status === "ABSENT"
            ? `Absent${record.remarks ? `: ${record.remarks}` : ""}`
            : record.status === "HALF_DAY"
              ? `Half Day${record.remarks ? `: ${record.remarks}` : ""}`
              : "Present",
        tone: record.status === "ABSENT" ? "red" : record.status === "HALF_DAY" ? "amber" : "green"
      });
    });

    employee.payrollDates.forEach((payday) => {
      pushEvent(payday.date, {
        type: "payday",
        label: `Payday: ${payday.label}`,
        tone: "amber"
      });
    });

    return events;
  }, [employee]);

  const calendarDays = useMemo(() => {
    const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const end = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    const days: Array<{ key: string; date: Date; inMonth: boolean }> = [];
    const startWeekday = start.getDay();

    for (let i = startWeekday; i > 0; i -= 1) {
      const date = new Date(start);
      date.setDate(start.getDate() - i);
      days.push({ key: formatDateKey(date), date, inMonth: false });
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      days.push({ key: formatDateKey(date), date, inMonth: true });
    }

    while (days.length % 7 !== 0) {
      const date = new Date(end);
      date.setDate(end.getDate() + (days.length % 7));
      days.push({ key: formatDateKey(date), date, inMonth: false });
    }

    return days;
  }, [visibleMonth]);

  const selectedEvents = dateEvents.get(selectedDateKey) || [];

  if (!mounted || !open || !employee) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-4xl rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Employee Timeline</h2>
            <p className="mt-1 text-sm text-[#7a7168]">{employee.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
            aria-label="Close employee timeline"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#edf8e9]"
              >
                Prev
              </button>
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Calendar</div>
                <div className="mt-1 text-lg font-semibold text-stone-950">
                  {new Intl.DateTimeFormat("en-PH", { timeZone: BUSINESS_TIME_ZONE, month: "long", year: "numeric" }).format(visibleMonth)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-[#edf8e9]"
              >
                Next
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-[rgba(148,190,139,0.36)] bg-[rgba(255,250,244,0.92)]">
              <div className="grid grid-cols-7 border-b border-[rgba(148,190,139,0.36)] bg-[rgba(250,244,236,0.95)]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map(({ key, date, inMonth }, index) => {
                  const events = dateEvents.get(key) || [];
                  const hasAbsent = events.some((event) => event.tone === "red");
                  const hasHalfDay = events.some((event) => event.tone === "amber" && event.type === "attendance");
                  const hasPresent = events.some((event) => event.tone === "green");
                  const hasPayday = events.some((event) => event.type === "payday");
                  const isSelected = key === selectedDateKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDateKey(key)}
                      className={`min-h-[88px] border-t border-[rgba(226,219,211,0.72)] px-2 py-2 text-left transition ${
                        index % 7 !== 6 ? "border-r" : ""
                      } ${
                        inMonth ? "bg-white/55" : "bg-[rgba(229,245,224,0.7)] text-stone-400"
                      } ${isSelected ? "bg-[rgba(255,244,206,0.78)]" : "hover:bg-[rgba(250,244,236,0.92)]"}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm font-semibold ${inMonth ? "text-stone-900" : "text-stone-400"}`}>{date.getDate()}</span>
                        <div className="flex items-center gap-1">
                          {hasPayday ? <span className="h-2.5 w-2.5 rounded-full bg-lime-400" /> : null}
                          {hasHalfDay ? <span className="h-2.5 w-2.5 rounded-full bg-lime-600" /> : null}
                          {hasPresent ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                          {hasAbsent ? <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {events.slice(0, 2).map((event, index) => (
                          <div
                            key={`${event.type}-${index}`}
                            className={`truncate rounded-full px-2 py-1 text-[10px] font-semibold ${
                              event.tone === "red"
                                ? "bg-rose-50 text-rose-700"
                                : event.tone === "green"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : event.tone === "amber"
                                    ? "bg-lime-50 text-lime-700"
                                    : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {event.type === "attendance" ? event.label.split(":")[0] : event.type === "payday" ? "Payday" : event.type === "start" ? "Start" : "Record"}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#7a7168]">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-lime-600" /> Half day</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-lime-400" /> Payday / start</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-[rgba(148,190,139,0.36)] bg-[rgba(255,250,244,0.92)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Selected Date</div>
            <div className="mt-1 text-lg font-semibold text-stone-950">{formatDateLabel(selectedDateKey)}</div>

            <div className="mt-4 space-y-3">
              {selectedEvents.length ? (
                selectedEvents.map((event, index) => (
                  <div
                    key={`${event.type}-${index}`}
                    className={`rounded-[20px] border px-4 py-3 ${
                      event.tone === "red"
                        ? "border-rose-200 bg-rose-50"
                        : event.tone === "green"
                          ? "border-emerald-200 bg-emerald-50"
                          : event.tone === "amber"
                            ? "border-lime-200 bg-lime-50"
                            : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">{event.type}</div>
                    <div className="mt-1 text-sm font-medium text-stone-900">{event.label}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-[rgba(148,190,139,0.36)] bg-white px-4 py-4 text-sm text-[#7a7168]">
                  No recorded events for this employee on the selected date.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function EmployeeCardGrid({ employees }: { employees: EmployeeCardItem[] }) {
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [viewEmployee, setViewEmployee] = useState<EmployeeCardItem | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeCardItem | null>(null);
  const [timelineEmployee, setTimelineEmployee] = useState<EmployeeCardItem | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<EmployeeCardItem | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpenFor(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => (
          <article
            key={employee.id}
            className={`relative rounded-[28px] border border-[rgba(232,191,115,0.62)] bg-[linear-gradient(135deg,rgba(250,238,224,0.78)_0%,rgba(245,250,247,0.94)_58%,rgba(255,255,255,0.98)_100%)] p-5 shadow-[0_18px_42px_-30px_rgba(108,89,70,0.16)] ${
              menuOpenFor === employee.id ? "z-30 overflow-visible" : "overflow-hidden"
            }`}
          >
            <div className="absolute left-0 top-4 h-[78%] w-1.5 rounded-r-full bg-[linear-gradient(180deg,#f0b24b_0%,#f5c36d_100%)]" />
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(214,233,227,0.58),rgba(255,255,255,0)_58%),radial-gradient(circle_at_top_right,rgba(245,221,198,0.42),rgba(255,255,255,0)_50%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[22px] border border-white/70 bg-[linear-gradient(135deg,#e6f1ed_0%,#edf3fa_100%)] text-2xl font-semibold text-[#678c84] shadow-[0_14px_24px_-18px_rgba(103,140,132,0.45)]">
                    {initials(employee.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7f73]">{employee.employeeCode}</div>
                    <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-stone-950">{employee.fullName}</h2>
                    <div className="mt-2 inline-flex rounded-full border border-[rgba(232,191,115,0.8)] bg-[rgba(255,248,234,0.94)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#b17d1f]">
                      {employee.position || "Team Member"}
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "ACTIVE" ? "bg-[#e6f1ed] text-[#5f9f91]" : "bg-stone-100 text-stone-600"}`}>
                        {employee.status === "ACTIVE" ? "Active Employee" : "Inactive Employee"}
                      </span>
                    </div>
                  </div>
                </div>

                <div ref={menuOpenFor === employee.id ? menuRef : undefined} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpenFor((current) => (current === employee.id ? null : employee.id))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-[rgba(255,255,255,0.9)] text-stone-500 transition hover:bg-white hover:text-stone-900"
                    aria-label={`Open actions for ${employee.fullName}`}
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>

                  {menuOpenFor === employee.id ? (
                    <div className="absolute right-0 top-12 z-20 w-48 rounded-[20px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] p-2 shadow-[0_18px_36px_-24px_rgba(22,78,43,0.24)]">
                      <button
                        type="button"
                        onClick={() => {
                          setViewEmployee(employee);
                          setMenuOpenFor(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-[#edf8e9]"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee(employee);
                          setMenuOpenFor(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-[#edf8e9]"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTimelineEmployee(employee);
                          setMenuOpenFor(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-[#edf8e9]"
                      >
                        <Clock3 className="h-4 w-4" />
                        View Timeline
                      </button>
                      <form action={toggleEmployeeStatusAction}>
                        <input type="hidden" name="employeeId" value={employee.id} />
                        <input type="hidden" name="currentStatus" value={employee.status} />
                        <button className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-[#edf8e9]">
                          <Power className="h-4 w-4" />
                          {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteEmployee(employee);
                          setMenuOpenFor(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <EmployeeViewModal employee={viewEmployee} open={Boolean(viewEmployee)} onClose={() => setViewEmployee(null)} />
      <EmployeeEditModal employee={editingEmployee} open={Boolean(editingEmployee)} onClose={() => setEditingEmployee(null)} />
      <EmployeeTimelineModal employee={timelineEmployee} open={Boolean(timelineEmployee)} onClose={() => setTimelineEmployee(null)} />

      {deleteEmployee ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] p-5 shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)]">
            <h2 className="text-lg font-semibold text-stone-950">Delete Employee</h2>
            <p className="mt-2 text-sm text-[#7a7168]">This will permanently delete {deleteEmployee.fullName} and related records. This action cannot be undone.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteEmployee(null)}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-[#edf8e9]"
              >
                Cancel
              </button>
              <form action={deleteEmployeeAction}>
                <input type="hidden" name="employeeId" value={deleteEmployee.id} />
                <button className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700">
                  Delete Employee
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
