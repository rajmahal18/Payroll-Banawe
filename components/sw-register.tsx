"use client";

import { useEffect } from "react";

const RESET_KEY = "rverse-sw-cleanup-v3";

export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const cleanupServiceWorkers = async () => {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if (!cancelled && !sessionStorage.getItem(RESET_KEY)) {
          sessionStorage.setItem(RESET_KEY, "1");

          if (navigator.serviceWorker?.controller) {
            window.location.reload();
          }
        }
      } catch (error) {
        console.warn("Service worker cleanup skipped", error);
      }
    };

    cleanupServiceWorkers();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
