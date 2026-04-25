"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { deleteBonusAction, updateBonusAction } from "@/app/actions";
import { formatMoney } from "@/lib/utils";

type EmployeeOption = {
  id: string;
  fullName: string;
};

type BonusItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  reason: string;
};

const PAGE_SIZE = 10;

export function BonusManager({ bonuses, employees }: { bonuses: BonusItem[]; employees: EmployeeOption[] }) {
  const [selected, setSelected] = useState<BonusItem | null>(null);
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
  }, [bonuses.length]);

  const totalPages = Math.max(Math.ceil(bonuses.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const visibleBonuses = bonuses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const getStatusClass = (status: BonusItem["status"]) =>
    status === "OPEN"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CLOSED"
        ? "bg-stone-100 text-stone-600"
        : "bg-rose-50 text-rose-700";

  return (
    <>
      <section className="panel min-w-0 overflow-hidden">
        <div className="border-b border-[#d8e8d2] px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-lg font-semibold text-stone-950">Bonus Records</h2>
          <p className="mt-1 text-sm text-stone-600">Open a bonus to edit its amount or status.</p>
        </div>

        <div className="divide-y divide-[#d8e8d2]">
          {bonuses.length ? (
            visibleBonuses.map((bonus) => (
              <button
                key={bonus.id}
                type="button"
                onClick={() => setSelected(bonus)}
                className="grid w-full min-w-0 gap-3 px-4 py-3 text-left transition hover:bg-[#f0f8ec] focus:bg-[#f0f8ec] focus:outline-none sm:px-5 sm:py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-stone-950">{bonus.employeeName}</div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] ${getStatusClass(bonus.status)}`}>
                      {bonus.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-stone-600">{bonus.date}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-stone-700">{bonus.reason || "No reason added"}</div>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-stretch gap-2 text-sm md:min-w-[210px]">
                  <div className="rounded-2xl bg-[#f7fbf4] px-3 py-2 md:text-right">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">Amount</div>
                    <div className="font-semibold text-[#2f7d5b]">{formatMoney(bonus.amount)}</div>
                  </div>
                  <span className="grid h-full w-9 place-items-center rounded-2xl bg-white/70 text-stone-400">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm text-stone-500">No bonuses yet.</div>
          )}
        </div>
        {bonuses.length > PAGE_SIZE ? (
          <div className="flex flex-col gap-2 border-t border-[#d8e8d2] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-xs font-medium text-[#7a7168]">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, bonuses.length)} of {bonuses.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={currentPage <= 1}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-3 py-2 text-xs font-semibold text-stone-700 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-stone-600">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-3 py-2 text-xs font-semibold text-stone-700 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
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
              <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)] sm:max-h-[calc(100vh-3rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8b74]">Manage Bonus</div>
                    <h3 className="mt-1 truncate text-xl font-semibold text-stone-950 sm:text-2xl">{selected.employeeName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
                    aria-label="Close bonus modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-y-auto px-5 py-4">
                  <form action={updateBonusAction} className="space-y-4">
                    <input type="hidden" name="bonusId" value={selected.id} />
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
                    <div>
                      <label className="mb-1 block text-sm font-medium text-stone-700">Status</label>
                      <select name="status" defaultValue={selected.status} required>
                        <option value="OPEN">Open</option>
                        <option value="CLOSED">Closed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-stone-700">Reason</label>
                      <textarea name="reason" rows={3} defaultValue={selected.reason} placeholder="Optional performance note" />
                    </div>
                    <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setSelected(null)} className="rounded-2xl border border-[#cfe3c8] px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-[#eef7e9]">Cancel</button>
                      <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Changes</button>
                    </div>
                  </form>

                  <form action={deleteBonusAction} className="mt-3" onSubmit={(event) => { if (!confirm("Delete this bonus? This cannot be undone.")) event.preventDefault(); }}>
                    <input type="hidden" name="bonusId" value={selected.id} />
                    <button className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">Delete Bonus</button>
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
