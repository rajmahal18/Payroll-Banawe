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
    default: "bg-slate-50 text-slate-700",
    success: "bg-green-50 text-green-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700"
  }[tone];

  const rendered = money ? formatMoney(value) : value;

  return (
    <div className="metric">
      <div className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${toneClass}`}>{label}</div>
      <div className="mt-4 text-2xl font-semibold text-slate-950">{rendered}</div>
    </div>
  );
}
