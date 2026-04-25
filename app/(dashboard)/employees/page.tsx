import { EmployeeCardGrid } from "@/components/employee-card-grid";
import { EmployeeCreateModal } from "@/components/employee-create-modal";
import { PageHeader } from "@/components/page-header";
import { EmployeeSearchForm } from "@/components/employee-search-form";
import { PaginationControls } from "@/components/pagination-controls";
import type { TimelineEmployeeDetail, TimelineEntry } from "@/components/payroll-due-timeline";
import { requireUser } from "@/lib/auth";
import { getLivePayrollAttendanceMetrics } from "@/lib/payroll-live";
import { describePayrollFrequency, getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { endOfDayLocal, formatDate, formatShortWeekday, parseDateInputValue, startOfDayLocal, toDateInputValue } from "@/lib/utils";
import { getShopWorkCalendar, isWorkDate } from "@/lib/work-schedule";
import { CalendarDays, UsersRound } from "lucide-react";

const PAGE_SIZE = 10;

function getPage(value: string | undefined) {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildEmployeesHref(params: { tab?: string; search?: string; page?: number; attendancePage?: number }) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "people") query.set("tab", params.tab);
  if (params.search) query.set("search", params.search);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.attendancePage && params.attendancePage > 1) query.set("attendancePage", String(params.attendancePage));

  const value = query.toString();
  return value ? `/employees?${value}` : "/employees";
}

function addCalendarDays(date: Date, amount: number) {
  return parseDateInputValue(toDateInputValue(new Date(date.getTime() + amount * 24 * 60 * 60 * 1000)));
}

function buildEmployeeAttendanceCalendarDays({
  periodStart,
  periodEnd,
  attendanceRecords,
  workCalendar
}: {
  periodStart: Date;
  periodEnd: Date;
  attendanceRecords: Array<{ date: Date; status: "PRESENT" | "HALF_DAY" | "ABSENT" }>;
  workCalendar: Awaited<ReturnType<typeof getShopWorkCalendar>>;
}): TimelineEmployeeDetail["attendanceCalendarDays"] {
  const recordsByDate = new Map(attendanceRecords.map((record) => [toDateInputValue(record.date), record]));
  const days: TimelineEmployeeDetail["attendanceCalendarDays"] = [];
  let cursor = parseDateInputValue(toDateInputValue(periodStart));
  const endValue = toDateInputValue(periodEnd);

  while (toDateInputValue(cursor) <= endValue) {
    const dateValue = toDateInputValue(cursor);
    const record = recordsByDate.get(dateValue);
    const workDay = isWorkDate(cursor, workCalendar);

    days.push({
      dateValue,
      dayLabel: formatShortWeekday(cursor),
      dateLabel: String(Number(dateValue.slice(-2))),
      status: !workDay ? "NO_WORK" : record?.status === "ABSENT" ? "ABSENT" : record?.status === "HALF_DAY" ? "HALF_DAY" : "PRESENT"
    });

    cursor = addCalendarDays(cursor, 1);
  }

  return days;
}

export default async function EmployeesPage({
  searchParams
}: {
  searchParams?: Promise<{ search?: string; tab?: string; page?: string; attendancePage?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const search = params.search?.trim() || "";
  const activeTab = params.tab === "attendance" ? "attendance" : "people";
  const peoplePage = getPage(params.page);
  const attendancePage = getPage(params.attendancePage);
  const user = await requireUser();
  const workCalendar = await getShopWorkCalendar(user.shop.id);
  const employeeWhere = {
    shopId: user.shop.id,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { employeeCode: { contains: search, mode: "insensitive" as const } },
            { position: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [employeeCount, employees, savedAttendanceDateGroups] = await Promise.all([
    prisma.employee.count({ where: employeeWhere }),
    prisma.employee.findMany({
      where: employeeWhere,
      include: {
        attendanceRecords: {
          orderBy: { date: "desc" },
          select: {
            date: true,
            status: true,
            remarks: true
          }
        },
        advances: {
          where: { status: "OPEN" },
          select: {
            remainingBalance: true
          }
        },
        payrollEntries: {
          select: {
            daysPresent: true,
            daysHalf: true,
            daysAbsent: true,
            grossPay: true,
            totalBonusesAdded: true,
            totalAdvancesDeducted: true,
            totalPayablesDeducted: true,
            netPay: true,
            payrollPeriod: {
              select: {
                periodStart: true,
                periodEnd: true,
                payDate: true,
                label: true,
                status: true
              }
            }
          },
          orderBy: {
            payrollPeriod: {
              payDate: "desc"
            }
          }
        }
      },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
      skip: (peoplePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.attendanceRecord.groupBy({
      by: ["date"],
      where: {
        employee: { shopId: user.shop.id }
      },
      orderBy: {
        date: "desc"
      }
    })
  ]);
  const savedAttendanceDateValues = savedAttendanceDateGroups.map((group) => toDateInputValue(group.date));
  const todayValue = toDateInputValue(new Date());
  const recentNoWorkDateValues = Array.from({ length: 90 }, (_, index) => {
    const date = parseDateInputValue(todayValue);
    date.setDate(date.getDate() - index);
    const value = toDateInputValue(date);
    return isWorkDate(date, workCalendar) ? null : value;
  }).filter((value): value is string => Boolean(value));
  const attendanceDateValues = Array.from(new Set([...savedAttendanceDateValues, ...recentNoWorkDateValues])).sort((a, b) => b.localeCompare(a));
  const attendanceTotal = attendanceDateValues.length;
  const pagedAttendanceDateValues = attendanceDateValues.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE);
  const pagedAttendanceDates = pagedAttendanceDateValues.map((value) => parseDateInputValue(value));
  const attendanceRangeStart = pagedAttendanceDates.length
    ? pagedAttendanceDates.reduce((min, date) => (date < min ? date : min))
    : null;
  const attendanceRangeEnd = pagedAttendanceDates.length
    ? pagedAttendanceDates.reduce((max, date) => (date > max ? date : max))
    : null;
  const attendanceRecords = pagedAttendanceDates.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          employee: { shopId: user.shop.id },
          date: {
            gte: startOfDayLocal(attendanceRangeStart!),
            lte: endOfDayLocal(attendanceRangeEnd!)
          }
        },
        include: {
          employee: {
            select: {
              fullName: true,
              employeeCode: true,
              position: true
            }
          }
        },
        orderBy: [{ date: "desc" }, { employee: { fullName: "asc" } }]
      })
    : [];
  const recordsByDate = new Map(
    pagedAttendanceDateValues.map((dateValue) => [
      dateValue,
      attendanceRecords.filter((record) => toDateInputValue(record.date) === dateValue)
    ])
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description={activeTab === "attendance" ? "Browse daily absences and half days in a simple list." : "Maintain your worker master list and daily rates."}
        action={
          <>
            {activeTab === "people" ? <EmployeeSearchForm initialValue={search} /> : null}
            <EmployeeCreateModal />
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-[22px] border border-[rgba(88,150,88,0.30)] bg-[rgba(250,255,247,0.86)] p-2">
        <a
          href={buildEmployeesHref({ tab: "people", search })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "people" ? "bg-[#e2f2d9] text-[#2f7d5b] shadow-sm" : "text-stone-600 hover:bg-white/70"
          }`}
        >
          <UsersRound className="h-4 w-4 shrink-0" />
          <span className="truncate">People</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{employeeCount}</span>
        </a>
        <a
          href={buildEmployeesHref({ tab: "attendance" })}
          className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            activeTab === "attendance" ? "bg-[#fff1cf] text-[#9a5b05] shadow-sm" : "text-stone-600 hover:bg-white/70"
          }`}
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">Attendance</span>
          <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px]">{attendanceTotal}</span>
        </a>
      </div>

      {activeTab === "attendance" ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[rgba(148,190,139,0.35)] px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-stone-950">Attendance Summary</h2>
            <p className="mt-1 text-sm text-[#7a7168]">Saved attendance and no-work days in one compact list.</p>
          </div>

          <div className="divide-y divide-[rgba(148,190,139,0.28)]">
            {pagedAttendanceDates.length ? (
              pagedAttendanceDates.map((date) => {
                const key = toDateInputValue(date);
                const noWork = !isWorkDate(date, workCalendar);
                const records = recordsByDate.get(key) ?? [];
                const absent = records.filter((record) => record.status === "ABSENT").map((record) => record.employee.fullName);
                const halfDay = records.filter((record) => String(record.status) === "HALF_DAY").map((record) => record.employee.fullName);
                const isPerfect = absent.length === 0 && halfDay.length === 0;

                return (
                  <div key={key} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3 sm:px-5">
                    <div className="font-semibold text-stone-950">{formatDate(date)}</div>
                    <div className="min-w-0 space-y-1">
                      {noWork ? (
                        <div className="font-semibold text-[#8a5f20]">No work day</div>
                      ) : isPerfect ? (
                        <div className="font-semibold text-emerald-700">Perfect attendance</div>
                      ) : null}
                      {absent.length ? (
                        <div className="min-w-0 text-rose-700">
                          <span className="font-semibold">{absent.length} Absent</span>
                          <span className="text-stone-700">({absent.join(", ")})</span>
                        </div>
                      ) : null}
                      {halfDay.length ? (
                        <div className="min-w-0 text-lime-700">
                          <span className="font-semibold">{halfDay.length} Half-day</span>
                          <span className="text-stone-700">({halfDay.join(", ")})</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-sm text-[#7a7168]">No saved attendance records yet.</div>
            )}
          </div>

          <div className="px-4 pb-4 sm:px-5">
            <PaginationControls
              pathname="/employees"
              params={{ tab: "attendance", attendancePage }}
              pageParam="attendancePage"
              page={attendancePage}
              total={attendanceTotal}
              pageSize={PAGE_SIZE}
            />
          </div>
        </section>
      ) : (
        <>
          <EmployeeCardGrid
            employees={employees.map((employee) => {
              const baseDate =
                employee.startDate && startOfDayLocal(employee.startDate) > startOfDayLocal(new Date())
                  ? startOfDayLocal(employee.startDate)
                  : startOfDayLocal(new Date());
              const upcomingPayDate = getPayDateForDate(baseDate, employee, workCalendar);
              const upcomingPeriod = getPeriodForPayDate(upcomingPayDate, employee, workCalendar);
              const lastPaidEntry = employee.payrollEntries.find((entry) => entry.payrollPeriod.status === "PAID") ?? null;
              const upcomingMetrics = getLivePayrollAttendanceMetrics({
                employee,
                periodStart: upcomingPeriod.periodStart,
                periodEnd: upcomingPeriod.periodEnd,
                attendanceRecords: employee.attendanceRecords,
                calendar: workCalendar
              });
              const buildPayrollDetail = ({
                periodStart,
                periodEnd,
                periodLabel,
                daysPresent,
                daysHalf,
                daysAbsent,
                paidDayUnits,
                grossPay,
                bonusesAdded,
                manualBonusAmount = 0,
                advancesDeducted,
                manualAdvanceDeductionAmount = 0,
                outstandingAdvanceBalance = 0,
                payablesDeducted,
                expectedAmount
              }: {
                periodStart: Date;
                periodEnd: Date;
                periodLabel: string;
                daysPresent: number;
                daysHalf: number;
                daysAbsent: number;
                paidDayUnits: number;
                grossPay: number;
                bonusesAdded: number;
                manualBonusAmount?: number;
                advancesDeducted: number;
                manualAdvanceDeductionAmount?: number;
                outstandingAdvanceBalance?: number;
                payablesDeducted: number;
                expectedAmount: number;
              }): TimelineEmployeeDetail => {
                const periodRecords = employee.attendanceRecords.filter(
                  (record) => record.date >= startOfDayLocal(periodStart) && record.date <= endOfDayLocal(periodEnd)
                );

                return {
                  employeeId: employee.id,
                  employeeName: employee.fullName,
                  employeeCode: employee.employeeCode,
                  photoDataUrl: employee.photoDataUrl,
                  position: employee.position,
                  frequencyLabel: describePayrollFrequency(employee),
                  periodLabel,
                  calendarMode: employee.payrollFrequency === "WEEKLY" ? "weekday" : "date",
                  attendanceCalendarDays: buildEmployeeAttendanceCalendarDays({
                    periodStart,
                    periodEnd,
                    attendanceRecords: periodRecords,
                    workCalendar
                  }),
                  absentDates: periodRecords.filter((record) => record.status === "ABSENT").map((record) => toDateInputValue(record.date)),
                  halfDayDates: periodRecords.filter((record) => record.status === "HALF_DAY").map((record) => toDateInputValue(record.date)),
                  daysAbsent,
                  daysHalf,
                  estimatedDays: daysPresent,
                  paidDayUnits,
                  dailyRate: Number(employee.dailyRate),
                  grossPay,
                  bonusesAdded,
                  manualBonusAmount,
                  advancesDeducted,
                  manualAdvanceDeductionAmount,
                  outstandingAdvanceBalance,
                  payablesDeducted,
                  manualOtherDeductionAmount: 0,
                  expectedAmount
                };
              };
              const lastPaidTimelineEntry: TimelineEntry | null = lastPaidEntry
                ? {
                    id: `employee-${employee.id}-paid-${toDateInputValue(lastPaidEntry.payrollPeriod.payDate)}`,
                    payDateValue: toDateInputValue(lastPaidEntry.payrollPeriod.payDate),
                    payDateLabel: formatDate(lastPaidEntry.payrollPeriod.payDate),
                    dueLabel: "Paid",
                    isPaid: true,
                    expectedTotal: Number(lastPaidEntry.netPay),
                    employeeNames: [employee.fullName],
                    details: [
                      buildPayrollDetail({
                        periodStart: lastPaidEntry.payrollPeriod.periodStart,
                        periodEnd: lastPaidEntry.payrollPeriod.periodEnd,
                        periodLabel: lastPaidEntry.payrollPeriod.label.replace(/^Payroll - /, ""),
                        daysPresent: lastPaidEntry.daysPresent,
                        daysHalf: Number(lastPaidEntry.daysHalf ?? 0),
                        daysAbsent: lastPaidEntry.daysAbsent,
                        paidDayUnits: lastPaidEntry.daysPresent + Number(lastPaidEntry.daysHalf ?? 0) * 0.5,
                        grossPay: Number(lastPaidEntry.grossPay),
                        bonusesAdded: Number(lastPaidEntry.totalBonusesAdded),
                        advancesDeducted: Number(lastPaidEntry.totalAdvancesDeducted),
                        payablesDeducted: Number(lastPaidEntry.totalPayablesDeducted),
                        expectedAmount: Number(lastPaidEntry.netPay)
                      })
                    ]
                  }
                : null;
              const upcomingTimelineEntry: TimelineEntry = {
                id: `employee-${employee.id}-upcoming-${toDateInputValue(upcomingPayDate)}`,
                payDateValue: toDateInputValue(upcomingPayDate),
                payDateLabel: formatDate(upcomingPayDate),
                dueLabel: "Upcoming",
                isPaid: false,
                expectedTotal: upcomingMetrics.grossPay,
                employeeNames: [employee.fullName],
                details: [
                  buildPayrollDetail({
                    periodStart: upcomingPeriod.periodStart,
                    periodEnd: upcomingPeriod.periodEnd,
                    periodLabel: upcomingPeriod.label,
                    daysPresent: upcomingMetrics.daysPresent,
                    daysHalf: upcomingMetrics.daysHalf,
                    daysAbsent: upcomingMetrics.daysAbsent,
                    paidDayUnits: upcomingMetrics.paidDayUnits,
                    grossPay: upcomingMetrics.grossPay,
                    bonusesAdded: 0,
                    advancesDeducted: 0,
                    outstandingAdvanceBalance: employee.advances.reduce((total, advance) => total + Number(advance.remainingBalance), 0),
                    payablesDeducted: 0,
                    expectedAmount: upcomingMetrics.grossPay
                  })
                ]
              };

              return {
                id: employee.id,
                employeeCode: employee.employeeCode,
                fullName: employee.fullName,
                position: employee.position,
                dailyRate: employee.dailyRate.toString(),
                status: employee.status,
                payrollFrequency: employee.payrollFrequency,
                weeklyPayDay: employee.weeklyPayDay,
                monthlyPayDay: employee.monthlyPayDay,
                twiceMonthlyDayOne: employee.twiceMonthlyDayOne,
                twiceMonthlyDayTwo: employee.twiceMonthlyDayTwo,
                everyNDays: employee.everyNDays,
                startDate: employee.startDate ? employee.startDate.toISOString() : null,
                lastPaidDate: employee.lastPaidDate ? employee.lastPaidDate.toISOString() : null,
                contactNumber: employee.contactNumber,
                photoDataUrl: employee.photoDataUrl,
                notes: employee.notes,
                createdAt: employee.createdAt.toISOString(),
                updatedAt: employee.updatedAt.toISOString(),
                attendanceRecords: employee.attendanceRecords.map((record) => ({
                  date: record.date.toISOString(),
                  status: record.status,
                  remarks: record.remarks
                })),
                payrollDates: employee.payrollEntries.map((entry) => ({
                  date: entry.payrollPeriod.payDate.toISOString(),
                  label: entry.payrollPeriod.label
                })),
                remainingAdvanceBalance: employee.advances
                  .reduce((total, advance) => total + Number(advance.remainingBalance), 0)
                  .toString(),
                payrollSnapshot: {
                  lastPaidDate: lastPaidEntry ? lastPaidEntry.payrollPeriod.payDate.toISOString() : employee.lastPaidDate?.toISOString() ?? null,
                  lastPaidLabel: lastPaidEntry ? lastPaidEntry.payrollPeriod.label.replace(/^Payroll - /, "") : null,
                  lastPaidAmount: lastPaidEntry ? lastPaidEntry.netPay.toString() : null,
                  upcomingPayDate: upcomingPayDate.toISOString(),
                  upcomingPeriodLabel: upcomingPeriod.label,
                  lastPaidEntry: lastPaidTimelineEntry,
                  upcomingEntry: upcomingTimelineEntry
                }
              };
            })}
          />
          <PaginationControls
            pathname="/employees"
            params={{ search, page: peoplePage }}
            page={peoplePage}
            total={employeeCount}
            pageSize={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}
