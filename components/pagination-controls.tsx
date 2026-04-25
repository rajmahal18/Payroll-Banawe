import Link from "next/link";

function buildPageHref(pathname: string, params: Record<string, string | number | undefined>, pageParam: string, page: number) {
  const next = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (key === pageParam && page <= 1) return;
    next.set(key, String(key === pageParam ? page : value));
  });

  if (page > 1) {
    next.set(pageParam, String(page));
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function PaginationControls({
  pathname,
  params,
  pageParam = "page",
  page,
  total,
  pageSize = 10
}: {
  pathname: string;
  params: Record<string, string | number | undefined>;
  pageParam?: string;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  if (total <= pageSize) {
    return total ? (
      <div className="mt-3 text-xs font-medium text-[#7a7168]">
        Showing {start}-{end} of {total}
      </div>
    ) : null;
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[rgba(148,190,139,0.28)] pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-medium text-[#7a7168]">
        Showing {start}-{end} of {total}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={buildPageHref(pathname, params, pageParam, Math.max(currentPage - 1, 1))}
          aria-disabled={currentPage <= 1}
          className={`inline-flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-stone-200 bg-stone-50 text-stone-400"
              : "border-[rgba(88,150,88,0.36)] bg-white text-stone-700 hover:bg-[#edf8e9]"
          }`}
        >
          Prev
        </Link>
        <span className="text-xs font-semibold text-stone-600">
          {currentPage} / {totalPages}
        </span>
        <Link
          href={buildPageHref(pathname, params, pageParam, Math.min(currentPage + 1, totalPages))}
          aria-disabled={currentPage >= totalPages}
          className={`inline-flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-semibold ${
            currentPage >= totalPages
              ? "pointer-events-none border-stone-200 bg-stone-50 text-stone-400"
              : "border-[rgba(88,150,88,0.36)] bg-white text-stone-700 hover:bg-[#edf8e9]"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
