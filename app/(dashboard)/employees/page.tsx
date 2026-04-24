import { EmployeeCardGrid } from "@/components/employee-card-grid";
import { EmployeeCreateModal } from "@/components/employee-create-modal";
import { PageHeader } from "@/components/page-header";
import { EmployeeSearchForm } from "@/components/employee-search-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage({
  searchParams
}: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const search = params.search?.trim() || "";
  const user = await requireUser();

  const employees = await prisma.employee.findMany({
    where: {
      shopId: user.shop.id,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { employeeCode: { contains: search, mode: "insensitive" } },
              { position: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      attendanceRecords: {
        orderBy: { date: "desc" },
        select: {
          date: true,
          status: true,
          remarks: true
        }
      },
      payrollEntries: {
        select: {
          payrollPeriod: {
            select: {
              payDate: true,
              label: true
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
    orderBy: [{ status: "asc" }, { fullName: "asc" }]
  });

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Maintain your worker master list and daily rates."
        action={
          <>
            <EmployeeSearchForm initialValue={search} />
            <EmployeeCreateModal />
          </>
        }
      />

      <EmployeeCardGrid
        employees={employees.map((employee) => ({
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
          }))
        }))}
      />
    </div>
  );
}
