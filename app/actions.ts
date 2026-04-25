"use server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, DeductionType, EmployeeStatus, LedgerStatus, PayrollFrequency, PayrollPeriodStatus } from "@prisma/client";
import { login as doLogin, register as doRegister, requireUser, logout } from "@/lib/auth";
import { getCoveredDaysForPayroll, getEffectivePayrollStart, getLivePayrollAttendanceMetrics } from "@/lib/payroll-live";
import { prisma } from "@/lib/prisma";
import { endOfDayLocal, parseDateInputValue, startOfDayLocal, toDateInputValue } from "@/lib/utils";
import { getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";
import { getShopWorkCalendar, isWorkDate, serializeWorkDays } from "@/lib/work-schedule";

const moneySchema = z.coerce.number().min(0);
const ACTION_TIMEOUT_MS = 10000;

async function withActionTimeout<T>(promise: Promise<T>, timeoutMs = ACTION_TIMEOUT_MS) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getAdvanceDeductionForPayroll({
  runningNet,
  remainingBalance,
  deductionPerPayroll
}: {
  runningNet: Prisma.Decimal;
  remainingBalance: Prisma.Decimal;
  deductionPerPayroll: Prisma.Decimal | null;
}) {
  const cappedBalance =
    deductionPerPayroll && deductionPerPayroll.lessThan(remainingBalance) ? deductionPerPayroll : remainingBalance;

  if (runningNet.lessThan(cappedBalance)) {
    return runningNet;
  }

  return cappedBalance;
}

function getEmployeeCodeSequence(employeeCode: string) {
  const match = employeeCode.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function formatEmployeeCode(sequence: number) {
  return `EMP-${String(sequence).padStart(3, "0")}`;
}

async function getNextEmployeeCode(tx: Prisma.TransactionClient, shopId: string) {
  const existingCodes = await tx.employee.findMany({
    where: { shopId },
    select: { employeeCode: true }
  });

  const nextSequence =
    existingCodes.reduce((maxSequence, employee) => Math.max(maxSequence, getEmployeeCodeSequence(employee.employeeCode)), 0) + 1;

  return formatEmployeeCode(nextSequence);
}

function isEmployeeCodeConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("shopId") &&
    error.meta.target.includes("employeeCode")
  );
}

async function createEmployeeWithGeneratedCode({
  shopId,
  fullName,
  position,
  dailyRate,
  contactNumber,
  startDate,
  lastPaidDate,
  notes,
  payrollSchedule
}: {
  shopId: string;
  fullName: string;
  position?: string;
  dailyRate: number;
  contactNumber?: string;
  startDate?: string;
  lastPaidDate?: string;
  notes?: string;
  payrollSchedule: ReturnType<typeof parseEmployeePayrollSchedule>;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const employeeCode = await getNextEmployeeCode(tx, shopId);

        return tx.employee.create({
          data: {
            shopId,
            employeeCode,
            fullName,
            position: position || null,
            dailyRate: new Prisma.Decimal(dailyRate),
            contactNumber: contactNumber || null,
            startDate: startDate ? parseDateInputValue(startDate) : null,
            lastPaidDate: lastPaidDate ? parseDateInputValue(lastPaidDate) : null,
            notes: notes || null,
            payrollFrequency: payrollSchedule.payrollFrequency,
            weeklyPayDay: payrollSchedule.weeklyPayDay,
            monthlyPayDay: payrollSchedule.monthlyPayDay,
            twiceMonthlyDayOne: payrollSchedule.twiceMonthlyDayOne,
            twiceMonthlyDayTwo: payrollSchedule.twiceMonthlyDayTwo,
            everyNDays: payrollSchedule.everyNDays,
            status: EmployeeStatus.ACTIVE
          }
        });
      });
    } catch (error) {
      if (isEmployeeCodeConflict(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate a unique employee code for this shop.");
}

async function requireShopEmployee(shopId: string, employeeId: string) {
  return prisma.employee.findFirstOrThrow({
    where: {
      id: employeeId,
      shopId
    }
  });
}

async function hasPayrollAttendanceMismatch(
  tx: Prisma.TransactionClient,
  periods: Array<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    payrollEntries: Array<{
      daysPresent: number;
      daysHalf?: number;
      daysAbsent: number;
      employee: {
        id: string;
        startDate: Date | null;
        dailyRate: Prisma.Decimal;
      };
    }>;
  }>,
  workCalendar = undefined as Awaited<ReturnType<typeof getShopWorkCalendar>> | undefined
) {
  if (!periods.length) {
    return false;
  }

  const employeeIds = Array.from(new Set(periods.flatMap((period) => period.payrollEntries.map((entry) => entry.employee.id))));
  if (!employeeIds.length) {
    return false;
  }

  const rangeStart = periods.reduce(
    (min, period) => (period.periodStart < min ? period.periodStart : min),
    periods[0].periodStart
  );
  const rangeEnd = periods.reduce((max, period) => (period.periodEnd > max ? period.periodEnd : max), periods[0].periodEnd);

  const attendanceRecords = await tx.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: {
        gte: startOfDayLocal(rangeStart),
        lte: endOfDayLocal(rangeEnd)
      }
    },
    select: {
      employeeId: true,
      date: true,
      status: true
    }
  });

  const attendanceByEmployee = new Map<string, typeof attendanceRecords>();
  for (const employeeId of employeeIds) {
    attendanceByEmployee.set(
      employeeId,
      attendanceRecords.filter((record) => record.employeeId === employeeId)
    );
  }

  return periods.some((period) =>
    period.payrollEntries.some((entry) => {
      const liveMetrics = getLivePayrollAttendanceMetrics({
        employee: entry.employee,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        attendanceRecords: attendanceByEmployee.get(entry.employee.id) ?? [],
        calendar: workCalendar
      });

      return (
        liveMetrics.daysPresent !== entry.daysPresent ||
        liveMetrics.daysHalf !== (entry.daysHalf ?? 0) ||
        liveMetrics.daysAbsent !== entry.daysAbsent
      );
    })
  );
}

async function syncOpenPayrollEntriesWithWorkCalendar(
  tx: Prisma.TransactionClient,
  periods: Array<{
    id: string;
    status: PayrollPeriodStatus;
    periodStart: Date;
    periodEnd: Date;
    payrollEntries: Array<{
      id: string;
      totalBonusesAdded?: Prisma.Decimal | null;
      totalAdvancesDeducted: Prisma.Decimal;
      totalPayablesDeducted: Prisma.Decimal;
      employee: {
        id: string;
        startDate: Date | null;
        dailyRate: Prisma.Decimal;
      };
    }>;
  }>,
  workCalendar: Awaited<ReturnType<typeof getShopWorkCalendar>>
) {
  const openPeriods = periods.filter((period) => period.status !== PayrollPeriodStatus.PAID);
  const employeeIds = Array.from(new Set(openPeriods.flatMap((period) => period.payrollEntries.map((entry) => entry.employee.id))));

  if (!openPeriods.length || !employeeIds.length) {
    return;
  }

  const rangeStart = openPeriods.reduce(
    (min, period) => (period.periodStart < min ? period.periodStart : min),
    openPeriods[0].periodStart
  );
  const rangeEnd = openPeriods.reduce((max, period) => (period.periodEnd > max ? period.periodEnd : max), openPeriods[0].periodEnd);
  const attendanceRecords = await tx.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: {
        gte: startOfDayLocal(rangeStart),
        lte: endOfDayLocal(rangeEnd)
      }
    },
    select: {
      employeeId: true,
      date: true,
      status: true
    }
  });

  for (const period of openPeriods) {
    for (const entry of period.payrollEntries) {
      const liveMetrics = getLivePayrollAttendanceMetrics({
        employee: entry.employee,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        attendanceRecords: attendanceRecords.filter((record) => record.employeeId === entry.employee.id),
        calendar: workCalendar
      });
      const grossPay = new Prisma.Decimal(liveMetrics.grossPay);
      const bonusesAdded = entry.totalBonusesAdded ?? new Prisma.Decimal(0);
      const computedNetPay = grossPay.plus(bonusesAdded).minus(entry.totalAdvancesDeducted).minus(entry.totalPayablesDeducted);
      const netPay = computedNetPay.isNegative() ? new Prisma.Decimal(0) : computedNetPay;

      await tx.payrollEntry.update({
        where: { id: entry.id },
        data: {
          daysPresent: liveMetrics.daysPresent,
          daysHalf: liveMetrics.daysHalf,
          daysAbsent: liveMetrics.daysAbsent,
          grossPay,
          netPay
        } as never
      });
    }
  }
}

async function ensurePayrollPeriodsForDate({
  shopId,
  targetDate
}: {
  shopId: string;
  targetDate: Date;
}) {
  let dueCount = 0;
  const workCalendar = await getShopWorkCalendar(shopId);

  await prisma.$transaction(async (tx) => {
    const employees = await tx.employee.findMany({ where: { shopId, status: EmployeeStatus.ACTIVE } });
    const dueEmployees = employees
      .map((employee) => {
        const computedPayDate = getPayDateForDate(targetDate, employee, workCalendar);
        const isDue = toDateInputValue(computedPayDate) === toDateInputValue(targetDate);
        if (!isDue) return null;
        const period = getPeriodForPayDate(targetDate, employee, workCalendar);
        return { employee, period };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    dueCount = dueEmployees.length;
    if (!dueEmployees.length) {
      return;
    }

    const payrollPeriods = new Map<string, { id: string }>();

    for (const { employee, period } of dueEmployees) {
      const key = `${period.periodStart.toISOString()}__${period.periodEnd.toISOString()}`;
      let payrollPeriod = payrollPeriods.get(key);

      if (!payrollPeriod) {
        const upserted = await tx.payrollPeriod.upsert({
          where: {
            shopId_periodStart_periodEnd: {
              shopId,
              periodStart: period.periodStart,
              periodEnd: period.periodEnd
            }
          },
          update: {
            payDate: period.payDate,
            label: `Payroll - ${period.label}`
          },
          create: {
            shopId,
            label: `Payroll - ${period.label}`,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            payDate: period.payDate,
            status: PayrollPeriodStatus.DRAFT
          }
        });
        payrollPeriod = { id: upserted.id };
        payrollPeriods.set(key, payrollPeriod);
      }

      const existingEntry = await tx.payrollEntry.findUnique({
        where: {
          payrollPeriodId_employeeId: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id
          }
        }
      });

      if (existingEntry) {
        continue;
      }

      const coveredDays = getCoveredDaysForPayroll(period.periodStart, period.periodEnd, employee.startDate, workCalendar);
      const effectiveAttendanceStart = getEffectivePayrollStart(period.periodStart, employee.startDate);

      const attendance =
        coveredDays === 0
          ? []
          : await tx.attendanceRecord.findMany({
              where: {
                employeeId: employee.id,
                date: {
                  gte: effectiveAttendanceStart,
                  lte: endOfDayLocal(period.periodEnd)
                }
              }
            });

      const payableAttendance = attendance.filter((item) => isWorkDate(item.date, workCalendar));
      const daysAbsent = payableAttendance.filter((item) => item.status === "ABSENT").length;
      const daysHalf = payableAttendance.filter((item) => String(item.status) === "HALF_DAY").length;
      const daysPresent = Math.max(coveredDays - daysAbsent - daysHalf, 0);
      const paidDayUnits = new Prisma.Decimal(daysPresent).plus(new Prisma.Decimal(daysHalf).mul(0.5));
      const grossPay = paidDayUnits.mul(employee.dailyRate);
      const bonuses = await tx.bonus.findMany({
        where: {
          employeeId: employee.id,
          status: LedgerStatus.OPEN,
          date: { lte: endOfDayLocal(period.periodEnd) }
        },
        orderBy: { date: "asc" }
      });

      const advances = await tx.advance.findMany({
        where: {
          employeeId: employee.id,
          status: LedgerStatus.OPEN,
          date: { lte: endOfDayLocal(period.periodEnd) }
        },
        orderBy: { date: "asc" }
      });

      const payables = await tx.payable.findMany({
        where: {
          employeeId: employee.id,
          status: LedgerStatus.OPEN,
          date: { lte: endOfDayLocal(period.periodEnd) }
        },
        orderBy: { date: "asc" }
      });

      let bonusTotal = new Prisma.Decimal(0);
      for (const bonus of bonuses) {
        bonusTotal = bonusTotal.plus(bonus.amount);
      }

      let runningNet = grossPay.plus(bonusTotal);
      let deductedAdvanceTotal = new Prisma.Decimal(0);
      let deductedPayableTotal = new Prisma.Decimal(0);

      for (const bonus of bonuses) {
        await tx.bonus.update({
          where: { id: bonus.id },
          data: {
            status: LedgerStatus.CLOSED
          }
        });
      }

      for (const advance of advances) {
        if (runningNet.lte(0)) break;
        const deduction = getAdvanceDeductionForPayroll({
          runningNet,
          remainingBalance: advance.remainingBalance,
          deductionPerPayroll: advance.deductionPerPayroll
        });
        if (deduction.gt(0)) {
          runningNet = runningNet.minus(deduction);
          deductedAdvanceTotal = deductedAdvanceTotal.plus(deduction);
          const newRemaining = advance.remainingBalance.minus(deduction);
          await tx.advance.update({
            where: { id: advance.id },
            data: {
              deductedAmount: advance.deductedAmount.plus(deduction),
              remainingBalance: newRemaining,
              status: newRemaining.eq(0) ? LedgerStatus.CLOSED : LedgerStatus.OPEN
            }
          });
        }
      }

      for (const payable of payables) {
        if (runningNet.lte(0)) break;
        const deduction = runningNet.lessThan(payable.remainingBalance) ? runningNet : payable.remainingBalance;
        if (deduction.gt(0)) {
          runningNet = runningNet.minus(deduction);
          deductedPayableTotal = deductedPayableTotal.plus(deduction);
          const newRemaining = payable.remainingBalance.minus(deduction);
          await tx.payable.update({
            where: { id: payable.id },
            data: {
              deductedAmount: payable.deductedAmount.plus(deduction),
              remainingBalance: newRemaining,
              status: newRemaining.eq(0) ? LedgerStatus.CLOSED : LedgerStatus.OPEN
            }
          });
        }
      }

      await tx.payrollEntry.create({
        data: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: employee.id,
          daysPresent,
          daysHalf,
          daysAbsent,
          grossPay,
          totalBonusesAdded: bonusTotal,
          totalAdvancesDeducted: deductedAdvanceTotal,
          totalPayablesDeducted: deductedPayableTotal,
          netPay: runningNet
        } as never
      });
    }
  });

  return dueCount;
}

function parseEmployeePayrollSchedule(formData: FormData) {
  const payrollFrequency = z.nativeEnum(PayrollFrequency).parse(formData.get("payrollFrequency"));
  const weeklyPayDay = formData.get("weeklyPayDay");
  const monthlyPayDay = formData.get("monthlyPayDay");
  const twiceDayOne = formData.get("twiceMonthlyDayOne");
  const twiceDayTwo = formData.get("twiceMonthlyDayTwo");
  const everyNDays = formData.get("everyNDays");
  const parseNumericDay = (value: FormDataEntryValue | null, fallback: number, min: number, max: number) =>
    z.coerce.number().int().min(min).max(max).parse(value ?? fallback);

  return {
    payrollFrequency,
    weeklyPayDay: payrollFrequency === PayrollFrequency.WEEKLY ? parseNumericDay(weeklyPayDay, 5, 0, 6) : null,
    monthlyPayDay: payrollFrequency === PayrollFrequency.MONTHLY ? parseNumericDay(monthlyPayDay, 15, 1, 31) : null,
    twiceMonthlyDayOne:
      payrollFrequency === PayrollFrequency.TWICE_MONTHLY ? parseNumericDay(twiceDayOne, 15, 1, 31) : null,
    twiceMonthlyDayTwo:
      payrollFrequency === PayrollFrequency.TWICE_MONTHLY ? parseNumericDay(twiceDayTwo, 30, 1, 31) : null,
    everyNDays:
      payrollFrequency === PayrollFrequency.EVERY_N_DAYS ? parseNumericDay(everyNDays, 7, 2, 365) : null
  };
}

function ensureEmployeeScheduleAnchor({
  payrollFrequency,
  startDate,
  lastPaidDate
}: {
  payrollFrequency: PayrollFrequency;
  startDate?: string;
  lastPaidDate?: string;
}) {
  if (payrollFrequency === PayrollFrequency.EVERY_N_DAYS && !startDate && !lastPaidDate) {
    throw new Error("Start date or last paid date is required for every N days payroll schedules.");
  }
}

function optionalFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

export async function loginAction(formData: FormData) {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const ok = await withActionTimeout(doLogin(parsed.data.email, parsed.data.password));
  if (!ok) {
    redirect("/login?error=credentials");
  }

  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const schema = z
    .object({
      ownerName: z.string().trim().min(1),
      shopName: z.string().trim().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string().min(8)
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"]
    });

  const parsed = schema.safeParse({
    ownerName: formData.get("ownerName"),
    shopName: formData.get("shopName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    redirect("/login?mode=register&error=register-invalid");
  }

  try {
    const user = await withActionTimeout(
      doRegister({
        ownerName: parsed.data.ownerName,
        shopName: parsed.data.shopName,
        email: parsed.data.email,
        password: parsed.data.password
      })
    );

    if (!user) {
      redirect("/login?mode=register&error=register-invalid");
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/login?mode=register&error=email-taken");
    }

    throw error;
  }

  redirect("/dashboard");
}


export async function logoutAction() {
  await logout();
  redirect("/login");
}
export async function createEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    fullName: z.string().min(1),
    position: z.string().optional(),
    dailyRate: moneySchema,
    contactNumber: z.string().optional(),
    startDate: z.string().optional(),
    lastPaidDate: z.string().optional(),
    notes: z.string().optional()
  });
  const payrollSchedule = parseEmployeePayrollSchedule(formData);

  const parsed = schema.parse({
    fullName: formData.get("fullName"),
    position: optionalFormString(formData.get("position")),
    dailyRate: formData.get("dailyRate"),
    contactNumber: optionalFormString(formData.get("contactNumber")),
    startDate: optionalFormString(formData.get("startDate")),
    lastPaidDate: optionalFormString(formData.get("lastPaidDate")),
    notes: optionalFormString(formData.get("notes"))
  });

  ensureEmployeeScheduleAnchor({
    payrollFrequency: payrollSchedule.payrollFrequency,
    startDate: parsed.startDate,
    lastPaidDate: parsed.lastPaidDate
  });

  await createEmployeeWithGeneratedCode({
    shopId: user.shop.id,
    fullName: parsed.fullName,
    position: parsed.position,
    dailyRate: parsed.dailyRate,
    contactNumber: parsed.contactNumber,
    startDate: parsed.startDate,
    lastPaidDate: parsed.lastPaidDate,
    notes: parsed.notes,
    payrollSchedule
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    employeeId: z.string().min(1),
    fullName: z.string().min(1),
    position: z.string().optional(),
    dailyRate: moneySchema,
    contactNumber: z.string().optional(),
    startDate: z.string().optional(),
    lastPaidDate: z.string().optional(),
    notes: z.string().optional()
  });
  const payrollSchedule = parseEmployeePayrollSchedule(formData);

  const parsed = schema.parse({
    employeeId: formData.get("employeeId"),
    fullName: formData.get("fullName"),
    position: optionalFormString(formData.get("position")),
    dailyRate: formData.get("dailyRate"),
    contactNumber: optionalFormString(formData.get("contactNumber")),
    startDate: optionalFormString(formData.get("startDate")),
    lastPaidDate: optionalFormString(formData.get("lastPaidDate")),
    notes: optionalFormString(formData.get("notes"))
  });

  ensureEmployeeScheduleAnchor({
    payrollFrequency: payrollSchedule.payrollFrequency,
    startDate: parsed.startDate,
    lastPaidDate: parsed.lastPaidDate
  });

  await requireShopEmployee(user.shop.id, parsed.employeeId);

  await prisma.employee.update({
    where: { id: parsed.employeeId },
    data: {
      fullName: parsed.fullName,
      position: parsed.position || null,
      dailyRate: new Prisma.Decimal(parsed.dailyRate),
      contactNumber: parsed.contactNumber || null,
      startDate: parsed.startDate ? parseDateInputValue(parsed.startDate) : null,
      lastPaidDate: parsed.lastPaidDate ? parseDateInputValue(parsed.lastPaidDate) : null,
      notes: parsed.notes || null,
      payrollFrequency: payrollSchedule.payrollFrequency,
      weeklyPayDay: payrollSchedule.weeklyPayDay,
      monthlyPayDay: payrollSchedule.monthlyPayDay,
      twiceMonthlyDayOne: payrollSchedule.twiceMonthlyDayOne,
      twiceMonthlyDayTwo: payrollSchedule.twiceMonthlyDayTwo,
      everyNDays: payrollSchedule.everyNDays
    }
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function toggleEmployeeStatusAction(formData: FormData) {
  const user = await requireUser();
  const employeeId = z.string().parse(formData.get("employeeId"));
  const current = z.nativeEnum(EmployeeStatus).parse(formData.get("currentStatus"));

  await requireShopEmployee(user.shop.id, employeeId);

  await prisma.employee.update({
    where: { id: employeeId },
    data: { status: current === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE }
  });

  revalidatePath("/employees");
}

export async function deleteEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const employeeId = z.string().parse(formData.get("employeeId"));

  await requireShopEmployee(user.shop.id, employeeId);

  await prisma.employee.delete({
    where: { id: employeeId }
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function saveAttendanceAction(formData: FormData) {
  const user = await requireUser();
  const date = z.string().parse(formData.get("date"));
  const redirectTo = z.string().optional().parse(formData.get("redirectTo")) || "/dashboard";
  const targetDate = startOfDayLocal(parseDateInputValue(date));
  const workCalendar = await getShopWorkCalendar(user.shop.id);

  if (!isWorkDate(parseDateInputValue(date), workCalendar)) {
    revalidatePath("/dashboard");
    redirect(`${redirectTo}?date=${date}&noWork=1`);
  }

  const employees = await prisma.employee.findMany({
    where: { shopId: user.shop.id, status: EmployeeStatus.ACTIVE },
    orderBy: { fullName: "asc" }
  });

  await prisma.$transaction(async (tx) => {
    for (const employee of employees) {
      const statusKey = `status_${employee.id}`;
      const remarksKey = `remarks_${employee.id}`;
      const remarks = String(formData.get(remarksKey) || "").trim();
      const rawStatus = String(formData.get(statusKey) || "present");
      const statusValue =
        rawStatus === "absent"
          ? ("ABSENT" as const)
          : rawStatus === "half_day"
            ? ("HALF_DAY" as const)
            : ("PRESENT" as const);

      await tx.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate
          }
        },
        update: {
          status: statusValue as never,
          remarks: remarks || null
        },
        create: {
          employeeId: employee.id,
          date: targetDate,
          status: statusValue as never,
          remarks: remarks || null
        }
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect(`${redirectTo}?date=${date}&saved=1`);
}

export async function createAdvanceAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    employeeId: z.string().min(1),
    date: z.string().min(1),
    amount: moneySchema.positive(),
    deductionPerPayroll: z
      .union([z.literal(""), z.coerce.number().positive()])
      .optional(),
    reason: z.string().optional()
  });

  const parsed = schema.parse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    deductionPerPayroll: formData.get("deductionPerPayroll"),
    reason: formData.get("reason")
  });

  const employee = await requireShopEmployee(user.shop.id, parsed.employeeId);

  await prisma.advance.create({
    data: {
      employeeId: employee.id,
      date: parseDateInputValue(parsed.date),
      amount: new Prisma.Decimal(parsed.amount),
      deductionPerPayroll:
        parsed.deductionPerPayroll === "" || parsed.deductionPerPayroll == null
          ? null
          : new Prisma.Decimal(parsed.deductionPerPayroll),
      deductedAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(parsed.amount),
      reason: parsed.reason || null,
      status: LedgerStatus.OPEN
    }
  });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  redirect("/advances?tab=advances");
}

export async function createBonusAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    employeeId: z.string().min(1),
    date: z.string().min(1),
    amount: moneySchema.positive(),
    reason: z.string().optional()
  });

  const parsed = schema.parse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    reason: formData.get("reason")
  });

  const employee = await requireShopEmployee(user.shop.id, parsed.employeeId);

  await prisma.bonus.create({
    data: {
      employeeId: employee.id,
      date: parseDateInputValue(parsed.date),
      amount: new Prisma.Decimal(parsed.amount),
      reason: parsed.reason || null,
      status: LedgerStatus.OPEN
    }
  });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/advances?tab=bonuses");
}


export async function updateAdvanceAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    advanceId: z.string().min(1),
    employeeId: z.string().min(1),
    date: z.string().min(1),
    amount: moneySchema.positive(),
    deductionPerPayroll: z
      .union([z.literal(""), z.coerce.number().positive()])
      .optional(),
    reason: z.string().optional(),
    status: z.nativeEnum(LedgerStatus)
  });

  const parsed = schema.parse({
    advanceId: formData.get("advanceId"),
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    deductionPerPayroll: formData.get("deductionPerPayroll"),
    reason: formData.get("reason"),
    status: formData.get("status")
  });

  const employee = await requireShopEmployee(user.shop.id, parsed.employeeId);
  const existing = await prisma.advance.findFirstOrThrow({
    where: {
      id: parsed.advanceId,
      employee: { shopId: user.shop.id }
    }
  });

  const nextAmount = new Prisma.Decimal(parsed.amount);
  const deductedAmount = existing.deductedAmount.greaterThan(nextAmount) ? nextAmount : existing.deductedAmount;
  const remainingBalance = parsed.status === LedgerStatus.CANCELLED ? new Prisma.Decimal(0) : nextAmount.minus(deductedAmount);
  const nextStatus = parsed.status === LedgerStatus.CANCELLED ? LedgerStatus.CANCELLED : remainingBalance.equals(0) ? LedgerStatus.CLOSED : parsed.status;

  await prisma.advance.update({
    where: { id: existing.id },
    data: {
      employeeId: employee.id,
      date: parseDateInputValue(parsed.date),
      amount: nextAmount,
      deductionPerPayroll:
        parsed.deductionPerPayroll === "" || parsed.deductionPerPayroll == null
          ? null
          : new Prisma.Decimal(parsed.deductionPerPayroll),
      deductedAmount,
      remainingBalance,
      reason: parsed.reason || null,
      status: nextStatus
    }
  });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/advances?tab=advances");
}

export async function deleteAdvanceAction(formData: FormData) {
  const user = await requireUser();
  const advanceId = z.string().min(1).parse(formData.get("advanceId"));

  const existing = await prisma.advance.findFirstOrThrow({
    where: {
      id: advanceId,
      employee: { shopId: user.shop.id }
    }
  });

  await prisma.advance.delete({ where: { id: existing.id } });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/advances?tab=advances");
}

export async function updateBonusAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    bonusId: z.string().min(1),
    employeeId: z.string().min(1),
    date: z.string().min(1),
    amount: moneySchema.positive(),
    reason: z.string().optional(),
    status: z.nativeEnum(LedgerStatus)
  });

  const parsed = schema.parse({
    bonusId: formData.get("bonusId"),
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
    status: formData.get("status")
  });

  const employee = await requireShopEmployee(user.shop.id, parsed.employeeId);
  const existing = await prisma.bonus.findFirstOrThrow({
    where: {
      id: parsed.bonusId,
      employee: { shopId: user.shop.id }
    }
  });

  await prisma.bonus.update({
    where: { id: existing.id },
    data: {
      employeeId: employee.id,
      date: parseDateInputValue(parsed.date),
      amount: new Prisma.Decimal(parsed.amount),
      reason: parsed.reason || null,
      status: parsed.status
    }
  });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/advances?tab=bonuses");
}

export async function deleteBonusAction(formData: FormData) {
  const user = await requireUser();
  const bonusId = z.string().min(1).parse(formData.get("bonusId"));

  const existing = await prisma.bonus.findFirstOrThrow({
    where: {
      id: bonusId,
      employee: { shopId: user.shop.id }
    }
  });

  await prisma.bonus.delete({ where: { id: existing.id } });

  revalidatePath("/advances");
  revalidatePath("/bonuses");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/advances?tab=bonuses");
}

export async function createPayableAction(formData: FormData) {
  const user = await requireUser();
  const schema = z.object({
    employeeId: z.string().min(1),
    date: z.string().min(1),
    amount: moneySchema.positive(),
    type: z.nativeEnum(DeductionType),
    remarks: z.string().optional()
  });

  const parsed = schema.parse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    remarks: formData.get("remarks")
  });

  const employee = await requireShopEmployee(user.shop.id, parsed.employeeId);

  await prisma.payable.create({
    data: {
      employeeId: employee.id,
      date: parseDateInputValue(parsed.date),
      amount: new Prisma.Decimal(parsed.amount),
      deductedAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(parsed.amount),
      type: parsed.type,
      remarks: parsed.remarks || null,
      status: LedgerStatus.OPEN
    }
  });

  revalidatePath("/payables");
  revalidatePath("/dashboard");
  redirect("/payables");
}

export async function savePayrollSettingsAction(formData: FormData) {
  const user = await requireUser();
  const autoGenerate = formData.get("autoGenerate") === "on";
  const workDays = serializeWorkDays(formData.getAll("workDays").map((value) => Number(value)));
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "PayrollSettings" ("id", "shopId", "frequency", "weeklyPayDay", "autoGenerate", "workDays", "createdAt", "updatedAt")
    VALUES (${id}, ${user.shop.id}, 'WEEKLY'::"PayrollFrequency", 5, ${autoGenerate}, ${workDays}, NOW(), NOW())
    ON CONFLICT ("shopId")
    DO UPDATE SET "autoGenerate" = ${autoGenerate}, "workDays" = ${workDays}, "updatedAt" = NOW()
  `;

  revalidatePath("/settings");
  revalidatePath("/payroll");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function addNoWorkDayAction(formData: FormData) {
  const user = await requireUser();
  const date = z.string().min(1).parse(formData.get("date"));
  const reason = optionalFormString(formData.get("reason"));
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "ShopNoWorkDay" ("id", "shopId", "date", "reason", "createdAt", "updatedAt")
    VALUES (${id}, ${user.shop.id}, ${parseDateInputValue(date)}, ${reason || null}, NOW(), NOW())
    ON CONFLICT ("shopId", "date")
    DO UPDATE SET "reason" = ${reason || null}, "updatedAt" = NOW()
  `;

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/settings?saved=1");
}

export async function deleteNoWorkDayAction(formData: FormData) {
  const user = await requireUser();
  const noWorkDayId = z.string().min(1).parse(formData.get("noWorkDayId"));

  await prisma.$executeRaw`
    DELETE FROM "ShopNoWorkDay"
    WHERE "id" = ${noWorkDayId} AND "shopId" = ${user.shop.id}
  `;

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect("/settings?saved=1");
}

export async function generatePayrollForDateAction(formData: FormData) {
  const user = await requireUser();
  const targetDate = startOfDayLocal(parseDateInputValue(z.string().parse(formData.get("targetDate"))));
  const dueCount = (await ensurePayrollPeriodsForDate({ shopId: user.shop.id, targetDate })) ?? 0;

  revalidatePath("/payroll");
  revalidatePath("/dashboard");
  redirect(`/payroll?payDate=${toDateInputValue(targetDate)}${dueCount ? "&generated=1" : "&error=no-due-employees"}`);
}

export async function finalizePayrollAction(formData: FormData) {
  const user = await requireUser();
  const payrollPeriodId = z.string().parse(formData.get("payrollPeriodId"));
  const payrollPeriod = await prisma.payrollPeriod.findFirstOrThrow({
    where: {
      id: payrollPeriodId,
      shopId: user.shop.id
    },
    include: {
      payrollEntries: {
        include: {
          employee: {
            select: {
              id: true,
              startDate: true,
              dailyRate: true
            }
          }
        }
      }
    }
  });

  const workCalendar = await getShopWorkCalendar(user.shop.id);
  await prisma.$transaction((tx) => syncOpenPayrollEntriesWithWorkCalendar(tx, [payrollPeriod], workCalendar));

  await prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { status: PayrollPeriodStatus.FINALIZED } });
  revalidatePath("/payroll");
}

export async function markPayrollPaidForDateAction(formData: FormData) {
  const user = await requireUser();
  const targetDate = startOfDayLocal(parseDateInputValue(z.string().parse(formData.get("payDate"))));
  const redirectTo = String(formData.get("redirectTo") || "/dashboard");
  const dueCount = (await ensurePayrollPeriodsForDate({ shopId: user.shop.id, targetDate })) ?? 0;

  if (!dueCount) {
    revalidatePath("/dashboard");
    revalidatePath("/payroll");
    redirect(
      redirectTo === "/payroll"
        ? `/payroll?error=no-due-payroll`
        : `/dashboard?error=no-due-payroll&date=${toDateInputValue(targetDate)}`
    );
  }

  const duePeriods = await prisma.payrollPeriod.findMany({
    where: {
      shopId: user.shop.id,
      payDate: {
        gte: startOfDayLocal(targetDate),
        lte: endOfDayLocal(targetDate)
      }
    },
    include: {
      payrollEntries: {
        include: {
          employee: {
            select: {
              id: true,
              startDate: true,
              dailyRate: true
            }
          }
        }
      }
    }
  });

  const workCalendar = await getShopWorkCalendar(user.shop.id);
  await prisma.$transaction((tx) => syncOpenPayrollEntriesWithWorkCalendar(tx, duePeriods, workCalendar));

  await prisma.payrollPeriod.updateMany({
    where: {
      shopId: user.shop.id,
      payDate: {
        gte: startOfDayLocal(targetDate),
        lte: endOfDayLocal(targetDate)
      }
    },
    data: {
      status: PayrollPeriodStatus.PAID
    }
  });

  const paidEntries = await prisma.payrollEntry.findMany({
    where: {
      payrollPeriod: {
        shopId: user.shop.id,
        payDate: {
          gte: startOfDayLocal(targetDate),
          lte: endOfDayLocal(targetDate)
        }
      }
    },
    include: {
      payrollPeriod: {
        select: {
          payDate: true
        }
      },
      employee: {
        select: {
          id: true,
          payrollFrequency: true
        }
      }
    }
  });

  await prisma.$transaction(
    paidEntries
      .map((entry) =>
        prisma.employee.update({
          where: { id: entry.employee.id },
          data: {
            lastPaidDate: entry.payrollPeriod.payDate
          }
        })
      )
  );

  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/payroll");
  redirect(redirectTo === "/payroll" ? "/payroll?paid=1" : `/dashboard?paid=1&date=${toDateInputValue(targetDate)}`);
}
