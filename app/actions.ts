"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Decimal, DeductionType, EmployeeStatus, LedgerStatus, PayrollFrequency, PayrollPeriodStatus } from "@prisma/client";
import { login as doLogin, requireUser, logout } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDayLocal, startOfDayLocal } from "@/lib/utils";
import { getPayDateForDate, getPeriodForPayDate } from "@/lib/payroll";

const moneySchema = z.coerce.number().min(0);

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
      dailyRate: new Decimal(parsed.dailyRate),
      contactNumber: parsed.contactNumber || null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      notes: parsed.notes || null,
      status: EmployeeStatus.ACTIVE
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

export async function saveAttendanceAction(formData: FormData) {
  await requireUser();
  const date = z.string().parse(formData.get("date"));
  const targetDate = startOfDayLocal(new Date(date));
  const employees = await prisma.employee.findMany({ where: { status: EmployeeStatus.ACTIVE }, orderBy: { fullName: "asc" } });

  await prisma.$transaction(async (tx) => {
    for (const employee of employees) {
      const key = `status_${employee.id}`;
      const remarksKey = `remarks_${employee.id}`;
      const statusValue = String(formData.get(key) || "present");
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

  revalidatePath(`/attendance?date=${date}`);
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  redirect(`/attendance?date=${date}&saved=1`);
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
      amount: new Decimal(parsed.amount),
      deductedAmount: new Decimal(0),
      remainingBalance: new Decimal(parsed.amount),
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
      amount: new Decimal(parsed.amount),
      deductedAmount: new Decimal(0),
      remainingBalance: new Decimal(parsed.amount),
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

  const frequency = z.nativeEnum(PayrollFrequency).parse(formData.get("frequency"));
  const weeklyPayDay = formData.get("weeklyPayDay");
  const monthlyPayDay = formData.get("monthlyPayDay");
  const twiceDayOne = formData.get("twiceMonthlyDayOne");
  const twiceDayTwo = formData.get("twiceMonthlyDayTwo");
  const autoGenerate = formData.get("autoGenerate") === "on";

  const existing = await prisma.payrollSettings.findFirst();

  const data = {
    frequency,
    weeklyPayDay: frequency === PayrollFrequency.WEEKLY ? Number(weeklyPayDay) : null,
    monthlyPayDay: frequency === PayrollFrequency.MONTHLY ? Number(monthlyPayDay) : null,
    twiceMonthlyDayOne: frequency === PayrollFrequency.TWICE_MONTHLY ? Number(twiceDayOne) : null,
    twiceMonthlyDayTwo: frequency === PayrollFrequency.TWICE_MONTHLY ? Number(twiceDayTwo) : null,
    autoGenerate
  };

  if (existing) {
    await prisma.payrollSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.payrollSettings.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/payroll");
  redirect("/settings?saved=1");
}

export async function generatePayrollForDateAction(formData: FormData) {
  await requireUser();
  const targetDate = new Date(z.string().parse(formData.get("targetDate")));

  const settings = await prisma.payrollSettings.findFirst();
  if (!settings) {
    redirect("/settings?error=no-settings");
  }

  const payDate = getPayDateForDate(targetDate, settings);
  const period = getPeriodForPayDate(payDate, settings);

  await prisma.$transaction(async (tx) => {
    const payrollPeriod = await tx.payrollPeriod.upsert({
      where: {
        periodStart_periodEnd: {
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }
      },
      update: {
        payDate: period.payDate,
        label: period.label
      },
      create: {
        label: period.label,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        payDate: period.payDate,
        status: PayrollPeriodStatus.DRAFT
      }
    });

    const employees = await tx.employee.findMany({ where: { status: EmployeeStatus.ACTIVE } });

    for (const employee of employees) {
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
      const grossPay = new Decimal(daysPresent).mul(employee.dailyRate);

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
      let deductedAdvanceTotal = new Decimal(0);
      let deductedPayableTotal = new Decimal(0);

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
  redirect(`/payroll?payDate=${targetDate.toISOString().slice(0, 10)}&generated=1`);
}

export async function finalizePayrollAction(formData: FormData) {
  await requireUser();
  const payrollPeriodId = z.string().parse(formData.get("payrollPeriodId"));
  await prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { status: PayrollPeriodStatus.FINALIZED } });
  revalidatePath("/payroll");
}
