import { formatMoney } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "default",
  money = false
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "danger" | "warning";
  money?: boolean;
}) {
  const toneClass = {
    default: "bg-[#edf7ef] text-[#2f7d5b] ring-[#cfe9d6]",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    warning: "bg-lime-50 text-lime-700 ring-lime-200"
  }[tone];

  const rendered = money ? formatMoney(value) : value;

  return (
    <div className="metric min-w-0">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${toneClass}`}>{label}</div>
      <div className="mt-4 truncate text-2xl font-semibold tracking-[-0.04em] text-stone-950">{rendered}</div>
    </div>
  );
}
