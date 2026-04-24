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
  blue: "bg-[#e8f0f8] text-[#6e8fb0]",
  green: "bg-[#e6f1ed] text-[#6f9c90]",
  red: "bg-[#f8ebe8] text-[#bf857b]",
  amber: "bg-[#f9f0df] text-[#c1985c]"
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
    <section className="overflow-hidden rounded-[28px] border border-[rgba(218,210,200,0.74)] bg-[rgba(255,251,246,0.88)] shadow-[0_20px_42px_-36px_rgba(108,89,70,0.15)] backdrop-blur">
      <div className="grid divide-y divide-[rgba(226,219,211,0.85)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {entries.map((entry) => {
          const Icon = iconMap[entry.icon];
          const rendered = entry.money ? formatMoney(entry.value) : entry.value;
          return (
            <div key={entry.label} className="flex items-center gap-4 px-4 py-4 sm:min-h-[112px] sm:px-5">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${toneMap[entry.tone]}`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{entry.label}</div>
                <div className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] text-stone-950">{rendered}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
