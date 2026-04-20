import { TriangleAlert } from "lucide-react";
import { loginAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = (await searchParams) ?? {};

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-panel lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-slate-950 p-8 text-white lg:p-12">
          <div className="text-xs uppercase tracking-[0.28em] text-blue-200">Absensya Payroll</div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Owner-first payroll tracking built for real daily operations.</h1>
          <p className="mt-4 max-w-xl text-sm text-slate-300">
            Record absences, track advances, manage deductions, and auto-generate payroll by daily, weekly, twice-a-month, or monthly schedule.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Absence-only attendance keeps encoding fast and reliable.</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Payroll periods auto-adjust based on your selected pay schedule.</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Installable as a PWA for quick access on phone, tablet, or desktop.</div>
          </div>
        </div>

        <div className="p-8 lg:p-12">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">Use the admin credentials from your environment variables.</p>

            {params.error ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                Invalid login. Check your admin email and password.
              </div>
            ) : null}

            <form action={loginAction} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input name="email" type="email" placeholder="admin@example.com" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input name="password" type="password" placeholder="••••••••" required />
              </div>
              <button className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                Sign in
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-medium text-slate-900">First run</div>
              <div className="mt-1">Set your `.env`, run Prisma migrate, then run the seed script to create the admin account.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
