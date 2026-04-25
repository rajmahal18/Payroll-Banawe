"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10 text-center">
      <section className="rounded-[28px] border border-red-200 bg-white p-6 shadow-[0_24px_48px_-36px_rgba(127,29,29,0.24)]">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Workspace Error</div>
        <h1 className="mt-3 text-2xl font-semibold text-stone-950">RVerse Payroll could not load the dashboard.</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          The app is reachable, but the protected workspace failed to load. This is usually a database, session, or deployment
          environment issue.
        </p>
        <button
          onClick={() => reset()}
          className="mt-5 rounded-2xl bg-[#16784f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14532d]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
