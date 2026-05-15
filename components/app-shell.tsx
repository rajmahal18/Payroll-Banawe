import Link from "next/link";
import { Banknote, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { AppNav } from "@/components/layout/app-nav";
import { QuickActionsFab } from "@/components/quick-actions-fab";

export function AppShell({
  children,
  pathname,
  userName,
  shopName
}: {
  children: React.ReactNode;
  pathname: string;
  userName?: string | null;
  shopName: string;
}) {
  const heading = pathname
    .split("/")
    .filter(Boolean)[0]
    ?.replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Dashboard";

  return (
    <div className="min-h-screen text-stone-900">
      <header className="sticky top-0 z-40 border-b border-[rgba(121,150,118,0.22)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#176b4d] text-white shadow-sm">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.20em] text-[#66746a] sm:text-[10px]">
                RVerse Payroll
              </p>
              <h1 className="truncate text-[15px] font-semibold text-stone-950 sm:text-base">{heading}</h1>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <span className="hidden max-w-[220px] truncate text-[13px] text-stone-500 lg:inline">
              {shopName} / {userName ?? "Owner"}
            </span>
            <AppNav />
            <form action={logoutAction}>
              <button className="secondary-action h-9 px-3 text-[13px]">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link href="/settings" className="secondary-action h-9 px-2.5" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Link>
            <form action={logoutAction} className="contents">
              <button className="secondary-action h-9 px-2.5" aria-label="Logout">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 pb-32 sm:px-6 lg:px-8 lg:py-5 lg:pb-10">
        {children}
      </main>
      <QuickActionsFab />
      <AppNav mobile />
    </div>
  );
}
