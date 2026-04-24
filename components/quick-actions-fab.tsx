"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleDollarSign, Gift, Plus, ReceiptText, X } from "lucide-react";

const actions = [
  { href: "/bonuses", label: "Record Bonus", icon: Gift, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { href: "/advances", label: "Record Advance", icon: CircleDollarSign, tone: "bg-lime-50 text-lime-700 border-lime-200" },
  { href: "/payroll", label: "Open Payroll", icon: ReceiptText, tone: "bg-[#edf7ef] text-[#2f7d5b] border-[#cfe9d6]" }
] as const;

export function QuickActionsFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open ? (
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-2xl border bg-[rgba(250,255,247,0.98)] px-3 py-2 text-sm font-semibold text-stone-800 shadow-[0_18px_40px_-26px_rgba(22,78,43,0.24)]"
              >
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${action.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16784f] text-white shadow-[0_24px_46px_-24px_rgba(22,120,79,0.48)] transition hover:bg-[#14532d]"
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}
