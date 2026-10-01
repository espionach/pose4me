"use client";
/* eslint-disable @next/next/no-img-element */

import { useImageUrl } from "@/lib/data";
import type { PhotoRef } from "@/lib/types";

type Props = {
  /** A saved image id, or a photo ref (saved or just picked). */
  photo: PhotoRef | string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/** Fills its box with a photo (object-cover). Saved images load from the data layer. */
export function Photo({ photo, className = "", style, children }: Props) {
  const ref = typeof photo === "string" ? { imageId: photo } : photo;
  const imageId = ref && "imageId" in ref ? ref.imageId : null;
  const savedUrl = useImageUrl(imageId);
  const src = ref && "picked" in ref ? ref.picked.url : savedUrl;
  return (
    <div
      className={`relative overflow-hidden bg-paper-deep ${className}`}
      data-photo={imageId ?? (ref && "picked" in ref ? `picked:${ref.picked.key}` : "")}
      style={style}
    >
      {src && <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      {children}
    </div>
  );
}
