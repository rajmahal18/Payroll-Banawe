import { savePayrollSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const settings = await prisma.payrollSettings.findFirst();

  return (
    <div>
      <PageHeader title="Settings" description="Keep the app behavior simple. Payroll schedules are now managed per employee." />
      {params.saved ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Settings saved.</div> : null}
      {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Please review your settings and try again.</div> : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Payroll Behavior</h2>
          <form action={savePayrollSettingsAction} className="mt-4 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="autoGenerate" defaultChecked={settings?.autoGenerate ?? true} className="h-4 w-4 rounded border-slate-300" />
              Allow payroll periods to be created automatically when payroll is generated.
            </label>
            <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save Settings</button>
          </form>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">How payroll works now</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <div className="rounded-2xl bg-slate-50 p-4">
              Each employee has their own payroll frequency and pay day setup from the employee form.
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              Weekly, monthly, twice-monthly, and daily employees can all exist in the same company at the same time.
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              When you generate payroll for a date, only employees due on that date are included in the result.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
