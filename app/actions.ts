"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, DeductionType, EmployeeStatus, LedgerStatus, PayrollFrequency, PayrollPeriodStatus } from "@prisma/client";
import { login as doLogin, requireUser, logout } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDayLocal, startOfDayLocal } from "@/lib/utils";
import { getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";

const moneySchema = z.coerce.number().min(0);

function parseEmployeePayrollSchedule(formData: FormData) {
  const payrollFrequency = z.nativeEnum(PayrollFrequency).parse(formData.get("payrollFrequency"));
  const weeklyPayDay = formData.get("weeklyPayDay");
  const monthlyPayDay = formData.get("monthlyPayDay");
  const twiceDayOne = formData.get("twiceMonthlyDayOne");
  const twiceDayTwo = formData.get("twiceMonthlyDayTwo");
  const parseNumericDay = (value: FormDataEntryValue | null, fallback: number, min: number, max: number) =>
    z.coerce.number().int().min(min).max(max).parse(value ?? fallback);

  return {
    payrollFrequency,
    weeklyPayDay: payrollFrequency === PayrollFrequency.WEEKLY ? parseNumericDay(weeklyPayDay, 5, 0, 6) : null,
    monthlyPayDay: payrollFrequency === PayrollFrequency.MONTHLY ? parseNumericDay(monthlyPayDay, 15, 1, 31) : null,
    twiceMonthlyDayOne:
      payrollFrequency === PayrollFrequency.TWICE_MONTHLY ? parseNumericDay(twiceDayOne, 15, 1, 31) : null,
    twiceMonthlyDayTwo:
      payrollFrequency === PayrollFrequency.TWICE_MONTHLY ? parseNumericDay(twiceDayTwo, 30, 1, 31) : null
  };
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

  const ok = await doLogin(parsed.data.email, parsed.data.password);
  if (!ok) {
    redirect("/login?error=credentials");
  }

  redirect("/dashboard");
}


export async function logoutAction() {
  await logout();
  redirect("/login");
}
export async function createEmployeeAction(formData: FormData) {
  await requireUser();
  const schema = z.object({
    employeeCode: z.string().min(1),
    fullName: z.string().min(1),
    position: z.string().optional(),
    dailyRate: moneySchema,
    contactNumber: z.string().optional(),
    startDate: z.string().optional(),
    notes: z.string().optional()
  });
  const payrollSchedule = parseEmployeePayrollSchedule(formData);

  const parsed = schema.parse({
    employeeCode: formData.get("employeeCode"),
    fullName: formData.get("fullName"),
    position: formData.get("position"),
    dailyRate: formData.get("dailyRate"),
    contactNumber: formData.get("contactNumber"),
    startDate: formData.get("startDate"),
    notes: formData.get("notes")
  });

  await prisma.employee.create({
    data: {
      employeeCode: parsed.employeeCode,
      fullName: parsed.fullName,
      position: parsed.position || null,
      dailyRate: new Prisma.Decimal(parsed.dailyRate),
      contactNumber: parsed.contactNumber || null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      notes: parsed.notes || null,
      payrollFrequency: payrollSchedule.payrollFrequency,
      weeklyPayDay: payrollSchedule.weeklyPayDay,
      monthlyPayDay: payrollSchedule.monthlyPayDay,
      twiceMonthlyDayOne: payrollSchedule.twiceMonthlyDayOne,
      twiceMonthlyDayTwo: payrollSchedule.twiceMonthlyDayTwo,
      status: EmployeeStatus.ACTIVE
    }
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployeeAction(formData: FormData) {
  await requireUser();
  const schema = z.object({
    employeeId: z.string().min(1),
    employeeCode: z.string().min(1),
    fullName: z.string().min(1),
    position: z.string().optional(),
    dailyRate: moneySchema,
    contactNumber: z.string().optional(),
    startDate: z.string().optional(),
    notes: z.string().optional()
  });
  const payrollSchedule = parseEmployeePayrollSchedule(formData);

  const parsed = schema.parse({
    employeeId: formData.get("employeeId"),
    employeeCode: formData.get("employeeCode"),
    fullName: formData.get("fullName"),
    position: formData.get("position"),
    dailyRate: formData.get("dailyRate"),
    contactNumber: formData.get("contactNumber"),
    startDate: formData.get("startDate"),
    notes: formData.get("notes")
  });

  await prisma.employee.update({
    where: { id: parsed.employeeId },
    data: {
      employeeCode: parsed.employeeCode,
      fullName: parsed.fullName,
      position: parsed.position || null,
      dailyRate: new Prisma.Decimal(parsed.dailyRate),
      contactNumber: parsed.contactNumber || null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      notes: parsed.notes || null,
      payrollFrequency: payrollSchedule.payrollFrequency,
      weeklyPayDay: payrollSchedule.weeklyPayDay,
      monthlyPayDay: payrollSchedule.monthlyPayDay,
      twiceMonthlyDayOne: payrollSchedule.twiceMonthlyDayOne,
      twiceMonthlyDayTwo: payrollSchedule.twiceMonthlyDayTwo
    }
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function toggleEmployeeStatusAction(formData: FormData) {
  await requireUser();
  const employeeId = z.string().parse(formData.get("employeeId"));
  const current = z.nativeEnum(EmployeeStatus).parse(formData.get("currentStatus"));

  await prisma.employee.update({
    where: { id: employeeId },
    data: { status: current === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE }
  });

  revalidatePath("/employees");
}

export async function deleteEmployeeAction(formData: FormData) {
  await requireUser();
  const employeeId = z.string().parse(formData.get("employeeId"));

  await prisma.employee.delete({
    where: { id: employeeId }
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function saveAttendanceAction(formData: FormData) {
  await requireUser();
  const date = z.string().parse(formData.get("date"));
  const redirectTo = z.string().optional().parse(formData.get("redirectTo")) || "/dashboard";
  const targetDate = startOfDayLocal(new Date(date));
  const employees = await prisma.employee.findMany({ where: { status: EmployeeStatus.ACTIVE }, orderBy: { fullName: "asc" } });

  await prisma.$transaction(async (tx) => {
    for (const employee of employees) {
      const key = `status_${employee.id}`;
      const presentKey = `present_${employee.id}`;
      const remarksKey = `remarks_${employee.id}`;
      const statusValue = formData.has(key)
        ? String(formData.get(key) || "present")
        : formData.get(presentKey) === "on"
          ? "present"
          : "absent";
      const remarks = String(formData.get(remarksKey) || "").trim();

      await tx.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate
          }
        },
        update: {
          status: statusValue === "absent" ? "ABSENT" : "PRESENT",
          remarks: remarks || null
        },
        create: {
          employeeId: employee.id,
          date: targetDate,
          status: statusValue === "absent" ? "ABSENT" : "PRESENT",
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
  await requireUser();
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

  await prisma.advance.create({
    data: {
      employeeId: parsed.employeeId,
      date: new Date(parsed.date),
      amount: new Prisma.Decimal(parsed.amount),
      deductedAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(parsed.amount),
      reason: parsed.reason || null,
      status: LedgerStatus.OPEN
    }
  });

  revalidatePath("/advances");
  revalidatePath("/dashboard");
  redirect("/advances");
}

export async function createPayableAction(formData: FormData) {
  await requireUser();
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

  await prisma.payable.create({
    data: {
      employeeId: parsed.employeeId,
      date: new Date(parsed.date),
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
  await requireUser();
  const autoGenerate = formData.get("autoGenerate") === "on";

  const existing = await prisma.payrollSettings.findFirst();

  if (existing) {
    await prisma.payrollSettings.update({
      where: { id: existing.id },
      data: { autoGenerate }
    });
  } else {
    await prisma.payrollSettings.create({
      data: {
        frequency: PayrollFrequency.WEEKLY,
        weeklyPayDay: 5,
        autoGenerate
      }
    });
  }

  revalidatePath("/settings");
  revalidatePath("/payroll");
  redirect("/settings?saved=1");
}

export async function generatePayrollForDateAction(formData: FormData) {
  await requireUser();
  const targetDate = startOfDayLocal(new Date(z.string().parse(formData.get("targetDate"))));
  let dueCount = 0;
  await prisma.$transaction(async (tx) => {
    const employees = await tx.employee.findMany({ where: { status: EmployeeStatus.ACTIVE } });
    const dueEmployees = employees
      .map((employee) => {
        const computedPayDate = getPayDateForDate(targetDate, employee);
        const isDue = computedPayDate.toDateString() === targetDate.toDateString();
        if (!isDue) return null;
        const period = getPeriodForPayDate(targetDate, employee);
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
            periodStart_periodEnd: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd
            }
          },
          update: {
            payDate: period.payDate,
            label: `Payroll - ${period.label}`
          },
          create: {
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

      const attendance = await tx.attendanceRecord.findMany({
        where: {
          employeeId: employee.id,
          date: {
            gte: startOfDayLocal(period.periodStart),
            lte: endOfDayLocal(period.periodEnd)
          }
        }
      });

      const daysAbsent = attendance.filter((item) => item.status === "ABSENT").length;
      const daysPresent = attendance.filter((item) => item.status === "PRESENT").length;
      const grossPay = new Prisma.Decimal(daysPresent).mul(employee.dailyRate);

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

      let runningNet = grossPay;
      let deductedAdvanceTotal = new Prisma.Decimal(0);
      let deductedPayableTotal = new Prisma.Decimal(0);

      for (const advance of advances) {
        if (runningNet.lte(0)) break;
        const deduction = runningNet.lessThan(advance.remainingBalance) ? runningNet : advance.remainingBalance;
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

      await tx.payrollEntry.upsert({
        where: {
          payrollPeriodId_employeeId: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id
          }
        },
        update: {
          daysPresent,
          daysAbsent,
          grossPay,
          totalAdvancesDeducted: deductedAdvanceTotal,
          totalPayablesDeducted: deductedPayableTotal,
          netPay: runningNet
        },
        create: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: employee.id,
          daysPresent,
          daysAbsent,
          grossPay,
          totalAdvancesDeducted: deductedAdvanceTotal,
          totalPayablesDeducted: deductedPayableTotal,
          netPay: runningNet
        }
      });
    }
  });

  revalidatePath("/payroll");
  redirect(
    `/payroll?payDate=${targetDate.toISOString().slice(0, 10)}${dueCount ? "&generated=1" : "&error=no-due-employees"}`
  );
}

export async function finalizePayrollAction(formData: FormData) {
  await requireUser();
  const payrollPeriodId = z.string().parse(formData.get("payrollPeriodId"));
  await prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { status: PayrollPeriodStatus.FINALIZED } });
  revalidatePath("/payroll");
}
