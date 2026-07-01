"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronRight, CircleDollarSign, X } from "lucide-react";
import { deleteAdvanceAction, updateAdvanceAction } from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/utils";

type EmployeeOption = {
  id: string;
  fullName: string;
};

type AdvanceItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: string;
  deductionPerPayroll: string | null;
  deductedAmount: string;
  remainingBalance: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  reason: string;
  deductions: AdvanceDeductionItem[];
};

type AdvanceDeductionItem = {
  id: string;
  payDate: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
};

const PAGE_SIZE = 10;

export function AdvanceManager({ advances, employees }: { advances: AdvanceItem[]; employees: EmployeeOption[] }) {
  const [selected, setSelected] = useState<AdvanceItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selected) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selected]);
  useEffect(() => {
    setPage(1);
  }, [advances.length]);

  const totalPages = Math.max(Math.ceil(advances.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const visibleAdvances = advances.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const getStatusClass = (status: AdvanceItem["status"]) =>
    status === "OPEN"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CLOSED"
        ? "bg-stone-100 text-stone-600"
        : "bg-rose-50 text-rose-700";
  const getLegacyDeductedAmount = (advance: AdvanceItem) => {
    const auditedAmount = advance.deductions.reduce((total, deduction) => total + Number(deduction.amount), 0);
    return Math.max(Number(advance.deductedAmount) - auditedAmount, 0);
  };

  return (
    <>
      <section className="panel min-w-0 overflow-hidden">
        <div className="border-b border-[rgba(121,150,118,0.22)] px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-lg font-semibold text-stone-950">Advance Records</h2>
          <p className="mt-1 text-sm text-stone-600">Open an advance to edit its deduction or status.</p>
        </div>

        <div className="divide-y divide-[rgba(121,150,118,0.18)]">
          {advances.length ? (
            visibleAdvances.map((advance) => (
              <button
                key={advance.id}
                type="button"
                onClick={() => setSelected(advance)}
                className="grid w-full min-w-0 gap-3 px-4 py-3 text-left transition hover:bg-[#f8fbf6] focus:bg-[#f8fbf6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[rgba(23,107,77,0.14)] sm:px-5 sm:py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-stone-950">{advance.employeeName}</div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] ${getStatusClass(advance.status)}`}>
                      {advance.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-stone-600">{advance.date}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-stone-700">{advance.reason || "No reason added"}</div>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2 text-sm sm:max-w-sm md:min-w-[250px] md:grid-cols-[1fr_1fr_auto] md:justify-items-end">
                  <div className="rounded-xl bg-[#f8fbf6] px-3 py-2 md:w-full md:max-w-[220px]">
                    <div className="section-title text-[10px]">Amount</div>
                    <div className="font-semibold text-stone-950">{formatMoney(advance.amount)}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-3 py-2 md:w-full md:max-w-[220px]">
                    <div className="section-title text-[10px]">Remaining</div>
                    <div className="font-semibold text-[#2f7d5b]">{formatMoney(advance.remainingBalance)}</div>
                  </div>
                  <span className="grid h-full w-9 place-items-center rounded-xl bg-white text-stone-400">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm text-stone-500">No advances yet.</div>
          )}
        </div>
        {advances.length > PAGE_SIZE ? (
          <div className="flex flex-col gap-2 border-t border-[rgba(121,150,118,0.22)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-xs font-medium text-[#7a7168]">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, advances.length)} of {advances.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={currentPage <= 1}
                className="secondary-action px-3 py-2 text-xs disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-stone-600">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="secondary-action px-3 py-2 text-xs disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {mounted && selected
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true">
              <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[rgba(121,150,118,0.28)] bg-white shadow-xl shadow-stone-900/10 sm:max-h-[calc(100vh-3rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8b74]">Manage Advance</div>
                    <h3 className="mt-1 truncate text-xl font-semibold text-stone-950 sm:text-2xl">{selected.employeeName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="secondary-action h-10 w-10 p-0"
                    aria-label="Close advance modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-y-auto px-5 py-4">
                  <form action={updateAdvanceAction} className="space-y-4">
                    <input type="hidden" name="advanceId" value={selected.id} />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-stone-700">Employee</label>
                      <select name="employeeId" defaultValue={selected.employeeId} required>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-700">Date</label>
                        <input name="date" type="date" defaultValue={selected.date} required />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-700">Amount</label>
                        <input name="amount" type="number" min="0" step="0.01" defaultValue={selected.amount} required />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-700">Deduct Per Payroll</label>
                        <input name="deductionPerPayroll" type="number" min="0" step="0.01" defaultValue={selected.deductionPerPayroll ?? ""} placeholder="Full deduction" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-stone-700">Status</label>
                        <select name="status" defaultValue={selected.status} required>
                          <option value="OPEN">Open</option>
                          <option value="CLOSED">Closed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div className="soft-strip p-3 text-sm text-stone-600">
                      Already deducted: <b>{formatMoney(selected.deductedAmount)}</b>. Remaining balance is recalculated after saving.
                    </div>
                    <section className="rounded-2xl border border-[rgba(121,150,118,0.18)] bg-[#fbfcf8] p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8b74]">History</div>
                          <h4 className="mt-1 text-base font-semibold text-stone-950">Advance timeline</h4>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#176b4d] shadow-sm shadow-stone-900/5">
                          {selected.deductions.length} deduction{selected.deductions.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 border-b border-[rgba(121,150,118,0.16)] pb-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div className="font-semibold text-stone-950">Started {formatDate(selected.date)}</div>
                              <div className="text-sm font-semibold text-emerald-700">+{formatMoney(selected.amount)}</div>
                            </div>
                            <div className="mt-1 text-sm text-stone-600">
                              {selected.reason || "No reason added"}
                            </div>
                          </div>
                        </div>

                        {selected.deductions.length ? (
                          selected.deductions.map((deduction) => (
                            <div key={deduction.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-700">
                                <CircleDollarSign className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 border-b border-[rgba(121,150,118,0.16)] pb-3 last:border-b-0 last:pb-0">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <div className="font-semibold text-stone-950">{formatDate(deduction.payDate)}</div>
                                  <div className="text-sm font-semibold text-[#9a5b05]">-{formatMoney(deduction.amount)}</div>
                                </div>
                                <div className="mt-1 text-sm text-stone-600">
                                  Balance {formatMoney(deduction.balanceBefore)} to {formatMoney(deduction.balanceAfter)}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-white px-3 py-3 text-sm text-stone-600 shadow-sm shadow-stone-900/5">
                            No payroll deductions recorded yet.
                          </div>
                        )}

                        {getLegacyDeductedAmount(selected) > 0 ? (
                          <div className="rounded-xl bg-white px-3 py-3 text-sm text-stone-600 shadow-sm shadow-stone-900/5">
                            {formatMoney(getLegacyDeductedAmount(selected))} was already deducted before detailed payroll history was available.
                          </div>
                        ) : null}
                      </div>
                    </section>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-stone-700">Reason</label>
                      <textarea name="reason" rows={3} defaultValue={selected.reason} placeholder="Optional reason" />
                    </div>
                    <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setSelected(null)} className="secondary-action px-4 py-3">Cancel</button>
                      <button className="primary-action px-4 py-3">Save Changes</button>
                    </div>
                  </form>

                  <form action={deleteAdvanceAction} className="mt-3" onSubmit={(event) => { if (!confirm("Delete this advance? This cannot be undone.")) event.preventDefault(); }}>
                    <input type="hidden" name="advanceId" value={selected.id} />
                    <button className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">Delete Advance</button>
                  </form>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
