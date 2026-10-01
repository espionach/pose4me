"use client";

/*
 * React hooks over the data layer. Screens read data only through these (and write
 * through lib/db.ts functions); they never touch storage themselves.
 * Each hook re-reads after any write. `undefined` means "still loading".
 */

import { useEffect, useRef, useState } from "react";
import * as db from "./db";
import type { Pose, Shoot } from "./types";

function useLive<T>(load: () => Promise<T>, key: string): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let live = true;
    let seq = 0;
    const run = () => {
      const mine = ++seq;
      loadRef
        .current()
        .then((value) => {
          if (live && mine === seq) setState({ key, value });
        })
        .catch(() => {});
    };
    run();
    const unsubscribe = db.subscribe(run);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [key]);

  return state && state.key === key ? state.value : undefined;
}

export type ShootCard = { shoot: Shoot; poseCount: number; coverImageId: string | null };

/** Every shoot, newest first, with its pose count and cover photo. */
export function useShoots(): ShootCard[] | undefined {
  return useLive(async () => {
    const shoots = await db.listShoots();
    return Promise.all(
      shoots.map(async (shoot) => {
        const poses = await db.listPoses(shoot.id);
        return { shoot, poseCount: poses.length, coverImageId: poses[0]?.imageId ?? null };
      }),
    );
  }, "shoots");
}

/** A shoot, `null` if it doesn't exist, `undefined` while loading. */
export function useShoot(id: string | null): Shoot | null | undefined {
  return useLive(() => (id ? db.getShoot(id) : Promise.resolve(null)), `shoot:${id}`);
}

/** A shoot's poses in plan order. */
export function usePoses(shootId: string | null): Pose[] | undefined {
  return useLive(() => (shootId ? db.listPoses(shootId) : Promise.resolve([])), `poses:${shootId}`);
}

/** An object URL for a stored image; revoked when the component unmounts or the id changes. */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!imageId) return;
    let live = true;
    let made: string | null = null;
    db.getImageUrl(imageId)
      .then((u) => {
        made = u;
        if (!live) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        if (u) setUrl({ id: imageId, url: u });
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [imageId]);
  return url && url.id === imageId ? url.url : null;
}
