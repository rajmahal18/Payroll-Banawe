import type { Metadata } from "next";
import "./globals.css";
import { SWRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "Absensya Payroll",
  description: "Owner-first payroll and attendance PWA",
  applicationName: "Absensya Payroll",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Absensya Payroll"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
