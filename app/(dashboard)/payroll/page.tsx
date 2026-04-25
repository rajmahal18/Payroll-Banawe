import Link from "next/link";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PayrollDueTimeline } from "@/components/payroll-due-timeline";
import { requireUser } from "@/lib/auth";
import { getPayrollTimelineEntries } from "@/lib/payroll-timeline";
import { toDateInputValue } from "@/lib/utils";

export default async function PayrollPage({
  searchParams
}: {
  searchParams?: Promise<{ paid?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await requireUser();
  const timelineEntries = await getPayrollTimelineEntries({ shopId: user.shop.id, limit: 30 });
  const todayValue = toDateInputValue(new Date());

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Review sahod days, open the full breakdown, then mark payroll as paid from one timeline."
        action={
          <Link
            href="/advances?tab=bonuses"
            className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.95)] px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-white hover:text-stone-950"
          >
            <Gift className="h-4 w-4 text-[#2f7d5b]" />
            Record Bonus
          </Link>
        }
      />

      {params.paid ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payroll marked as paid.</div> : null}
      {params.error === "no-due-payroll" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          No due payroll found for that day.
        </div>
      ) : null}
      {params.error === "attendance-mismatch" ? (
        <div className="mb-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-700">
          Attendance changed for that payroll. Review the highlighted sahod day before marking it as paid.
        </div>
      ) : null}

      <PayrollDueTimeline entries={timelineEntries} todayValue={todayValue} mode="full" />
    </div>
  );
}
