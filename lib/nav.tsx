"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

/*
 * In-app back must behave exactly like the browser's back button. We keep a mirror of
 * this tab's in-app history (pathname + search) in sessionStorage so it survives a
 * refresh, and use it to decide whether "back to X" can be a real history.back().
 */

const KEY = "shoot-planner:nav";
let stack: string[] | null = null;
let popPending = false;
let replacing = false;
let after: { target: string; then: string } | null = null;

function current() {
  if (!stack) {
    try {
      stack = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    } catch {
      stack = [];
    }
  }
  return stack!;
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack));
  } catch {}
}

/** Records every in-app navigation. Render once, inside <Suspense>, in the root layout. */
export function NavTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const here = pathname + (search ? `?${search}` : "");

  useEffect(() => {
    const onPop = () => {
      popPending = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const s = current();
    if (replacing) {
      replacing = false;
      if (s.length) s[s.length - 1] = here;
      else s.push(here);
    } else if (popPending) {
      popPending = false;
      // Back (or back several steps): drop everything after this entry. Forward: add it.
      const i = s.lastIndexOf(here);
      if (i >= 0) s.splice(i + 1);
      else s.push(here);
    } else if (s[s.length - 1] !== here) {
      s.push(here);
    }
    save();
    if (after && here === after.target) {
      const then = after.then;
      after = null;
      router.push(then);
    }
  }, [here, router]);

  return null;
}

export function useNav() {
  const router = useRouter();
  return useMemo(
    () => ({
      /** Go to `parent` the way the browser's back button would: pop history when it's the previous entry. */
      back(parent: string) {
        const s = current();
        if (s[s.length - 2] === parent) router.back();
        else {
          replacing = true;
          router.replace(parent);
        }
      },
      /** Swap the current entry (used for redirects, so they never add history). */
      replace(path: string) {
        replacing = true;
        router.replace(path);
      },
      /**
       * Rewind history to `target` so finished flows can't be revisited with back,
       * then optionally open `then` from there. Falls back to a replace.
       */
      unwindTo(target: string, then?: string) {
        const s = current();
        const i = s.length > 1 ? s.lastIndexOf(target, s.length - 2) : -1;
        if (i >= 0) {
          if (then) after = { target, then };
          window.history.go(i - (s.length - 1));
        } else {
          replacing = true;
          router.replace(then ?? target);
        }
      },
    }),
    [router],
  );
}
