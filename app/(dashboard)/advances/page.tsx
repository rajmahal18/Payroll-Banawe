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
    description: "Cash advances that will be deducted from payroll.",
    icon: CircleDollarSign
  },
  {
    key: "bonuses",
    label: "Bonuses",
    description: "One-time additions that increase payroll payout.",
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
        description="Handle payroll extras in one place. Switch between cash advances and bonuses without leaving the page."
      />

      <section className="panel min-w-0 overflow-hidden">
        <div className="border-b border-[#d8e8d2] px-4 py-4 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <Link
                  key={tab.key}
                  href={tab.key === "advances" ? "/advances" : "/advances?tab=bonuses"}
                  className={`min-w-0 rounded-[22px] border px-4 py-3 transition ${
                    active
                      ? "border-[#bcd8bf] bg-[linear-gradient(135deg,#eff8ed_0%,#f3fbf0_60%,#edf8f6_100%)] text-stone-950 shadow-[0_18px_40px_-34px_rgba(22,78,43,0.22)]"
                      : "border-transparent bg-white/65 text-stone-600 hover:border-[#d8e8d2] hover:bg-white/90 hover:text-stone-950"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                        active
                          ? "border-[#cfe3c8] bg-[#eef7e9] text-[#16784f]"
                          : "border-[#e3efe0] bg-white text-stone-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{tab.label}</div>
                      <div className="mt-0.5 text-xs leading-5 text-inherit/80">{tab.description}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#d8e8d2] bg-[rgba(246,252,242,0.82)] px-4 py-4 text-sm text-stone-700 sm:grid-cols-2 sm:px-5">
          <div className="rounded-[20px] border border-[#dbead5] bg-white/75 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8b74]">Active Tab</div>
            <div className="mt-1 text-base font-semibold text-stone-950">
              {activeTab === "advances" ? "Advances" : "Bonuses"}
            </div>
          </div>
          <div className="rounded-[20px] border border-[#dbead5] bg-white/75 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8b74]">Records</div>
            <div className="mt-1 text-base font-semibold text-stone-950">
              {activeTab === "advances" ? advanceItems.length : bonusItems.length}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        {activeTab === "advances" ? (
          <>
            <section className="panel min-w-0 p-5">
              <h2 className="text-lg font-semibold text-slate-950">Record Advance</h2>
              <p className="mt-1 text-sm text-slate-600">Create an advance and set how it should be deducted in payroll.</p>

              <form action={createAdvanceAction} className="mt-4 space-y-4">
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
                <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Advance</button>
              </form>
            </section>

            <AdvanceManager advances={advanceItems} employees={employeeOptions} />
          </>
        ) : (
          <>
            <section className="panel min-w-0 p-5">
              <h2 className="text-lg font-semibold text-slate-950">Record Bonus</h2>
              <p className="mt-1 text-sm text-slate-600">Add a one-time payout adjustment for the selected employee.</p>

              <form action={createBonusAction} className="mt-4 space-y-4">
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
                <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Bonus</button>
              </form>
            </section>

            <BonusManager bonuses={bonusItems} employees={employeeOptions} />
          </>
        )}
      </div>
    </div>
  );
}
