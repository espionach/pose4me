"use client";

import { useEffect, useState } from "react";
import { onStorageError } from "@/lib/db";
import { CloseIcon } from "./icons";

/** Shows a friendly message whenever a save fails (e.g. device storage is full). */
export function StorageErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onStorageError((e) => setMessage(e.message)), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 8000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-[430px] px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div role="alert" className="flex items-center gap-3 rounded-[18px] bg-surface py-2 pr-2 pl-4 shadow-[0_10px_24px_rgba(38,33,30,.16)]">
        <p className="grow text-[14px] font-semibold text-berry">{message}</p>
        <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
          <CloseIcon size={16} />
        </button>
      </div>
    </div>
  );
}
