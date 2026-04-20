import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { headers } from "next/headers";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pathname = (await headers()).get("x-pathname") ?? "";
  return (
    <AppShell pathname={pathname} userName={user.name || user.email}>
      {children}
    </AppShell>
  );
}
