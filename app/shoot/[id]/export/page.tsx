"use client";

import { toPng } from "html-to-image";
import { useParams } from "next/navigation";
import { forwardRef, useRef, useState } from "react";
import { BackIcon, DownloadIcon, StarDeco } from "@/components/icons";
import { Photo } from "@/components/Photo";
import { ArrowButton, BottomBar, IconButton, PagerDots, primaryBtn, Screen } from "@/components/ui";
import { fmtWhen, plural, poseNum, splitWho, totalMinutes } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { usePoses, useShoot } from "@/lib/data";
import type { Pose, Shoot } from "@/lib/types";
import { MissingShoot } from "../MissingShoot";

const PER_PAGE = 4;
type Layout = "list" | "grid";

export default function ExportScreen() {
  const { id } = useParams<{ id: string }>();
  const shoot = useShoot(id);
  const poses = usePoses(id);
  const nav = useNav();
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<Layout>("list");
  const [notes, setNotes] = useState(true);
  const [busy, setBusy] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  if (shoot === undefined || poses === undefined) return <div className="paper min-h-dvh" />;
  if (!shoot) return <MissingShoot />;

  const pages = Math.max(1, Math.ceil(poses.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const pageProps = { shoot, poses, layout, notes, pages };

  const download = async () => {
    if (!exportRef.current) return;
    setBusy(true);
    try {
      const slug = shoot.title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "shoot";
      const nodes = Array.from(exportRef.current.children) as HTMLElement[];
      // Render every page first, then start all the downloads together: one PNG per
      // page, each ending in its page number so names never collide.
      const urls = await Promise.all(nodes.map((node) => toPng(node, { pixelRatio: 3, backgroundColor: "#FFFFFF" })));
      urls.forEach((url, i) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-plan-page-${i + 1}.png`;
        a.click();
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bg="deep" bottomSpace={120}>
      <div className="flex items-center justify-between">
        <IconButton onClick={() => nav.back(`/shoot/${shoot.id}`)} label="Back to plan">
          <BackIcon />
        </IconButton>
        <h1 className="m-0 font-serif text-[22px] font-normal">your shoot plan</h1>
        <div className="w-11" />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative flex justify-center pt-1.5">
          <div className="relative shadow-[0_14px_30px_rgba(38,33,30,.14)] transition-transform" style={{ transform: pg % 2 ? "rotate(1.2deg)" : "rotate(-1.2deg)" }}>
            <PlanPage {...pageProps} index={pg} />
            <div className="absolute -top-[9px] left-[110px] h-[18px] w-[70px] rotate-2 bg-[rgba(247,198,207,.9)]" />
          </div>
          <StarDeco size={40} fill="#CFE3C4" style={{ position: "absolute", left: 14, bottom: 16 }} />
          {pages > 1 && (
            <>
              <ArrowButton dir="prev" label="Previous page" disabled={pg === 0} onClick={() => setPage(pg - 1)} style={{ left: 0, top: 184 }} />
              <ArrowButton dir="next" label="Next page" disabled={pg === pages - 1} onClick={() => setPage(pg + 1)} style={{ right: 0, top: 184 }} />
            </>
          )}
        </div>
        {pages > 1 && <PagerDots count={pages} index={pg} onGo={setPage} noun="page" />}
      </div>

      <div className="flex flex-col rounded-card bg-surface px-4 py-1 shadow-paper">
        <div className="flex h-[52px] items-center justify-between border-b border-line-soft">
          <label htmlFor="opt-notes" className="text-[15px] font-semibold">
            include notes
          </label>
          <button
            id="opt-notes"
            type="button"
            role="switch"
            aria-checked={notes}
            onClick={() => setNotes((n) => !n)}
            className={`box-border flex h-[30px] w-[50px] rounded-full p-[3px] transition-colors ${notes ? "justify-end bg-ink" : "justify-start bg-line"}`}
          >
            <span className="block h-6 w-6 rounded-full bg-white shadow-[0_1px_2px_rgba(38,33,30,.2)]" />
          </button>
        </div>
        <div className="flex h-[52px] items-center justify-between">
          <div className="text-[15px] font-semibold" id="layout-label">
            layout
          </div>
          <div className="flex rounded-2xl bg-paper-deep p-[3px]" role="group" aria-labelledby="layout-label">
            {(["list", "grid"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => setLayout(l)}
                className="h-8 rounded-[13px] px-3.5 text-[13px] font-semibold"
                style={{ background: layout === l ? "#FFFFFF" : "transparent", boxShadow: layout === l ? "0 1px 3px rgba(38,33,30,.12)" : "none" }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomBar>
        <button type="button" onClick={download} disabled={busy} className={`${primaryBtn} disabled:opacity-70`}>
          <DownloadIcon />
          {busy ? "saving…" : "save to photos"}
        </button>
      </BottomBar>

      {/* Off-screen, untilted copy of every page — each child is rendered to its own PNG. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <ExportSheet ref={exportRef} {...pageProps} />
      </div>
    </Screen>
  );
}

type PageProps = { shoot: Shoot; poses: Pose[]; layout: Layout; notes: boolean; pages: number };

const ExportSheet = forwardRef<HTMLDivElement, PageProps>(function ExportSheet(props, ref) {
  return (
    <div ref={ref} className="flex flex-col gap-4">
      {Array.from({ length: props.pages }, (_, i) => (
        <PlanPage key={i} {...props} index={i} />
      ))}
    </div>
  );
});

function PlanPage({ shoot, poses, layout, notes, pages, index }: PageProps & { index: number }) {
  const start = index * PER_PAGE;
  const rows = poses.slice(start, start + PER_PAGE);
  const meta = (p: Pose) => [splitWho(p.who).join(", "), `${p.minutes} min`].filter(Boolean).join(" · ");

  return (
    <div className="relative box-border flex h-[400px] w-[290px] flex-col gap-2.5 bg-white px-5 py-[22px] text-ink">
      <div className="flex flex-col gap-0.5">
        <div className="font-serif text-[17px] leading-tight">{shoot.title}</div>
        <div className="text-[9px] text-muted">
          {fmtWhen(shoot.date, shoot.time)} · {plural(poses.length, "pose")} · {totalMinutes(poses)} min
        </div>
      </div>
      <div className="h-px bg-[#EFE8DD]" />

      {rows.length === 0 && <div className="pt-8 text-center text-[11px] text-muted">no poses yet</div>}

      {layout === "list"
        ? rows.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <div className="w-4 shrink-0 text-[15px] font-bold">{poseNum(start + i)}</div>
              <Photo photo={p.imageId} className="h-14 w-11 shrink-0 rounded-lg" />
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <div className="line-clamp-2 text-[10px] font-bold">{p.title || "untitled pose"}</div>
                <div className="text-[9px] text-muted">{meta(p)}</div>
                {notes && p.note && <div className="line-clamp-2 text-[10px] leading-[1.2] text-muted">{p.note}</div>}
              </div>
            </div>
          ))
        : rows.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {rows.map((p, i) => (
                <div key={p.id} className="flex min-w-0 flex-col gap-1">
                  <Photo photo={p.imageId} className="h-24 rounded-lg">
                    <span className="absolute top-[5px] left-[5px] box-border flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold">
                      {poseNum(start + i)}
                    </span>
                  </Photo>
                  <div className="truncate text-[10px] font-bold">{p.title || "untitled pose"}</div>
                  <div className="truncate text-[9px] text-muted">{meta(p)}</div>
                  {notes && <div className="truncate text-[10px] leading-[1.2] text-muted">{p.note || " "}</div>}
                </div>
              ))}
            </div>
          )}

      <div className="absolute right-4 bottom-3 text-[9px] text-muted">
        page {index + 1} of {pages}
      </div>
    </div>
  );
}
