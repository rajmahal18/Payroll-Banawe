"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, UsersRound, WalletCards } from "lucide-react";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils";

export type AdvanceActivityEvent = {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  type: "ADVANCE" | "DEDUCTION" | "SUGGESTED_DEDUCTION";
  amount: string;
  reason: string;
  balanceBefore: string | null;
  balanceAfter: string | null;
  currentDeductedAmount: string | null;
  currentRemainingBalance: string | null;
  status: "OPEN" | "CLOSED" | "CANCELLED" | null;
};

type AdvanceActivityCalendarProps = {
  events: AdvanceActivityEvent[];
  employees: Array<{ id: string; fullName: string; photoDataUrl: string | null }>;
  legacyDeductionEmployeeIds: string[];
  totals: {
    issued: string;
    deducted: string;
    outstanding: string;
    auditedDeductions: string;
  };
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function EmployeeAvatar({ name, photoDataUrl, size = "md" }: { name: string; photoDataUrl: string | null; size?: "sm" | "md" }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-white bg-[#e6f1ed] font-semibold text-[#527c70] shadow-sm ${size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs"}`}>
      {photoDataUrl ? <img src={photoDataUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function AdvanceActivityCalendar({ events, employees, totals, legacyDeductionEmployeeIds }: AdvanceActivityCalendarProps) {
  const todayKey = toDateInputValue(new Date());
  const nearestSuggestedDate = events
    .filter((event) => event.type === "SUGGESTED_DEDUCTION" && event.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))[0]?.date;
  const latestActualDate = events
    .filter((event) => event.type !== "SUGGESTED_DEDUCTION")
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.date;
  const latestEventDate = nearestSuggestedDate ?? latestActualDate ?? todayKey;
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(latestEventDate));
  const [selectedDate, setSelectedDate] = useState(latestEventDate);
  const [employeeId, setEmployeeId] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(
    () => events.filter((event) => employeeId === "all" || event.employeeId === employeeId),
    [employeeId, events]
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, AdvanceActivityEvent[]>();
    filteredEvents.forEach((event) => grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]));
    return grouped;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    const days: Array<{ key: string; date: Date; inMonth: boolean }> = [];

    for (let offset = first.getDay(); offset > 0; offset -= 1) {
      const date = new Date(first);
      date.setDate(first.getDate() - offset);
      days.push({ key: dateKey(date), date, inMonth: false });
    }
    for (let day = 1; day <= last.getDate(); day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      days.push({ key: dateKey(date), date, inMonth: true });
    }
    while (days.length % 7 !== 0) {
      const date = new Date(last);
      date.setDate(last.getDate() + (days.length % 7));
      days.push({ key: dateKey(date), date, inMonth: false });
    }
    return days;
  }, [visibleMonth]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;
  const employeePhotos = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.photoDataUrl])),
    [employees]
  );
  const filteredTotals = useMemo(() => {
    if (employeeId === "all") return totals;
    const employeeEvents = events.filter((event) => event.employeeId === employeeId);
    return {
      issued: employeeEvents
        .filter((event) => event.type === "ADVANCE" && event.status !== "CANCELLED")
        .reduce((sum, event) => sum + Number(event.amount), 0)
        .toString(),
      deducted: employeeEvents
        .filter((event) => event.type === "ADVANCE")
        .reduce((sum, event) => sum + Number(event.currentDeductedAmount ?? 0), 0)
        .toString(),
      outstanding: employeeEvents
        .filter((event) => event.type === "ADVANCE")
        .reduce((sum, event) => sum + Number(event.currentRemainingBalance ?? 0), 0)
        .toString(),
      auditedDeductions: totals.auditedDeductions
    };
  }, [employeeId, events, totals]);
  const selectedIssued = selectedEvents
    .filter((event) => event.type === "ADVANCE" && event.status !== "CANCELLED")
    .reduce((sum, event) => sum + Number(event.amount), 0);
  const selectedDeducted = selectedEvents
    .filter((event) => event.type === "DEDUCTION")
    .reduce((sum, event) => sum + Number(event.amount), 0);
  const selectedSuggested = selectedEvents
    .filter((event) => event.type === "SUGGESTED_DEDUCTION")
    .reduce((sum, event) => sum + Number(event.amount), 0);
  const hasLegacyDeductions =
    employeeId === "all" ? legacyDeductionEmployeeIds.length > 0 : legacyDeductionEmployeeIds.includes(employeeId);

  useEffect(() => {
    if (!pickerOpen) return;
    const closePicker = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", closePicker);
    return () => document.removeEventListener("mousedown", closePicker);
  }, [pickerOpen]);

  function selectEmployee(value: string) {
    setEmployeeId(value);
    setPickerOpen(false);
    const employeeEvents = events.filter((event) => value === "all" || event.employeeId === value);
    const latest = employeeEvents
      .filter((event) => event.type === "SUGGESTED_DEDUCTION" && event.date >= todayKey)
      .sort((left, right) => left.date.localeCompare(right.date))[0]
      ?? employeeEvents.filter((event) => event.type !== "SUGGESTED_DEDUCTION").sort((left, right) => right.date.localeCompare(left.date))[0];
    if (latest) {
      setSelectedDate(latest.date);
      setVisibleMonth(getMonthStart(latest.date));
    }
  }

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[rgba(121,150,118,0.22)] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e2f2d9] text-[#176b4d]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Advance Activity</h2>
            <p className="mt-1 text-sm text-stone-600">Actual movements plus optional repayment guides based on each employee&apos;s payroll schedule.</p>
          </div>
        </div>
        <div ref={pickerRef} className="relative w-full lg:max-w-[260px]">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl border border-[rgba(121,150,118,0.34)] bg-white px-2.5 py-2 text-left shadow-sm hover:bg-[#f8fbf6]"
            aria-expanded={pickerOpen}
            aria-label="Filter advance activity by employee"
          >
            {selectedEmployee ? (
              <EmployeeAvatar name={selectedEmployee.fullName} photoDataUrl={selectedEmployee.photoDataUrl} size="sm" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e7f3e7] text-[#176b4d]"><UsersRound className="h-4 w-4" /></span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Viewing</span>
              <span className="block truncate text-sm font-semibold text-stone-800">{selectedEmployee?.fullName ?? "All employees"}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition ${pickerOpen ? "rotate-180" : ""}`} />
          </button>
          {pickerOpen ? (
            <div className="absolute right-0 z-30 mt-2 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-2xl border border-[rgba(121,150,118,0.28)] bg-white p-1.5 shadow-xl shadow-stone-900/10">
              <button type="button" onClick={() => selectEmployee("all")} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[#f1f6ee]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e7f3e7] text-[#176b4d]"><UsersRound className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">All employees</span>
                {employeeId === "all" ? <Check className="h-4 w-4 text-[#176b4d]" /> : null}
              </button>
              {employees.map((employee) => (
                <button key={employee.id} type="button" onClick={() => selectEmployee(employee.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[#f1f6ee]">
                  <EmployeeAvatar name={employee.fullName} photoDataUrl={employee.photoDataUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">{employee.fullName}</span>
                  {employeeId === employee.id ? <Check className="h-4 w-4 text-[#176b4d]" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[rgba(121,150,118,0.18)] border-b border-[rgba(121,150,118,0.22)] bg-[#f8fbf6]">
        {[
          { label: "Issued", value: filteredTotals.issued, tone: "text-[#176b4d]" },
          { label: "Deducted", value: filteredTotals.deducted, tone: "text-[#9a5b05]" },
          { label: "Outstanding", value: filteredTotals.outstanding, tone: "text-stone-950" }
        ].map((total) => (
          <div key={total.label} className="min-w-0 px-2 py-3 text-center sm:px-4 sm:py-4">
            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:text-[11px]">{total.label}</div>
            <div className={`mt-1 truncate text-xs font-semibold sm:text-base ${total.tone}`} title={formatMoney(total.value)}>
              {formatMoney(total.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 p-4 sm:p-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="secondary-action h-9 w-9 shrink-0 p-0"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <div className="section-title">Calendar</div>
              <div className="mt-0.5 truncate text-base font-semibold text-stone-950 sm:text-lg">
                {new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(visibleMonth)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="secondary-action h-9 w-9 shrink-0 p-0"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(121,150,118,0.24)]">
            <div className="grid grid-cols-7 bg-[#f1f6ee]">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div key={`${day}-${index}`} className="py-2.5 text-center text-[10px] font-semibold text-[#66746a] lg:text-[11px]">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map(({ key, date, inMonth }, index) => {
                const dayEvents = eventsByDate.get(key) ?? [];
                const issued = dayEvents.filter((event) => event.type === "ADVANCE" && event.status !== "CANCELLED").reduce((sum, event) => sum + Number(event.amount), 0);
                const deducted = dayEvents.filter((event) => event.type === "DEDUCTION").reduce((sum, event) => sum + Number(event.amount), 0);
                const suggested = dayEvents.filter((event) => event.type === "SUGGESTED_DEDUCTION").reduce((sum, event) => sum + Number(event.amount), 0);
                const selected = selectedDate === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={`relative min-h-[54px] min-w-0 border-t px-1 py-1.5 text-left lg:min-h-[82px] lg:px-2 lg:py-2 ${index % 7 !== 6 ? "border-r" : ""} ${
                      selected ? "bg-[#fff7df] ring-2 ring-inset ring-amber-300" : inMonth ? "bg-white hover:bg-[#f8fbf6]" : "bg-stone-50/70 text-stone-400 hover:bg-stone-50"
                    }`}
                  >
                    <div className={`text-[11px] font-semibold lg:text-sm ${inMonth ? "text-stone-800" : "text-stone-400"}`}>{date.getDate()}</div>
                    <div className="absolute inset-x-1 bottom-2 flex items-center justify-center gap-1 lg:static lg:mt-2 lg:block lg:space-y-1">
                      {issued > 0 ? <div className="h-2 w-2 overflow-hidden rounded-full bg-emerald-500 text-[0] lg:h-auto lg:w-auto lg:truncate lg:rounded-md lg:bg-emerald-50 lg:px-1.5 lg:py-0.5 lg:text-[9px] lg:font-semibold lg:text-emerald-700">+{formatMoney(issued)}</div> : null}
                      {deducted > 0 ? <div className="h-2 w-2 overflow-hidden rounded-full bg-amber-500 text-[0] lg:h-auto lg:w-auto lg:truncate lg:rounded-md lg:bg-amber-50 lg:px-1.5 lg:py-0.5 lg:text-[9px] lg:font-semibold lg:text-amber-700">-{formatMoney(deducted)}</div> : null}
                      {suggested > 0 ? <div className="h-2 w-2 overflow-hidden rounded-full bg-sky-400 text-[0] ring-2 ring-sky-100 lg:h-auto lg:w-auto lg:truncate lg:rounded-md lg:border lg:border-dashed lg:border-sky-300 lg:bg-sky-50 lg:px-1.5 lg:py-0.5 lg:text-[9px] lg:font-semibold lg:text-sky-700 lg:ring-0">{formatMoney(suggested)} guide</div> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-stone-500 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Advance issued</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> Payroll deduction</span>
            <span className="col-span-2 inline-flex items-center gap-2 sm:col-span-1"><span className="h-2 w-2 rounded-full bg-sky-400 ring-2 ring-sky-100" /> Suggested repayment guide</span>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[rgba(121,150,118,0.24)] bg-[#fcfdfb]">
          <div className="border-b border-[rgba(121,150,118,0.18)] px-4 py-3">
            <div className="section-title">Selected Date</div>
            <div className="mt-1 font-semibold text-stone-950">{formatDate(selectedDate)}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {selectedIssued > 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">+{formatMoney(selectedIssued)}</span> : null}
              {selectedDeducted > 0 ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">-{formatMoney(selectedDeducted)}</span> : null}
              {selectedSuggested > 0 ? <span className="rounded-full border border-dashed border-sky-300 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">{formatMoney(selectedSuggested)} suggested</span> : null}
            </div>
            {selectedSuggested > 0 ? (
              <div className="mt-2 text-xs leading-5 text-sky-700">
                Guide only. Actual deduction may be lower depending on available net pay and other open advances.
              </div>
            ) : null}
          </div>

          <div className="max-h-[420px] overflow-y-auto px-4 py-2 pb-5">
            {selectedEvents.length ? (
              <div className="divide-y divide-[rgba(121,150,118,0.18)]">
                {selectedEvents.map((event) => {
                  const isAdvance = event.type === "ADVANCE";
                  const isSuggested = event.type === "SUGGESTED_DEDUCTION";
                  const Icon = isAdvance ? ArrowUpRight : isSuggested ? CalendarClock : ArrowDownLeft;
                  return (
                    <div key={event.id} className="flex min-w-0 gap-3 py-3">
                      <div className="relative mt-0.5 shrink-0">
                        <EmployeeAvatar name={event.employeeName} photoDataUrl={employeePhotos.get(event.employeeId) ?? null} />
                        <span className={`absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${isAdvance ? "bg-emerald-500 text-white" : isSuggested ? "bg-sky-400 text-white" : "bg-amber-500 text-white"}`}>
                          <Icon className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="truncate text-sm font-semibold text-stone-950">{event.employeeName}</div>
                          <div className={`text-sm font-semibold ${isAdvance ? "text-emerald-700" : isSuggested ? "text-sky-700" : "text-amber-700"}`}>
                            {isAdvance ? "+" : isSuggested ? "" : "-"}{formatMoney(event.amount)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {isAdvance ? "Advance issued" : isSuggested ? "Suggested repayment date only" : event.balanceBefore && event.balanceAfter ? `${formatMoney(event.balanceBefore)} to ${formatMoney(event.balanceAfter)}` : "Deducted through payroll"}
                        </div>
                        {isSuggested && event.balanceBefore && event.balanceAfter ? <div className="mt-1 text-xs text-sky-700">Guide balance: {formatMoney(event.balanceBefore)} to {formatMoney(event.balanceAfter)}</div> : null}
                        {event.reason ? <div className="mt-1 line-clamp-2 text-xs text-stone-600">{event.reason}</div> : null}
                        {isSuggested ? <span className="mt-2 inline-flex rounded-full border border-dashed border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-sky-700">GUIDE ONLY</span> : null}
                        {event.status === "CANCELLED" ? <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Cancelled</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center">
                <WalletCards className="mx-auto h-6 w-6 text-stone-300" />
                <div className="mt-2 text-sm font-medium text-stone-600">No advance movement on this date.</div>
                <div className="mt-1 text-xs text-stone-500">Choose a date with a green or amber marker.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasLegacyDeductions ? (
        <div className="border-t border-[rgba(121,150,118,0.18)] bg-amber-50/70 px-4 py-3 text-xs text-amber-800 sm:px-5">
          Some older deducted amounts predate detailed payroll audit history, so they are included in totals but may not appear on an exact calendar date.
        </div>
      ) : null}
    </section>
  );
}
