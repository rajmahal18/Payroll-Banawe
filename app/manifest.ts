import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? "RVerse Payroll",
    short_name: "RVerse Pay",
    description: "RVerse Payroll for attendance, absences, advances, and shop payroll operations.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "portrait",
    background_color: "#edf7ec",
    theme_color: "#16784f",
    categories: ["business", "finance", "productivity"],
    lang: "en-PH",
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard"
      },
      {
        name: "Employees",
        short_name: "Employees",
        url: "/employees"
      },
      {
        name: "Payroll",
        short_name: "Payroll",
        url: "/payroll"
      }
    ],
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
