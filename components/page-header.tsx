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
    <div className="mb-4 flex flex-col gap-3 border-b border-[rgba(121,150,118,0.22)] pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-stone-950 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66746a]">{description}</p> : null}
      </div>
      {action ? <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">{action}</div> : null}
    </div>
  );
}
