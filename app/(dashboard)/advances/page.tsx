import Link from "next/link";
import { CircleDollarSign, Gift } from "lucide-react";
import { createAdvanceAction, createBonusAction } from "@/app/actions";
import { AdvanceActivityCalendar } from "@/components/advance-activity-calendar";
import { AdvanceManager } from "@/components/advance-manager";
import { BonusManager } from "@/components/bonus-manager";
import { PageHeader } from "@/components/page-header";
import { projectAdvanceDeductions } from "@/lib/advance-projections";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/utils";
import { getShopWorkCalendar } from "@/lib/work-schedule";

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
    where: { shopId: user.shop.id },
    orderBy: { fullName: "asc" }
  });
  const employeeIds = employees.map((employee) => employee.id);
  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE");
  const activeEmployeeIds = activeEmployees.map((employee) => employee.id);
  const [advances, bonuses, advanceDeductions, paidPayrollEntries, workCalendar] = await Promise.all([
    prisma.advance.findMany({
      where: { employeeId: { in: employeeIds } },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            payrollFrequency: true,
            weeklyPayDay: true,
            monthlyPayDay: true,
            twiceMonthlyDayOne: true,
            twiceMonthlyDayTwo: true,
            everyNDays: true,
            startDate: true,
            lastPaidDate: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { date: "desc" }]
    }),
    prisma.bonus.findMany({
      where: { employeeId: { in: activeEmployeeIds } },
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ status: "asc" }, { date: "desc" }]
    }),
    prisma.advanceDeduction.findMany({
      where: { employeeId: { in: employeeIds } },
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ payDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.payrollEntry.findMany({
      where: {
        employeeId: { in: employeeIds },
        payrollPeriod: { status: "PAID" }
      },
      select: {
        employeeId: true,
        payrollPeriod: { select: { payDate: true } }
      },
      orderBy: { payrollPeriod: { payDate: "desc" } }
    }),
    getShopWorkCalendar(user.shop.id)
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    fullName: employee.fullName,
    photoDataUrl: employee.photoDataUrl
  }));

  const deductionsByAdvanceId = new Map<string, typeof advanceDeductions>();
  advanceDeductions.forEach((deduction) => {
    if (!deduction.advanceId) return;
    const existing = deductionsByAdvanceId.get(deduction.advanceId) ?? [];
    existing.push(deduction);
    deductionsByAdvanceId.set(deduction.advanceId, existing);
  });

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
    reason: advance.reason ?? "",
    deductions: (deductionsByAdvanceId.get(advance.id) ?? []).map((deduction) => ({
      id: deduction.id,
      payDate: toDateInputValue(deduction.payDate),
      amount: deduction.amount.toString(),
      balanceBefore: deduction.balanceBefore.toString(),
      balanceAfter: deduction.balanceAfter.toString()
    }))
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
  const latestPaidDateByEmployee = new Map<string, Date>();
  paidPayrollEntries.forEach((entry) => {
    if (!latestPaidDateByEmployee.has(entry.employeeId)) {
      latestPaidDateByEmployee.set(entry.employeeId, entry.payrollPeriod.payDate);
    }
  });
  const projectedAdvanceDeductions = projectAdvanceDeductions(
    advances
      .filter((advance) => advance.status === "OPEN" && advance.remainingBalance.greaterThan(0))
      .map((advance) => {
        const persistedPaidDate = latestPaidDateByEmployee.get(advance.employeeId);
        const lastPaidDate =
          persistedPaidDate && (!advance.employee.lastPaidDate || persistedPaidDate > advance.employee.lastPaidDate)
            ? persistedPaidDate
            : advance.employee.lastPaidDate;
        return { ...advance, employee: { ...advance.employee, lastPaidDate } };
      }),
    workCalendar
  );
  const auditedDeductionByAdvance = new Map<string, number>();
  advanceDeductions.forEach((deduction) => {
    if (!deduction.advanceId) return;
    auditedDeductionByAdvance.set(
      deduction.advanceId,
      (auditedDeductionByAdvance.get(deduction.advanceId) ?? 0) + Number(deduction.amount)
    );
  });
  const legacyDeductionEmployeeIds = Array.from(new Set(
    advances
      .filter((advance) => Number(advance.deductedAmount) > (auditedDeductionByAdvance.get(advance.id) ?? 0))
      .map((advance) => advance.employeeId)
  ));
  const advanceActivityEvents = [
    ...advances.map((advance) => ({
      id: `advance-${advance.id}`,
      date: toDateInputValue(advance.date),
      employeeId: advance.employeeId,
      employeeName: advance.employee.fullName,
      type: "ADVANCE" as const,
      amount: advance.amount.toString(),
      reason: advance.reason ?? "",
      balanceBefore: null,
      balanceAfter: advance.remainingBalance.toString(),
      currentDeductedAmount: advance.deductedAmount.toString(),
      currentRemainingBalance: advance.remainingBalance.toString(),
      status: advance.status
    })),
    ...advanceDeductions.map((deduction) => ({
      id: `deduction-${deduction.id}`,
      date: toDateInputValue(deduction.payDate),
      employeeId: deduction.employeeId,
      employeeName: deduction.employee.fullName,
      type: "DEDUCTION" as const,
      amount: deduction.amount.toString(),
      reason: deduction.advanceReason ?? "",
      balanceBefore: deduction.balanceBefore.toString(),
      balanceAfter: deduction.balanceAfter.toString(),
      currentDeductedAmount: null,
      currentRemainingBalance: null,
      status: null
    })),
    ...projectedAdvanceDeductions.map((deduction) => ({
      id: deduction.id,
      date: toDateInputValue(deduction.date),
      employeeId: deduction.employeeId,
      employeeName: deduction.employeeName,
      type: "SUGGESTED_DEDUCTION" as const,
      amount: deduction.amount.toString(),
      reason: deduction.reason,
      balanceBefore: deduction.balanceBefore.toString(),
      balanceAfter: deduction.balanceAfter.toString(),
      currentDeductedAmount: null,
      currentRemainingBalance: null,
      status: null
    }))
  ].sort((left, right) => right.date.localeCompare(left.date));
  const advanceTotals = {
    issued: advances
      .filter((advance) => advance.status !== "CANCELLED")
      .reduce((total, advance) => total + Number(advance.amount), 0)
      .toString(),
    deducted: advances.reduce((total, advance) => total + Number(advance.deductedAmount), 0).toString(),
    outstanding: advances.reduce((total, advance) => total + Number(advance.remainingBalance), 0).toString(),
    auditedDeductions: advanceDeductions.reduce((total, deduction) => total + Number(deduction.amount), 0).toString()
  };

  return (
    <div>
      <PageHeader
        title="Adjustments"
        description="Record money added to or deducted from payroll."
      />

      <section className="panel min-w-0 overflow-hidden">
        <div className="p-1">
          <div className="grid grid-cols-2 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const count = tab.key === "advances" ? advanceItems.length : bonusItems.length;

              return (
                <Link
                  key={tab.key}
                  href={tab.key === "advances" ? "/advances" : "/advances?tab=bonuses"}
                  className={`min-w-0 rounded-xl border px-3 py-2.5 transition sm:px-4 sm:py-3 ${
                    active
                      ? "border-[#bfd9c8] bg-[#e7f3e7] text-stone-950"
                      : "border-transparent text-stone-600 hover:bg-[#f5f8f2] hover:text-stone-950"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        active
                          ? "border-[#bfd9c8] bg-white text-[#176b4d]"
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
                      <div className={`mt-0.5 hidden truncate text-xs leading-5 sm:block ${active ? "text-[#52665a]" : "text-stone-500"}`}>{tab.description}</div>
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
            <div className="min-w-0 xl:col-span-2">
              <AdvanceActivityCalendar events={advanceActivityEvents} employees={employeeOptions} totals={advanceTotals} legacyDeductionEmployeeIds={legacyDeductionEmployeeIds} />
            </div>
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
                    {activeEmployees.map((employee) => (
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
                    {activeEmployees.map((employee) => (
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
