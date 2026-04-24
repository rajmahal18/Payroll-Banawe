export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[26px] border border-[rgba(218,210,200,0.68)] bg-[rgba(255,251,246,0.7)] px-4 py-4 shadow-[0_18px_42px_-36px_rgba(108,89,70,0.14)] backdrop-blur lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-stone-950">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7a7168]">{description}</p> : null}
      </div>
      {action ? <div className="flex min-w-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
