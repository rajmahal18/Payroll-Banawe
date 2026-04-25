import Link from "next/link";
import { CircleDollarSign, Gift } from "lucide-react";
import { createAdvanceAction, createBonusAction } from "@/app/actions";
import { AdvanceManager } from "@/components/advance-manager";
import { BonusManager } from "@/components/bonus-manager";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/utils";

const tabs = [
  {
    key: "advances",
    label: "Advances",
    description: "Deductions from payroll",
    icon: CircleDollarSign
  },
  {
    key: "bonuses",
    label: "Bonuses",
    description: "Extra payroll additions",
    icon: Gift
  }
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default async function AdvancesPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab: TabKey = params.tab === "bonuses" ? "bonuses" : "advances";
  const user = await requireUser();
  const employees = await prisma.employee.findMany({
    where: { shopId: user.shop.id, status: "ACTIVE" },
    orderBy: { fullName: "asc" }
  });
  const employeeIds = employees.map((employee) => employee.id);
  const [advances, bonuses] = await Promise.all([
    prisma.advance.findMany({
      where: { employeeId: { in: employeeIds } },
      include: { employee: true },
      orderBy: [{ status: "asc" }, { date: "desc" }]
    }),
    prisma.bonus.findMany({
      where: { employeeId: { in: employeeIds } },
      include: { employee: true },
      orderBy: [{ status: "asc" }, { date: "desc" }]
    })
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    fullName: employee.fullName
  }));

  const advanceItems = advances.map((advance) => ({
    id: advance.id,
    employeeId: advance.employeeId,
    employeeName: advance.employee.fullName,
    date: toDateInputValue(advance.date),
    amount: advance.amount.toString(),
    deductionPerPayroll: advance.deductionPerPayroll?.toString() ?? null,
    deductedAmount: advance.deductedAmount.toString(),
    remainingBalance: advance.remainingBalance.toString(),
    status: advance.status,
    reason: advance.reason ?? ""
  }));

  const bonusItems = bonuses.map((bonus) => ({
    id: bonus.id,
    employeeId: bonus.employeeId,
    employeeName: bonus.employee.fullName,
    date: toDateInputValue(bonus.date),
    amount: bonus.amount.toString(),
    status: bonus.status,
    reason: bonus.reason ?? ""
  }));

  return (
    <div>
      <PageHeader
        title="Adjustments"
        description="Record money added to or deducted from payroll."
      />

      <section className="panel min-w-0 overflow-hidden">
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid grid-cols-2 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const count = tab.key === "advances" ? advanceItems.length : bonusItems.length;

              return (
                <Link
                  key={tab.key}
                  href={tab.key === "advances" ? "/advances" : "/advances?tab=bonuses"}
                  className={`min-w-0 rounded-[18px] border px-3 py-2.5 transition sm:rounded-[22px] sm:px-4 sm:py-3 ${
                    active
                      ? "border-[#bcd8bf] bg-[linear-gradient(135deg,#eff8ed_0%,#f3fbf0_60%,#edf8f6_100%)] text-stone-950 shadow-[0_18px_40px_-34px_rgba(22,78,43,0.22)]"
                      : "border-transparent bg-white/65 text-stone-600 hover:border-[#d8e8d2] hover:bg-white/90 hover:text-stone-950"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10 sm:rounded-2xl ${
                        active
                          ? "border-[#cfe3c8] bg-[#eef7e9] text-[#16784f]"
                          : "border-[#e3efe0] bg-white text-stone-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{tab.label}</div>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-white/80 text-[#16784f]" : "bg-[#edf7ef] text-stone-500"}`}>
                          {count}
                        </span>
                      </div>
                      <div className="mt-0.5 hidden truncate text-xs leading-5 text-inherit/80 sm:block">{tab.description}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-3 grid min-w-0 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        {activeTab === "advances" ? (
          <>
            <section className="panel min-w-0 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e2f2d9] text-[#2f7d5b]">
                  <CircleDollarSign className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Record Advance</h2>
                  <p className="mt-1 text-sm text-slate-600">Set the amount, then choose full or partial deduction.</p>
                </div>
              </div>

              <form action={createAdvanceAction} className="mt-4 space-y-3 sm:space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
                  <select name="employeeId" required>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                    <input name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                    <input name="amount" type="number" min="0" step="0.01" placeholder="1000" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Deduct Per Payroll</label>
                  <input name="deductionPerPayroll" type="number" min="0" step="0.01" placeholder="Optional partial deduction amount" />
                  <p className="mt-1 text-xs text-slate-500">
                    Leave blank if the full remaining balance should be deducted on the next payroll.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                  <textarea name="reason" rows={3} placeholder="Optional reason" />
                </div>
                <button className="w-full rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b] sm:w-auto">Save Advance</button>
              </form>
            </section>

            <AdvanceManager advances={advanceItems} employees={employeeOptions} />
          </>
        ) : (
          <>
            <section className="panel min-w-0 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Gift className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Record Bonus</h2>
                  <p className="mt-1 text-sm text-slate-600">Add a one-time extra payout for an employee.</p>
                </div>
              </div>

              <form action={createBonusAction} className="mt-4 space-y-3 sm:space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
                  <select name="employeeId" required>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Bonus date</label>
                    <input name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                    <input name="amount" type="number" min="0" step="0.01" placeholder="500" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                  <textarea name="reason" rows={3} placeholder="Optional performance note" />
                </div>
                <button className="w-full rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b] sm:w-auto">Save Bonus</button>
              </form>
            </section>

            <BonusManager bonuses={bonusItems} employees={employeeOptions} />
          </>
        )}
      </div>
    </div>
  );
}
