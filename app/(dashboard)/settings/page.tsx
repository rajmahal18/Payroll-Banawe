import { PayrollFrequency } from "@prisma/client";
import { savePayrollSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getWeekdayLabel } from "@/lib/utils";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const settings = await prisma.payrollSettings.findFirst();

  return (
    <div>
      <PageHeader title="Settings" description="Choose how payroll periods should be computed and when salary day happens." />
      {params.saved ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll settings saved.</div> : null}
      {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Please save payroll settings first.</div> : null}

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Payroll Setup</h2>
          <form action={savePayrollSettingsAction} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Frequency</label>
              <select name="frequency" defaultValue={settings?.frequency ?? PayrollFrequency.WEEKLY}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="TWICE_MONTHLY">Twice a month</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Weekly pay day</label>
                <select name="weeklyPayDay" defaultValue={settings?.weeklyPayDay ?? 5}>
                  {Array.from({ length: 7 }).map((_, day) => (
                    <option key={day} value={day}>{getWeekdayLabel(day)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Monthly pay day</label>
                <input name="monthlyPayDay" type="number" min="1" max="31" defaultValue={settings?.monthlyPayDay ?? 15} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Twice a month - first day</label>
                <input name="twiceMonthlyDayOne" type="number" min="1" max="31" defaultValue={settings?.twiceMonthlyDayOne ?? 15} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Twice a month - second day</label>
                <input name="twiceMonthlyDayTwo" type="number" min="1" max="31" defaultValue={settings?.twiceMonthlyDayTwo ?? 30} />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="autoGenerate" defaultChecked={settings?.autoGenerate ?? true} className="h-4 w-4 rounded border-slate-300" />
              Allow automatic payroll period generation when owner runs payroll.
            </label>
            <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save Settings</button>
          </form>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">How the engine behaves</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Daily:</span> every selected date becomes its own payroll period.</div>
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Weekly:</span> owner selects the sahod day of the week, and each payroll period covers the 7 days ending on that day.</div>
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Twice a month:</span> owner selects two payroll dates each month, commonly 15 and 30.</div>
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Monthly:</span> owner selects one day of the month, and each payroll period rolls forward to that recurring pay date.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
