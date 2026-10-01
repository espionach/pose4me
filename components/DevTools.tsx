"use client";

import { useEffect } from "react";

/**
 * With NEXT_PUBLIC_DEV_SEED=1, exposes `window.shootPlanner.seed()` / `.stats()` in the
 * browser console (used by the Playwright tests). Renders nothing; absent otherwise.
 */
export function DevTools() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEV_SEED !== "1") return;
    Promise.all([import("@/lib/devSeed"), import("@/lib/db")]).then(([{ seed }, { stats }]) => {
      (window as unknown as { shootPlanner: object }).shootPlanner = { seed, stats };
    });
  }, []);
  return null;
}
