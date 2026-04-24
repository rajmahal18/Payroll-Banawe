import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-[28px] border border-[rgba(218,210,200,0.78)] bg-[rgba(255,251,246,0.96)] p-6 shadow-[0_24px_48px_-36px_rgba(108,89,70,0.2)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7f73]">Offline Mode</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-stone-950">You’re currently offline.</h1>
        <p className="mt-3 text-sm leading-6 text-[#7a7168]">
          RVerse Payroll can still open cached screens, but live payroll, attendance saves, and synced updates need an internet
          connection.
        </p>

        <div className="mt-5 grid gap-3 rounded-[22px] border border-[rgba(226,219,211,0.82)] bg-[rgba(248,244,238,0.86)] p-4 text-sm text-stone-700">
          <div>Reconnect to keep attendance, bonuses, payroll, and deductions accurate.</div>
          <div>Once you’re back online, reload the page to continue working with fresh shop data.</div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b5f59]"
          >
            Try Dashboard Again
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-[rgba(218,210,200,0.82)] bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-[#faf7f2]"
          >
            Go To Login
          </Link>
        </div>
      </section>
    </main>
  );
}
