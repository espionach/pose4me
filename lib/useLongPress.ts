"use client";

import { useEffect, useRef } from "react";

/**
 * Press-and-hold (500 ms) detection that coexists with taps and scrolling.
 * Returns pointer handlers to spread per item, plus `consumeClick()` which reports
 * (once) whether the click that follows a long press should be swallowed.
 */
export function useLongPress(onLongPress: (id: string) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  useEffect(() => cancel, []);

  const bind = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      cancel();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        cb.current(id);
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const consumeClick = () => {
    const f = fired.current;
    fired.current = false;
    return f;
  };

  return { bind, consumeClick, cancel };
}
