import { addNoWorkDayAction, deleteNoWorkDayAction, savePayrollSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, getWeekdayLabel, toDateInputValue } from "@/lib/utils";
import { parseWorkDays } from "@/lib/work-schedule";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await requireUser();
  const settings = await prisma.payrollSettings.findFirst({ where: { shopId: user.shop.id } });
  const workDayRows = await prisma.$queryRaw<Array<{ workDays: string | null }>>`
    SELECT "workDays" FROM "PayrollSettings" WHERE "shopId" = ${user.shop.id} LIMIT 1
  `;
  const workDays = new Set(parseWorkDays(workDayRows[0]?.workDays));
  const noWorkDays = await prisma.$queryRaw<Array<{ id: string; date: Date; reason: string | null }>>`
    SELECT "id", "date", "reason"
    FROM "ShopNoWorkDay"
    WHERE "shopId" = ${user.shop.id}
    ORDER BY "date" DESC
    LIMIT 30
  `;

  return (
    <div>
      <PageHeader title="Settings" description="Set shop work days and payroll behavior." />
      {params.saved ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Settings saved.</div> : null}
      {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Please review your settings and try again.</div> : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Payroll Behavior</h2>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Active shop branding: <span className="font-semibold text-slate-950">{user.shop.name}</span>
          </div>
          <form action={savePayrollSettingsAction} className="mt-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-950">Weekly work days</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 7 }).map((_, day) => (
                  <label
                    key={day}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
                      workDays.has(day)
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-stone-200 bg-stone-50 text-stone-500"
                    }`}
                  >
                    <input type="checkbox" name="workDays" value={day} defaultChecked={workDays.has(day)} className="h-4 w-4 rounded" />
                    {getWeekdayLabel(day).slice(0, 3)}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Uncheck days when the shop is always closed, like Sunday.</p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="autoGenerate" defaultChecked={settings?.autoGenerate ?? true} className="h-4 w-4 rounded border-slate-300" />
              Allow payroll periods to be created automatically when payroll is generated.
            </label>
            <button className="rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">Save Settings</button>
          </form>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">No-work Days</h2>
          <p className="mt-1 text-sm text-slate-600">Add one-off holidays or closure dates. These are skipped in payroll day counts.</p>
          <form action={addNoWorkDayAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input name="date" type="date" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
              <input name="reason" placeholder="Holiday / shop closed" />
            </div>
            <button className="self-end rounded-2xl bg-[#2f7d5b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#25684b]">
              Add
            </button>
          </form>

          <div className="mt-4 divide-y divide-[rgba(148,190,139,0.28)] overflow-hidden rounded-[22px] border border-[rgba(88,150,88,0.28)] bg-white/70">
            {noWorkDays.length ? (
              noWorkDays.map((day) => (
                <div key={day.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-950">{formatDate(day.date)}</div>
                    <div className="truncate text-xs text-stone-500">{day.reason || "No reason added"} · {toDateInputValue(day.date)}</div>
                  </div>
                  <form action={deleteNoWorkDayAction}>
                    <input type="hidden" name="noWorkDayId" value={day.id} />
                    <button className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                      Remove
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-stone-500">No custom no-work days yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
