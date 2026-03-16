"use client";

// ---------------------------------------------------------------------------
// sessionStorage persistence hook for onboarding wizard state
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { WizardState, WizardAction } from "./types";

const STORAGE_KEY = "onboarding-wizard";
const DEBOUNCE_MS = 300;

/**
 * Persists wizard state to sessionStorage and hydrates on mount.
 *
 * Returns `{ isHydrated }` so the wizard can show a loading skeleton
 * until the stored state has been restored.
 */
export function useWizardPersistence(
  state: WizardState,
  dispatch: React.Dispatch<WizardAction>,
): { isHydrated: boolean } {
  const [isHydrated, setIsHydrated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Hydrate from sessionStorage on mount ----
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsHydrated(true);
      return;
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: WizardState = JSON.parse(stored);
        dispatch({ type: "HYDRATE", state: parsed });
      }
    } catch {
      // Corrupt data -- ignore and start fresh
    }

    setIsHydrated(true);
  }, [dispatch]);

  // ---- Persist state to sessionStorage (debounced) ----
  useEffect(() => {
    // Skip until initial hydration is done to avoid writing the default state
    // back before the stored state has been restored.
    if (!isHydrated) return;
    if (typeof window === "undefined") return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full or unavailable -- silently degrade
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state, isHydrated]);

  return { isHydrated };
}

/** Remove persisted wizard state (call on successful completion). */
export function clearWizardStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
