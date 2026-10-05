"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { setWebChooser } from "@/lib/photos";

/**
 * Web-only stand-in for the native photo picker: one hidden file input for the whole
 * app, opened by pickPhotos(). Renders nothing on iOS.
 */
export function PhotoInput() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    let settle: ((files: File[] | null) => void) | null = null;
    const input = ref.current!;
    const done = (files: File[] | null) => {
      settle?.(files);
      settle = null;
      input.value = "";
    };
    const onChange = () => done(input.files?.length ? Array.from(input.files) : null);
    const onCancel = () => done(null);
    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    setWebChooser((multiple) => {
      done(null); // a chooser left open by a previous call counts as cancelled
      input.multiple = multiple;
      input.click();
      return new Promise((resolve) => (settle = resolve));
    });
    return () => {
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      setWebChooser(null);
    };
  }, []);

  return <input ref={ref} type="file" accept="image/*" hidden aria-hidden tabIndex={-1} data-testid="photo-input" />;
}
