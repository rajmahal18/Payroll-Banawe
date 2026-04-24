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
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_6%,rgba(74,222,128,0.22)_0%,rgba(74,222,128,0)_30%),radial-gradient(circle_at_95%_0%,rgba(20,184,166,0.15)_0%,rgba(20,184,166,0)_25%),linear-gradient(180deg,#f7fff3_0%,#edf8e9_46%,#dcefd8_100%)] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-[rgba(88,150,88,0.28)] bg-[rgba(244,255,240,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#d7f2d4_0%,#8fd19e_58%,#2f7d5b_100%)] text-white shadow-[0_16px_28px_-20px_rgba(135,116,95,0.28)] sm:h-11 sm:w-11">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="bg-[linear-gradient(135deg,#14532d_0%,#2f7d5b_58%,#84cc16_100%)] bg-clip-text text-[9px] font-semibold uppercase tracking-[0.22em] text-transparent sm:text-[10px]">
                RVerse Payroll
              </p>
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-stone-900 sm:text-base">{heading}</h1>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <span className="hidden max-w-[220px] truncate text-[13px] text-stone-500 lg:inline">{shopName} · {userName ?? "Owner"}</span>
            <AppNav />
            <form action={logoutAction}>
              <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.95)] px-3 text-[13px] font-semibold text-stone-700 shadow-sm transition hover:bg-[rgba(238,250,233,0.98)] hover:text-stone-950">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/settings"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.95)] px-2.5 text-stone-600 shadow-sm transition hover:bg-[rgba(238,250,233,0.98)] hover:text-stone-950"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <form action={logoutAction} className="contents">
              <button className="inline-flex h-9 items-center justify-center rounded-xl border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.95)] px-2.5 text-stone-600 shadow-sm transition hover:bg-[rgba(238,250,233,0.98)] hover:text-stone-950" aria-label="Logout">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-3 pb-32 sm:px-6 lg:px-8 lg:py-4 lg:pb-10">
        {children}
      </main>
      <QuickActionsFab />
      <AppNav mobile />
    </div>
  );
}
