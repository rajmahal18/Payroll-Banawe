import Link from "next/link";
import { BanknoteArrowDown, CalendarCheck2, CircleDollarSign, ClipboardList, LayoutDashboard, Settings, Users } from "lucide-react";
import { logoutAction } from "@/app/actions";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck2 },
  { href: "/advances", label: "Advances", icon: CircleDollarSign },
  { href: "/payables", label: "Payables", icon: BanknoteArrowDown },
  { href: "/payroll", label: "Payroll", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({
  children,
  pathname,
  userName
}: {
  children: React.ReactNode;
  pathname: string;
  userName?: string | null;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-6">
        <aside className="panel flex flex-col p-3">
          <div className="rounded-2xl bg-blue-600 p-4 text-white">
            <div className="text-xs uppercase tracking-[0.2em] text-blue-100">Absensya Payroll</div>
            <div className="mt-2 text-xl font-semibold">Owner Control Center</div>
            <div className="mt-1 text-sm text-blue-100">Attendance, advances, payables, and payroll in one place.</div>
          </div>

          <nav className="mt-4 flex-1 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div className="font-medium text-slate-900">Signed in as</div>
            <div>{userName ?? "Owner"}</div>
            <form action={logoutAction} className="mt-3">
              <button className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
