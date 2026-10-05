"use client";

import { useEffect } from "react";
import { useNav } from "@/lib/nav";

/** Missing state (bad id, refresh after a flow ended): fall back to the nearest valid parent screen. */
export function MissingShoot({ to = "/" }: { to?: string }) {
  const nav = useNav();
  useEffect(() => nav.replace(to), [nav, to]);
  return <div className="paper min-h-dvh" />;
}
