import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const errorCopy: Record<string, string> = {
  invalid: "Please enter a valid email and password.",
  credentials: "Invalid login. Check your email and password.",
  "register-invalid": "Please complete all registration details and make sure the passwords match.",
  "email-taken": "That email is already in use. Sign in instead or register with a different email."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const mode = params.mode === "register" ? "register" : "login";
  const errorMessage = params.error ? errorCopy[params.error] ?? "Please try again." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_10%_8%,rgba(74,222,128,0.22)_0%,rgba(74,222,128,0)_32%),radial-gradient(circle_at_92%_0%,rgba(20,184,166,0.15)_0%,rgba(20,184,166,0)_26%),linear-gradient(180deg,#f7fff3_0%,#edf8e9_48%,#dcefd8_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_64px_-40px_rgba(22,78,43,0.24)] lg:grid-cols-[1.04fr_0.96fr]">
        <div className="bg-[radial-gradient(circle_at_15%_10%,rgba(187,247,208,0.25)_0%,rgba(187,247,208,0)_32%),linear-gradient(145deg,#123524_0%,#16784f_58%,#84a83b_100%)] p-8 text-white lg:p-12">
          <div className="text-xs uppercase tracking-[0.28em] text-lime-100/90">RVerse Payroll</div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Simple payroll for your shop.</h1>
          <p className="mt-4 max-w-xl text-sm text-white/78">
            Track attendance, advances, and payouts in one clean workspace.
          </p>
        </div>

        <div className="p-6 sm:p-8 lg:p-12">
          <div className="max-w-md">
            <div className="inline-flex rounded-2xl border border-[rgba(88,150,88,0.34)] bg-[rgba(229,245,224,0.88)] p-1">
              <Link
                href="/login"
                className={`rounded-[18px] px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-[#f8fff4] text-[#173624] shadow-sm" : "text-stone-600 hover:text-stone-950"}`}
              >
                Sign in
              </Link>
              <Link
                href="/login?mode=register"
                className={`rounded-[18px] px-4 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-[#f8fff4] text-[#173624] shadow-sm" : "text-stone-600 hover:text-stone-950"}`}
              >
                Register
              </Link>
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-slate-950">{mode === "register" ? "Create your RVerse workspace" : "Sign in to RVerse Payroll"}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {mode === "register"
                ? "Set the owner name, shop name, and login details. The shop name becomes your dashboard branding."
                : "Use the account you registered for your shop payroll workspace."}
            </p>

            {errorMessage ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            {mode === "register" ? (
              <form action={registerAction} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Owner Name</label>
                  <input name="ownerName" placeholder="Maria Santos" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Shop Name</label>
                  <input name="shopName" placeholder="Santos Hardware" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input name="email" type="email" placeholder="owner@example.com" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                    <input name="password" type="password" placeholder="Password" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
                    <input name="confirmPassword" type="password" placeholder="Repeat password" required />
                  </div>
                </div>
                <button className="w-full rounded-2xl bg-[#16784f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#14532d]">
                  Create RVerse Payroll Account
                </button>
              </form>
            ) : (
              <form action={loginAction} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input name="email" type="email" placeholder="owner@example.com" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                  <input name="password" type="password" placeholder="Password" required />
                </div>
                <button className="w-full rounded-2xl bg-[#16784f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#14532d]">
                  Sign in
                </button>
              </form>
            )}

            <div className="mt-6 rounded-2xl bg-[rgba(229,245,224,0.92)] p-4 text-sm text-slate-600">
              <div className="font-medium text-slate-900">{mode === "register" ? "After registration" : "New here?"}</div>
              <div className="mt-1">
                {mode === "register"
                  ? "You’ll land straight in RVerse Payroll with shop-specific branding and a fresh employee code sequence starting from EMP-001."
                  : "Register a new shop account if you’re setting up a separate payroll workspace for another business."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
