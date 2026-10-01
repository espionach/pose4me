"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { Sticker } from "@/components/Scribble";
import { BottomBar } from "@/components/ui";
import { cleanName, isValidName, NAME_MAX, useProfile } from "@/lib/profile";

/** First launch. No back button; once the profile exists, ProfileProvider replaces this with My shoots. */
export default function Welcome() {
  const { saveName } = useProfile();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = isValidName(cleanName(name));

  const start = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveName(name);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <main className="paper relative flex min-h-dvh flex-col justify-center gap-7" style={{ padding: "0 24px 120px" }}>
      <Sticker name="01-star" size={[52, 52]} style={{ left: 36, top: 96, transform: "rotate(-12deg)" }} />
      <Sticker name="05-flower" size={[48, 48]} style={{ right: 40, top: 140, transform: "rotate(16deg)" }} />
      <Sticker name="04-squiggle-line" size={[44, 22]} style={{ right: 70, top: 236, transform: "rotate(-6deg)" }} />

      <div className="flex flex-col gap-1.5">
        <div className="origin-left -rotate-3 font-hand text-[30px] font-bold text-berry">hi there!</div>
        <h1 className="m-0 font-serif text-[36px] leading-[1.1] font-normal tracking-[-0.5px]">what should we call you?</h1>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="welcome-name" className="section-label">
          your name
        </label>
        <input
          id="welcome-name"
          autoFocus
          autoComplete="given-name"
          enterKeyHint="go"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              start();
            }
          }}
          className="box-border h-[60px] rounded-[18px] border-[1.5px] bg-surface px-4 font-serif text-[22px] text-ink shadow-paper outline-none"
          style={{ borderColor: ready ? "#26211E" : "#E6DED3" }}
        />
        <div className="px-1 text-[13px] text-muted" aria-live="polite">
          {failed ? <span className="text-berry">couldn&apos;t save your name — try again.</span> : "you can change this anytime in settings."}
        </div>
      </div>

      <BottomBar px={24}>
        {ready ? (
          <button
            type="button"
            onClick={start}
            disabled={saving}
            className="mb-0.5 flex h-[58px] grow items-center justify-center gap-2.5 rounded-full bg-ink text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(38,33,30,.22)]"
          >
            let&apos;s go
            <ArrowRightIcon />
          </button>
        ) : (
          <button type="button" disabled className="mb-0.5 h-[58px] grow rounded-full bg-line text-[16px] font-semibold text-muted">
            enter your name to start
          </button>
        )}
      </BottomBar>
    </main>
  );
}
