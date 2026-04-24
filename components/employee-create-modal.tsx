"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { createEmployeeAction } from "@/app/actions";
import { PayrollScheduleFields } from "@/components/employee-payroll-schedule-fields";

export function EmployeeCreateModal() {
  const [open, setOpen] = useState(false);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-[#6f9c90] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(111,156,144,0.32)] transition hover:bg-[#628b81]"
      >
        <UserPlus className="h-4 w-4" />
        Add Employee
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(52,47,43,0.34)] p-3 sm:items-center sm:p-6">
              <div className="w-full max-w-3xl rounded-[28px] border border-[rgba(218,210,200,0.8)] bg-[rgba(255,252,248,0.98)] shadow-[0_28px_60px_-30px_rgba(82,66,51,0.28)]">
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">Add Employee</h2>
                    <p className="mt-1 text-sm text-[#7a7168]">Create a new employee record without leaving the list.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(218,210,200,0.82)] bg-white text-stone-500 transition hover:bg-[#faf7f2] hover:text-stone-900"
                    aria-label="Close add employee modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form action={createEmployeeAction} className="grid gap-4 px-5 py-5 md:grid-cols-2">
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
                  <PayrollScheduleFields />
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                    <textarea name="notes" rows={3} placeholder="Optional notes" />
                  </div>
                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-2xl border border-[rgba(218,210,200,0.82)] bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-[#faf7f2]"
                    >
                      Cancel
                    </button>
                    <button className="rounded-2xl bg-[#6f9c90] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#628b81]">
                      Save Employee
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
