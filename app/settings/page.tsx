"use client";

import Link from "next/link";
import { useState } from "react";
import { RowChevron } from "@/components/icons";
import { Sticker } from "@/components/Scribble";
import { BackButton, Screen } from "@/components/ui";
import { cleanName, isValidName, NAME_MAX, useProfile } from "@/lib/profile";

const row = "flex h-14 items-center justify-between text-[16px] font-semibold";

export default function Settings() {
  const { profile, saveName } = useProfile();
  const savedName = profile?.displayName ?? "";
  const [name, setName] = useState(savedName);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmed = cleanName(name);
  const canSave = isValidName(trimmed) && trimmed !== savedName && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveName(trimmed);
      setName(trimmed);
      setJustSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="relative" gap={24} bottomSpace={40}>
      <div className="flex items-center justify-between">
        <BackButton to="/" label="Back to my shoots" />
      </div>
      <Sticker name="06-sparkle" size={[36, 36]} style={{ right: 34, top: "calc(var(--pad-top) + 60px)", transform: "rotate(12deg)" }} />

      <h1 className="m-0 px-1 font-serif text-[34px] leading-[1.1] font-normal">settings</h1>

      <section className="flex flex-col gap-2">
        <div className="section-label px-1">profile</div>
        <div className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-paper">
          <label htmlFor="display-name" className="text-[14px] font-semibold">
            display name
          </label>
          <div className="flex items-center gap-2">
            <input
              id="display-name"
              placeholder="your name"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setJustSaved(false);
                setFailed(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              className="box-border h-12 min-w-0 grow rounded-[14px] border-[1.5px] border-line bg-paper px-3.5 text-[16px] font-semibold text-ink outline-none"
            />
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-12 shrink-0 rounded-full px-[18px] text-[15px] font-semibold"
              style={{ background: canSave ? "#26211E" : "#F1EAE0", color: canSave ? "#FFFFFF" : "#6B625B" }}
            >
              {justSaved ? "saved" : "save"}
            </button>
          </div>
          <div className="text-[13px] text-muted" aria-live="polite">
            {failed ? <span className="text-berry">couldn&apos;t save — try again.</span> : `shown on your home screen as "hey ${savedName}!"`}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="section-label px-1">about</div>
        <div className="flex flex-col rounded-card bg-surface px-4 py-1 shadow-paper">
          <Link href="/privacy" className={`${row} border-b border-line-soft`}>
            privacy policy
            <RowChevron />
          </Link>
          <Link href="/terms" className={row}>
            terms &amp; conditions
            <RowChevron />
          </Link>
        </div>
      </section>
    </Screen>
  );
}
