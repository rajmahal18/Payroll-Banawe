import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users
} from "lucide-react";

export type PayrollNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
};

export const payrollNavItems: PayrollNavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, mobile: true },
  { href: "/employees", label: "People", icon: Users, mobile: true },
  { href: "/advances", label: "Adjustments", icon: CircleDollarSign, mobile: true },
  { href: "/payroll", label: "Payroll", icon: ClipboardList, mobile: true },
  { href: "/settings", label: "Settings", icon: Settings }
];
