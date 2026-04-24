"use client";

import { useEffect } from "react";

export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const registerSW = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => undefined);
    };

    window.addEventListener("load", registerSW);

    return () => {
      window.removeEventListener("load", registerSW);
    };
  }, []);

  return null;
}
