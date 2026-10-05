"use client";

import { useSearchParams } from "next/navigation";

/*
 * Shoot URLs. The id is a query parameter (not a path segment) so every page can be
 * pre-built by Next's static export, which Capacitor packages into the iOS app.
 */

const q = (id: string) => `?id=${encodeURIComponent(id)}`;

export const planUrl = (id: string) => `/shoot${q(id)}`;
export const poseUrl = (id: string) => `/shoot/pose${q(id)}`;
export const exportUrl = (id: string) => `/shoot/export${q(id)}`;

/** The current page's shoot id (`?id=`), or "" when missing. Needs a <Suspense> boundary. */
export function useShootId() {
  return useSearchParams().get("id") ?? "";
}
