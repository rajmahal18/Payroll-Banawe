import type { Metadata } from "next";
import "./globals.css";
import { FormSubmitGuard } from "@/components/form-submit-guard";
import { SWRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com"),
  title: "RVerse Payroll",
  description: "RVerse Payroll for attendance, absences, advances, and shop payroll operations",
  applicationName: "RVerse Payroll",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RVerse Payroll"
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml" },
      { url: "/icon-512.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-icon" }]
  }
};

export const viewport = {
  themeColor: "#16784f"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FormSubmitGuard />
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
