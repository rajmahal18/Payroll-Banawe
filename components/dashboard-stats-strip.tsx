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
    <section className="overflow-hidden rounded-[22px] border border-[rgba(88,150,88,0.34)] bg-[rgba(250,255,247,0.92)] shadow-[0_20px_42px_-36px_rgba(22,78,43,0.20)] backdrop-blur sm:rounded-[28px]">
      <div className="grid grid-cols-2 xl:grid-cols-5">
        {entries.map((entry, index) => {
          const Icon = iconMap[entry.icon];
          const rendered = entry.money ? formatMoney(entry.value) : entry.value;
          const valueClass = typeof entry.value === "string" ? valueToneMap[entry.tone] : "text-stone-950";
          return (
            <div
              key={entry.label}
              className={`flex min-h-[76px] items-center gap-2.5 px-3 py-2.5 sm:min-h-[112px] sm:gap-4 sm:px-5 sm:py-4 ${
                index % 2 === 1 ? "border-l border-[rgba(148,190,139,0.36)]" : ""
              } ${index > 1 ? "border-t border-[rgba(148,190,139,0.36)]" : ""} xl:border-l xl:border-t-0 xl:border-[rgba(148,190,139,0.36)] xl:first:border-l-0`}
            >
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-14 sm:w-14 ${toneMap[entry.tone]}`}>
                <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:text-[11px] sm:tracking-[0.18em]">{entry.label}</div>
                <div className={`mt-0.5 truncate text-xl font-semibold tracking-[-0.04em] sm:mt-1 sm:text-2xl ${valueClass}`}>{rendered}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
