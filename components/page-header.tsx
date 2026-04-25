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
    <div className="mb-3 flex flex-col gap-3 border-b border-[rgba(88,150,88,0.24)] pb-3 sm:mb-4 sm:pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6f7b70] sm:mt-2 sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {action ? <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">{action}</div> : null}
    </div>
  );
}
