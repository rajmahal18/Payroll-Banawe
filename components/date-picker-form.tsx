"use client";

import { useRouter } from "next/navigation";

export function DatePickerForm({
  action,
  value,
  name = "date"
}: {
  action: string;
  value: string;
  name?: string;
}) {
  const router = useRouter();

  const navigateToDate = (nextValue: string) => {
    if (!nextValue || nextValue === value) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) return;
    const params = new URLSearchParams();
    params.set(name, nextValue);
    router.push(`${action}?${params.toString()}`);
  };

  return (
    <div className="w-full sm:w-auto">
      <input
        name={name}
        type="date"
        defaultValue={value}
        className="min-w-[180px]"
        onChange={(event) => {
          navigateToDate(event.currentTarget.value);
        }}
      />
    </div>
  );
}
