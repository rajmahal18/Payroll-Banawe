import type { Metadata } from "next";
import "./globals.css";
import { FormSubmitGuard } from "@/components/form-submit-guard";
import { SWRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com"),
  title: "RVerse Payroll",
  description: "RVerse Payroll for attendance, absences, advances, and shop payroll operations",
  applicationName: "RVerse Payroll",
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

const serviceWorkerResetScript = `
(function () {
  if (typeof window === "undefined") return;

  var resetKey = "rverse-inline-sw-reset-v3";

  var deleteCaches = "caches" in window
    ? caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      })
    : Promise.resolve();

  var unregisterWorkers = "serviceWorker" in navigator
    ? navigator.serviceWorker.getRegistrations().then(function (registrations) {
        return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
      })
    : Promise.resolve();

  Promise.all([deleteCaches, unregisterWorkers]).then(function () {
    if (navigator.serviceWorker && navigator.serviceWorker.controller && !sessionStorage.getItem(resetKey)) {
      sessionStorage.setItem(resetKey, "1");
      window.location.reload();
    }
  }).catch(function () {});
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerResetScript }} />
      </head>
      <body>
        <FormSubmitGuard />
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
