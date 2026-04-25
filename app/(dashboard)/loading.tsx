export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10 text-center">
      <section className="rounded-[28px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.96)] p-6 shadow-[0_24px_48px_-36px_rgba(22,78,43,0.22)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d7f2d4] border-t-[#16784f]" />
        <h1 className="mt-4 text-xl font-semibold text-stone-950">Loading your workspace</h1>
        <p className="mt-2 text-sm text-stone-600">This should only take a moment.</p>
      </section>
    </main>
  );
}
