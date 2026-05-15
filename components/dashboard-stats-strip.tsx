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
  blue: "bg-sky-50 text-sky-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700"
} as const;

const valueToneMap = {
  blue: "text-stone-950",
  green: "text-emerald-700",
  red: "text-rose-700",
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
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-2 xl:grid-cols-5">
        {entries.map((entry, index) => {
          const Icon = iconMap[entry.icon];
          const rendered = entry.money ? formatMoney(entry.value) : entry.value;
          const valueClass = typeof entry.value === "string" ? valueToneMap[entry.tone] : "text-stone-950";
          return (
            <div
              key={entry.label}
              className={`flex min-h-[74px] items-center gap-3 px-3 py-3 sm:min-h-[96px] sm:px-4 ${
                index % 2 === 1 ? "border-l border-[rgba(121,150,118,0.22)]" : ""
              } ${index > 1 ? "border-t border-[rgba(121,150,118,0.22)]" : ""} xl:border-l xl:border-t-0 xl:border-[rgba(121,150,118,0.22)] xl:first:border-l-0`}
            >
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneMap[entry.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="section-title text-[10px]">{entry.label}</div>
                <div className={`mt-1 truncate text-xl font-semibold sm:text-2xl ${valueClass}`}>{rendered}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
