"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function EmployeeSearchForm({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const paramsString = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(paramsString);
      const current = params.get("search") || "";

      if (value.trim()) {
        params.set("search", value.trim());
      } else {
        params.delete("search");
      }

      const next = params.get("search") || "";
      if (next === current) return;

      startTransition(() => {
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [value, pathname, router, paramsString]);

  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder="Search employee"
        className="w-full pl-9 pr-10"
      />
      {isPending ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7f73]">...</span> : null}
    </div>
  );
}
