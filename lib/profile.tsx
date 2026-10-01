"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as db from "./db";
import { useNav } from "./nav";
import type { Profile } from "./types";

export const NAME_MAX = 40;
/** Display names are trimmed, 1–40 characters, and otherwise kept exactly as typed. */
export const cleanName = (raw: string) => raw.trim();
export const isValidName = (name: string) => name.length >= 1 && name.length <= NAME_MAX;

type ProfileState = {
  status: "loading" | "ready" | "error";
  profile: Profile | null;
  /** Creates or renames the profile. Throws if it couldn't be saved. */
  saveName(raw: string): Promise<void>;
  retry(): void;
};

const Ctx = createContext<ProfileState | null>(null);

export function useProfile() {
  const p = useContext(Ctx);
  if (!p) throw new Error("useProfile must be used inside <ProfileProvider>");
  return p;
}

/** Routes that render without a profile (so they can be linked from outside the app). */
const PUBLIC_ROUTES = ["/privacy", "/terms"];

/**
 * Loads the profile (stored on this device) once, shares it app-wide, and routes first
 * launches to Welcome. Redirects replace the history entry, so back can never return to Welcome.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ProfileState["status"]>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  const nav = useNav();

  useEffect(() => {
    let live = true;
    db.getProfile()
      .then((p) => {
        if (!live) return;
        setProfile(p);
        setStatus("ready");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [attempt]);

  const saveName = useCallback(async (raw: string) => {
    const name = cleanName(raw);
    if (!isValidName(name)) throw new Error("invalid name");
    setProfile(await db.saveProfile({ displayName: name }));
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const redirect = status !== "ready" || isPublic ? null : !profile && pathname !== "/welcome" ? "/welcome" : profile && pathname === "/welcome" ? "/" : null;

  useEffect(() => {
    if (redirect) nav.replace(redirect);
  }, [redirect, nav]);

  let content = children;
  if (!isPublic) {
    if (status === "error") content = <LoadError onRetry={retry} />;
    else if (status === "loading" || redirect) content = <div className="paper min-h-dvh" />;
  }

  return <Ctx.Provider value={{ status, profile, saveName, retry }}>{content}</Ctx.Provider>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="paper flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[15px] text-muted">couldn&apos;t open your saved data</p>
      <button type="button" onClick={onRetry} className="h-11 rounded-full border-[1.5px] border-line bg-surface px-[18px] text-[15px] font-semibold">
        try again
      </button>
    </main>
  );
}
