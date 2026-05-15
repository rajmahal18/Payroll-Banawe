"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleDollarSign, Gift, Plus, ReceiptText, X } from "lucide-react";

const actions = [
  { href: "/advances?tab=bonuses", label: "Record Bonus", icon: Gift, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { href: "/advances", label: "Record Advance", icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { href: "/payroll", label: "Open Payroll", icon: ReceiptText, tone: "bg-[#e7f3e7] text-[#176b4d] border-[#bfd9c8]" }
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
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-stone-800 shadow-lg shadow-stone-900/10"
              >
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${action.tone}`}>
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
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#176b4d] text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#10583e]"
      >
        {open ? <X className="fab-icon-flash h-5 w-5" /> : <Plus className="fab-icon-flash h-5 w-5" />}
      </button>
    </div>
  );
}
