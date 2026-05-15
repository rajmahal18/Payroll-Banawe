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
        <nav className="pointer-events-auto mx-auto grid max-w-lg grid-cols-4 items-end rounded-2xl border border-[rgba(121,150,118,0.28)] bg-white/95 px-1.5 py-1.5 shadow-[0_-12px_32px_-26px_rgba(15,23,42,0.28)] backdrop-blur-xl">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-[8.5px] font-semibold transition",
                  active ? "text-[#176b4d]" : "text-stone-500"
                )}
                aria-label={item.label}
                title={item.label}
              >
                <span
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-xl border transition",
                    active ? "border-[#bfd9c8] bg-[#e7f3e7] text-[#176b4d]" : "border-transparent text-stone-500"
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
    <nav className="hidden flex-wrap items-center gap-1 md:flex">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition",
              active
                ? "bg-[#e7f3e7] text-[#176b4d] ring-1 ring-[#bfd9c8]"
                : "text-stone-600 hover:bg-[#f1f6ee] hover:text-stone-950"
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
