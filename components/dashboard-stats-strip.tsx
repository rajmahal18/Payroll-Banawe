import { Banknote, CalendarCheck2, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { formatMoney } from "@/lib/utils";

const iconMap = {
  attendance: CalendarCheck2,
  employees: UsersRound,
  present: UserRoundCheck,
  absent: UserRoundX,
  advances: Banknote
} as const;

const toneMap = {
  blue: "bg-[#e2f2d7] text-[#47835b]",
  green: "bg-[#d8f3dc] text-[#2f7d5b]",
  red: "bg-[#fee2e2] text-[#b45353]",
  amber: "bg-[#eaf6d8] text-[#6c8a24]"
} as const;

const valueToneMap = {
  blue: "text-stone-950",
  green: "text-emerald-600",
  red: "text-rose-600",
  amber: "text-stone-950"
} as const;

type Entry = {
  label: string;
  value: string | number;
  icon: keyof typeof iconMap;
  tone: keyof typeof toneMap;
  money?: boolean;
};

export function DashboardStatsStrip({ entries }: { entries: Entry[] }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.92)] shadow-[0_20px_42px_-36px_rgba(22,78,43,0.20)] backdrop-blur">
      <div className="grid divide-y divide-[rgba(148,190,139,0.36)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {entries.map((entry) => {
          const Icon = iconMap[entry.icon];
          const rendered = entry.money ? formatMoney(entry.value) : entry.value;
          const valueClass = typeof entry.value === "string" ? valueToneMap[entry.tone] : "text-stone-950";
          return (
            <div key={entry.label} className="flex items-center gap-4 px-4 py-4 sm:min-h-[112px] sm:px-5">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${toneMap[entry.tone]}`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{entry.label}</div>
                <div className={`mt-1 truncate text-2xl font-semibold tracking-[-0.04em] ${valueClass}`}>{rendered}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
