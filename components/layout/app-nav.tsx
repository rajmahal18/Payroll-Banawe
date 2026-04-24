"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { payrollNavItems } from "@/lib/payroll-ui";

export function AppNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const items = mobile ? payrollNavItems.filter((item) => item.mobile) : payrollNavItems;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (mobile) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] md:hidden">
        <nav className="pointer-events-auto mx-auto grid max-w-lg grid-cols-4 items-end rounded-[24px] border border-[rgba(218,210,200,0.82)] bg-[rgba(255,251,246,0.96)] px-1.5 py-1.5 shadow-[0_-18px_42px_-28px_rgba(108,89,70,0.18)] backdrop-blur-xl">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-[8.5px] font-semibold transition",
                  active ? "text-[#6f9c90]" : "text-stone-500"
                )}
                aria-label={item.label}
                title={item.label}
              >
                <span
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-xl border transition",
                    active
                      ? "border-[#d6e7e0] bg-[#eef6f3] text-[#6f9c90] shadow-sm"
                      : "border-transparent text-stone-500"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="mt-0.5 w-full truncate text-center leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <nav className="hidden flex-wrap items-center gap-1.5 md:flex">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition",
              active
                ? "bg-[linear-gradient(135deg,#e8f0e9_0%,#e4f1ed_55%,#e8eef7_100%)] text-[#6f9c90] shadow-[0_14px_28px_-18px_rgba(111,156,144,0.18)] ring-1 ring-[rgba(205,225,218,0.9)]"
                : "bg-[rgba(255,251,246,0.92)] text-stone-600 ring-1 ring-[rgba(218,210,200,0.8)] hover:bg-[rgba(255,255,253,0.98)] hover:text-stone-950"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
