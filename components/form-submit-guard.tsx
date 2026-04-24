"use client";

import { useEffect } from "react";

type SubmitButton = HTMLButtonElement | HTMLInputElement;

function isSubmitButton(target: EventTarget | null): target is SubmitButton {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLButtonElement) {
    return (target.type || "submit") === "submit";
  }
  return target instanceof HTMLInputElement && target.type === "submit";
}

function applyLoadingState(button: SubmitButton) {
  if (button.dataset.loading === "true") return;

  button.dataset.loading = "true";
  button.setAttribute("aria-busy", "true");
  button.disabled = true;
}

export function FormSubmitGuard() {
  useEffect(() => {
    const handleSubmit = (event: Event) => {
      const submitEvent = event as SubmitEvent;
      const submitter = submitEvent.submitter;

      if (!isSubmitButton(submitter)) return;
      applyLoadingState(submitter);
    };

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
