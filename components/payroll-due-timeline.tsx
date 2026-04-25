"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, CheckCheck, ChevronRight, Coins, ReceiptText, UsersRound, WalletCards, X } from "lucide-react";
import {
  markPayrollPaidForDateAction,
  setPayrollAdvanceDeductionAction,
  setPayrollBonusAction,
  setPayrollOtherDeductionAction
} from "@/app/actions";
import { formatDate, formatMoney, parseDateInputValue } from "@/lib/utils";

export type TimelineEmployeeDetail = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  photoDataUrl: string | null;
  position: string | null;
  frequencyLabel: string;
  periodLabel: string;
  calendarMode: "weekday" | "date";
  attendanceCalendarDays: Array<{
    dateValue: string;
    dayLabel: string;
    dateLabel: string;
    status: "PRESENT" | "HALF_DAY" | "ABSENT" | "NO_WORK";
  }>;
  absentDates: string[];
  halfDayDates: string[];
  daysAbsent: number;
  daysHalf: number;
  estimatedDays: number;
  paidDayUnits: number;
  dailyRate: number;
  grossPay: number;
  bonusesAdded: number;
  manualBonusAmount: number;
  advancesDeducted: number;
  manualAdvanceDeductionAmount: number;
  outstandingAdvanceBalance: number;
  payablesDeducted: number;
  manualOtherDeductionAmount: number;
  expectedAmount: number;
};

function formatDateList(values: string[]) {
  return values.map((value) => formatDate(value)).join(", ");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function PayrollAvatar({ detail, size = "sm" }: { detail: Pick<TimelineEmployeeDetail, "employeeName" | "photoDataUrl">; size?: "xs" | "sm" }) {
  const sizeClass = size === "xs" ? "h-6 w-6 rounded-lg text-[10px]" : "h-9 w-9 rounded-xl text-xs";

  return (
    <span className={`inline-grid ${sizeClass} shrink-0 place-items-center overflow-hidden border border-white/80 bg-[linear-gradient(135deg,#e6f1ed_0%,#edf3fa_100%)] font-semibold text-[#678c84] shadow-sm`}>
      {detail.photoDataUrl ? <img src={detail.photoDataUrl} alt="" className="h-full w-full object-cover" /> : initials(detail.employeeName)}
    </span>
  );
}

function PayrollAvatarStack({ details }: { details: TimelineEmployeeDetail[] }) {
  const visibleDetails = details.slice(0, 4);
  const remaining = details.length - visibleDetails.length;

  return (
    <span className="inline-flex items-center">
      {visibleDetails.map((detail, index) => (
        <span key={detail.employeeId} className={index ? "-ml-2" : ""} title={detail.employeeName}>
          <PayrollAvatar detail={detail} size="xs" />
        </span>
      ))}
      {remaining > 0 ? (
        <span className="-ml-2 inline-grid h-6 min-w-6 place-items-center rounded-lg border border-white/80 bg-[rgba(230,241,237,0.96)] px-1 text-[10px] font-semibold text-[#5f8f85] shadow-sm">
          +{remaining}
        </span>
      ) : null}
    </span>
  );
}

const attendanceDayStyle = {
  PRESENT: "border-emerald-200 bg-emerald-100 text-emerald-800",
  HALF_DAY: "border-amber-200 bg-amber-100 text-amber-800",
  ABSENT: "border-rose-200 bg-rose-100 text-rose-800",
  NO_WORK: "border-stone-200 bg-stone-100 text-stone-500"
} as const;

const attendanceDayTitle = {
  PRESENT: "Present",
  HALF_DAY: "Half-day",
  ABSENT: "Absent",
  NO_WORK: "No work day"
} as const;

export type TimelineEntry = {
  id: string;
  payDateValue: string;
  payDateLabel: string;
  dueLabel: string;
  isPaid: boolean;
  expectedTotal: number;
  employeeNames: string[];
  details: TimelineEmployeeDetail[];
};

function isOverdueEntry(entry: TimelineEntry) {
  return !entry.isPaid && entry.dueLabel.toLowerCase().startsWith("overdue");
}

function isTodayEntry(entry: TimelineEntry) {
  return !entry.isPaid && entry.dueLabel === "Today";
}

export function PayrollTimelineModal({
  entry,
  open,
  onClose,
  mode = "compact",
  allowMarkPaid = true
}: {
  entry: TimelineEntry | null;
  open: boolean;
  onClose: () => void;
  mode?: "compact" | "full";
  allowMarkPaid?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [editingAdjustmentKey, setEditingAdjustmentKey] = useState<string | null>(null);

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

  if (!mounted || !open || !entry) return null;

  const canEditAdjustment = (key: string, value: number) => value <= 0 || editingAdjustmentKey === key;
  const handleAdjustmentClick = (event: React.MouseEvent<HTMLButtonElement>, key: string, value: number) => {
    if (value > 0 && editingAdjustmentKey !== key) {
      event.preventDefault();
      setEditingAdjustmentKey(key);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Payroll Details</div>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">{entry.payDateLabel}</h2>
            <p className="mt-1 text-sm text-[#7a7168]">
              {entry.details.length} employee{entry.details.length > 1 ? "s" : ""} due for payout. Estimated take-home total {formatMoney(entry.expectedTotal)} after deductions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {entry.isPaid ? (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <CheckCheck className="h-4 w-4" />
                Paid
              </div>
            ) : allowMarkPaid ? (
              <form action={markPayrollPaidForDateAction}>
                <input type="hidden" name="payDate" value={entry.payDateValue} />
                {mode === "full" ? <input type="hidden" name="redirectTo" value="/payroll" /> : null}
                <button className="inline-flex items-center gap-2 rounded-2xl bg-[#0f766e] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0b5f59]">
                  <CheckCheck className="h-4 w-4" />
                  Mark as Paid
                </button>
              </form>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(197,222,244,0.9)] bg-[rgba(232,244,255,0.8)] px-3 py-2 text-sm font-semibold text-[#44739f]">
                <WalletCards className="h-4 w-4" />
                {entry.dueLabel}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
              aria-label="Close payroll details modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {entry.details.map((detail) => {
            const bonusEditKey = `${entry.payDateValue}-${detail.employeeId}-bonus`;
            const advanceEditKey = `${entry.payDateValue}-${detail.employeeId}-advance`;
            const deductionEditKey = `${entry.payDateValue}-${detail.employeeId}-deduction`;
            const bonusEditable = canEditAdjustment(bonusEditKey, detail.manualBonusAmount);
            const advanceEditable = detail.outstandingAdvanceBalance > 0 && canEditAdjustment(advanceEditKey, detail.manualAdvanceDeductionAmount);
            const deductionEditable = canEditAdjustment(deductionEditKey, detail.manualOtherDeductionAmount);

            return (
            <div
              key={detail.employeeId}
              className="rounded-[22px] border border-[rgba(148,190,139,0.36)] bg-[rgba(255,255,255,0.92)] px-3 py-4 sm:rounded-[24px] sm:px-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <PayrollAvatar detail={detail} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">{detail.employeeCode}</div>
                    <h3 className="mt-1 truncate text-base font-semibold text-stone-950">{detail.employeeName}</h3>
                    <p className="mt-1 truncate text-sm text-[#7a7168]">{detail.position || "No position assigned"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[rgba(229,245,224,0.92)] px-2.5 py-1 font-medium text-stone-700">{detail.frequencyLabel}</span>
                      <span className="rounded-full bg-[rgba(229,245,224,0.92)] px-2.5 py-1 font-medium text-stone-700">{detail.periodLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="w-full rounded-[18px] bg-[rgba(230,241,237,0.74)] px-3 py-2 text-left sm:w-auto sm:min-w-[172px] sm:text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f8f85]">Expected Take-Home</div>
                  <div className="mt-1 text-base font-semibold text-[#2d6258]">{formatMoney(detail.expectedAmount)}</div>
                </div>
              </div>

              <div className="mt-4 grid items-start gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="min-w-0 rounded-[20px] bg-[rgba(229,245,224,0.86)] px-3 py-4 text-sm text-stone-700 sm:px-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Attendance Summary</div>
                  <div className="mt-3 max-h-[18.75rem] overflow-y-auto pr-1">
                    <div className="grid grid-cols-7 gap-1.5">
                      {detail.attendanceCalendarDays.map((day) => (
                        <div
                          key={day.dateValue}
                          title={`${formatDate(day.dateValue)} - ${attendanceDayTitle[day.status]}`}
                          className={`grid h-9 min-w-0 place-items-center rounded-xl border text-[11px] font-semibold ${attendanceDayStyle[day.status]}`}
                        >
                          {detail.calendarMode === "weekday" ? day.dayLabel : day.dateLabel}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Present</span>
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">Absent</span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Half-day</span>
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-500">No work</span>
                    </div>
                  </div>
                  <div className="mt-2 font-medium text-stone-950">
                    {detail.paidDayUnits} paid day equivalent from {detail.estimatedDays} full day{detail.estimatedDays !== 1 ? "s" : ""}, {detail.daysHalf} half day{detail.daysHalf !== 1 ? "s" : ""}, and {detail.daysAbsent} absent day{detail.daysAbsent !== 1 ? "s" : ""}.
                  </div>
                  {detail.absentDates.length ? (
                    <div className="mt-3 text-[#7a7168]">Absent: {formatDateList(detail.absentDates)}</div>
                  ) : null}
                  {detail.halfDayDates.length ? (
                    <div className="mt-1 text-[#7a7168]">Half day: {formatDateList(detail.halfDayDates)}</div>
                  ) : null}
                  <div className="mt-3 text-[#7a7168]">Daily rate: {formatMoney(detail.dailyRate)}</div>
                </div>

                <div className="min-w-0 rounded-[20px] bg-[rgba(229,245,224,0.86)] px-3 py-4 sm:px-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Math Breakdown</div>
                    <div className="mt-3 space-y-2.5 text-sm text-stone-700">
                      <div className="flex items-center justify-between gap-4 rounded-[16px] bg-white/80 px-3 py-2">
                        <div>
                          <div className="font-medium text-stone-950">Base pay</div>
                          <div className="text-[#7a7168]">{detail.paidDayUnits} x {formatMoney(detail.dailyRate)}</div>
                        </div>
                        <div className="shrink-0 font-semibold text-stone-950">{formatMoney(detail.grossPay)}</div>
                      </div>

                      <div className="rounded-[16px] bg-white/80 px-3 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-stone-950">Add bonuses</div>
                            {detail.manualBonusAmount > 0 ? <div className="text-xs text-[#7a7168]">Includes manual payroll bonus</div> : null}
                          </div>
                          <div className="shrink-0 font-semibold text-[#0f6f67]">+ {formatMoney(detail.bonusesAdded)}</div>
                        </div>
                        {!entry.isPaid ? (
                          <form action={setPayrollBonusAction} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input type="hidden" name="employeeId" value={detail.employeeId} />
                            <input type="hidden" name="payDate" value={entry.payDateValue} />
                            {mode === "full" ? <input type="hidden" name="redirectTo" value="/payroll" /> : null}
                            <input
                              name="amount"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={detail.manualBonusAmount || ""}
                              placeholder="Manual amount"
                              aria-label={`Manual bonus for ${detail.employeeName}`}
                              readOnly={!bonusEditable}
                              className="min-w-0 rounded-xl px-3 py-2 text-xs"
                            />
                            <button
                              onClick={(event) => handleAdjustmentClick(event, bonusEditKey, detail.manualBonusAmount)}
                              className="rounded-xl bg-[#0f6f67] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0b5f59]"
                            >
                              {detail.manualBonusAmount > 0 && editingAdjustmentKey !== bonusEditKey ? "Edit" : "Save"}
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="rounded-[16px] bg-white/80 px-3 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-stone-950">
                              Less advances
                              <span className="ml-1 font-normal text-[#7a7168]">
                                ({detail.outstandingAdvanceBalance > 0 ? `${formatMoney(detail.outstandingAdvanceBalance)} left` : "no outstanding balance"})
                              </span>
                            </div>
                            {detail.manualAdvanceDeductionAmount > 0 ? (
                              <div className="text-xs text-[#7a7168]">Includes manual payroll advance</div>
                            ) : null}
                          </div>
                          <div className="shrink-0 font-semibold text-[#8d5f14]">- {formatMoney(detail.advancesDeducted)}</div>
                        </div>
                        {!entry.isPaid ? (
                          <form action={setPayrollAdvanceDeductionAction} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input type="hidden" name="employeeId" value={detail.employeeId} />
                            <input type="hidden" name="payDate" value={entry.payDateValue} />
                            {mode === "full" ? <input type="hidden" name="redirectTo" value="/payroll" /> : null}
                            <input
                              name="amount"
                              type="number"
                              min="0"
                              max={detail.outstandingAdvanceBalance > 0 ? detail.outstandingAdvanceBalance : undefined}
                              step="0.01"
                              defaultValue={detail.manualAdvanceDeductionAmount || ""}
                              placeholder="Manual amount"
                              aria-label={`Manual advance deduction for ${detail.employeeName}`}
                              disabled={detail.outstandingAdvanceBalance <= 0}
                              readOnly={!advanceEditable}
                              className="min-w-0 rounded-xl px-3 py-2 text-xs"
                            />
                            <button
                              onClick={(event) => handleAdjustmentClick(event, advanceEditKey, detail.manualAdvanceDeductionAmount)}
                              disabled={detail.outstandingAdvanceBalance <= 0}
                              className="rounded-xl bg-[#8d5f14] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#744d10] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {detail.manualAdvanceDeductionAmount > 0 && editingAdjustmentKey !== advanceEditKey ? "Edit" : "Save"}
                            </button>
                          </form>
                        ) : null}
                    </div>

                    <div className="rounded-[16px] bg-white/80 px-3 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-stone-950">Less other deductions</div>
                          {detail.manualOtherDeductionAmount > 0 ? (
                            <div className="text-xs text-[#7a7168]">Includes manual payroll deduction</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 font-semibold text-[#8d5f14]">- {formatMoney(detail.payablesDeducted)}</div>
                      </div>
                      {!entry.isPaid ? (
                        <form action={setPayrollOtherDeductionAction} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <input type="hidden" name="employeeId" value={detail.employeeId} />
                          <input type="hidden" name="payDate" value={entry.payDateValue} />
                          {mode === "full" ? <input type="hidden" name="redirectTo" value="/payroll" /> : null}
                          <input
                            name="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={detail.manualOtherDeductionAmount || ""}
                            placeholder="Manual amount"
                            aria-label={`Manual other deduction for ${detail.employeeName}`}
                            readOnly={!deductionEditable}
                            className="min-w-0 rounded-xl px-3 py-2 text-xs"
                          />
                          <button
                            onClick={(event) => handleAdjustmentClick(event, deductionEditKey, detail.manualOtherDeductionAmount)}
                            className="rounded-xl bg-[#8d5f14] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#744d10]"
                          >
                            {detail.manualOtherDeductionAmount > 0 && editingAdjustmentKey !== deductionEditKey ? "Edit" : "Save"}
                          </button>
                        </form>
                      ) : null}
                    </div>

                      <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[rgba(160,205,190,0.9)] bg-[rgba(236,247,243,0.96)] px-3 py-3">
                        <div>
                          <div className="font-semibold text-[#2d6258]">Expected take-home</div>
                        </div>
                        <div className="shrink-0 text-lg font-semibold text-[#2d6258]">{formatMoney(detail.expectedAmount)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PayrollDueTimeline({ entries, todayValue, mode = "compact" }: { entries: TimelineEntry[]; todayValue: string; mode?: "compact" | "full" }) {
  const [activeEntry, setActiveEntry] = useState<TimelineEntry | null>(null);
  const todayDate = parseDateInputValue(todayValue);
  const todayLabel = formatDate(todayDate);
  const hasTodayEntry = entries.some((entry) => entry.payDateValue === todayValue);
  const firstFutureIndex = entries.findIndex((entry) => entry.payDateValue >= todayValue);
  const markerIndex = hasTodayEntry ? -1 : firstFutureIndex === -1 ? entries.length : firstFutureIndex;
  const timelineItems = hasTodayEntry
    ? entries.map((entry) => ({ type: "entry" as const, entry }))
    : [
        ...entries.slice(0, markerIndex).map((entry) => ({ type: "entry" as const, entry })),
        { type: "today" as const },
        ...entries.slice(markerIndex).map((entry) => ({ type: "entry" as const, entry }))
      ];

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-[rgba(226,219,211,0.82)] px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7f73]">Due Timeline</div>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                {mode === "full" ? "Sahod timeline" : "Upcoming sahod days"}
              </h2>
              <p className="mt-1 text-sm text-[#7a7168]">
                {mode === "full"
                  ? "Open any sahod day to inspect attendance, additions, deductions, and expected take-home pay."
                  : "Quick scan of scheduled payroll payouts for your active employees."}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(197,222,244,0.9)] bg-[rgba(232,244,255,0.8)] px-3 py-2 text-sm font-semibold text-[#44739f]">
              <CalendarClock className="h-4 w-4" />
              {entries.length} upcoming date{entries.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {entries.length ? (
          <div className="px-5 py-4">
            <div className="space-y-1">
              {timelineItems.map((item, index) => {
                const showConnector = index !== timelineItems.length - 1;

                if (item.type === "today") {
                  return (
                    <div
                      key={`today-${todayValue}`}
                      className="relative flex flex-col gap-3 rounded-[24px] border border-[#f0d48a] bg-[#fff4d8] px-3 py-4 shadow-[inset_4px_0_0_#d97706] sm:px-4"
                    >
                      {showConnector ? (
                        <span className="absolute left-[18px] top-[52px] h-[calc(100%-2.5rem)] w-px bg-[#e5c676] sm:left-[19px]" />
                      ) : null}

                      <div className="flex items-start gap-4">
                        <div className="relative z-[1] mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#d97706] bg-white shadow-sm">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#d97706]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="text-xl font-semibold tracking-[-0.03em] text-[#9a5b05]">{todayLabel}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#7c5f2a]">
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a5b05]">
                                  <WalletCards className="h-3.5 w-3.5" />
                                  Today
                                </span>
                                <span className="truncate">You are here in the payroll timeline.</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm font-semibold text-[#9a5b05]">
                              <span>Today</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const entry = item.entry;
                const overdue = isOverdueEntry(entry);
                const today = isTodayEntry(entry);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActiveEntry(entry)}
                    className={`group relative flex w-full flex-col gap-3 rounded-[24px] px-3 py-4 text-left transition sm:px-4 ${
                      entry.isPaid
                        ? "bg-[rgba(232,246,238,0.82)] hover:bg-[rgba(224,242,232,0.92)]"
                        : overdue
                          ? "bg-[rgba(255,241,236,0.82)] hover:bg-[rgba(255,235,228,0.92)]"
                          : today
                            ? "border border-[#f0d48a] bg-[#fff4d8] shadow-[inset_4px_0_0_#d97706] hover:bg-[#ffecc0]"
                            : index === 0
                            ? "bg-[rgba(244,248,252,0.64)] hover:bg-[rgba(244,248,252,0.82)]"
                            : "hover:bg-[rgba(244,248,252,0.76)]"
                    } ${
                      index === 0 && !entry.isPaid && !overdue ? "bg-[rgba(244,248,252,0.64)]" : ""
                    }`}
                  >
                    {showConnector ? (
                      <span className="absolute left-[18px] top-[52px] h-[calc(100%-2.5rem)] w-px bg-[rgba(214,205,194,0.86)] sm:left-[19px]" />
                    ) : null}

                    <div className="flex items-start gap-4">
                      <div className={`relative z-[1] mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm ${
                        entry.isPaid ? "border-emerald-500" : overdue ? "border-[#ea580c]" : today ? "border-[#d97706]" : "border-[#0f92f2]"
                      }`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          entry.isPaid ? "bg-emerald-500" : overdue ? "bg-[#ea580c]" : today ? "bg-[#d97706]" : "bg-[#0f92f2]"
                        }`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className={`text-xl font-semibold tracking-[-0.03em] ${
                              entry.isPaid ? "text-emerald-700" : overdue ? "text-[#ea580c]" : today ? "text-[#9a5b05]" : "text-[#1988d8]"
                            }`}>{entry.payDateLabel}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#6d756f]">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                entry.isPaid
                                  ? "bg-emerald-50 text-emerald-700"
                                  : overdue
                                    ? "bg-orange-50 text-[#ea580c]"
                                    : today
                                      ? "bg-white text-[#9a5b05]"
                                    : "bg-[rgba(232,244,255,0.88)] text-[#1677c5]"
                              }`}>
                                <WalletCards className="h-3.5 w-3.5" />
                                {entry.isPaid ? "Paid Payroll" : overdue ? "Overdue" : "Sahod Day"}
                              </span>
                              <PayrollAvatarStack details={entry.details} />
                              <span className="truncate">
                                {entry.employeeNames.join(", ")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 lg:min-w-[220px] lg:justify-end">
                            <div className="text-left lg:text-right">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f73]">Expected Total</div>
                              <div className="mt-1 text-base font-semibold text-stone-950">{formatMoney(entry.expectedTotal)}</div>
                            </div>
                            <div className={`flex items-center gap-2 text-sm font-semibold ${
                              entry.isPaid ? "text-emerald-700" : overdue ? "text-[#ea580c]" : today ? "text-[#9a5b05]" : "text-[#1677c5]"
                            }`}>
                              <span>{entry.dueLabel}</span>
                              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#7a7168]">
                          <span className="inline-flex items-center gap-1">
                            <UsersRound className="h-3.5 w-3.5 text-[#6f9c90]" />
                            {entry.details.length} employee{entry.details.length > 1 ? "s" : ""}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5 text-[#d28b2d]" />
                            Advances and deductions included
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ReceiptText className="h-3.5 w-3.5 text-[#1988d8]" />
                            Tap for breakdown
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-[#7a7168]">No scheduled payroll due dates yet. Add active employees with payroll schedules to populate this timeline.</div>
        )}
      </section>

      <PayrollTimelineModal entry={activeEntry} open={Boolean(activeEntry)} onClose={() => setActiveEntry(null)} mode={mode} />
    </>
  );
}
