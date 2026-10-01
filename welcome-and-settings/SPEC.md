# Welcome + Settings: add to the existing app

**Paste this into Claude Code** (from the project root, with this folder copied in):

> Read `welcome-and-settings/SPEC.md` and the files in `welcome-and-settings/design-source/`. Add the Welcome screen, display-name storage, a Settings screen, and Privacy policy / Terms & conditions placeholder pages to our existing app, wired in as described. Reuse our existing tokens, fonts, buttons, inputs and scribble components. Match the spec's sizes and copy exactly. Don't change other screens except where the spec says to. Show me a plan before editing, then list the files you changed.

---

## 1. Data (stored on the device)

There's no backend and no user accounts. The display name is stored on the device with the rest of the app's data, through the app's data layer (`lib/db.ts`, IndexedDB).

- **Storage:** a single `profile` row with `display_name`, read and written only through `getProfile` / `saveProfile` in `lib/db.ts`. Screens never touch storage directly.
- **On app load:**
  - Read the profile.
    - No profile → show **Welcome**.
    - Profile exists → go to **My shoots**.
- Keep the profile in one place (a small hook/store) so My shoots and Settings read the same value.
- If saving the name fails (for example, device storage is full), show a friendly message and stay on the screen.
- **Display name:**
  - Trim it and require 1–40 characters.
  - Show it exactly as the user typed it, with no forced lowercase or capitalization.

## 2. Navigation (add to the navigation map + Playwright tests)

| From | Action | Goes to |
|---|---|---|
| App load, no profile | — | Welcome |
| App load, profile exists | — | My shoots (Welcome skipped) |
| Welcome | let's go | My shoots (profile created) |
| My shoots | gear button | Settings |
| Settings | back | My shoots |
| Settings | privacy policy | Privacy policy |
| Settings | terms & conditions | Terms & conditions |
| Privacy policy / Terms | back | Settings |

Rules:

- After onboarding, browser back from My shoots must **never** return to Welcome. Replace the history entry; don't push a new one.
- Welcome has no back button.
- Opening Welcome's URL when a profile already exists redirects to My shoots.
- Legal pages get real routes (e.g. `/privacy`, `/terms`) so they can be linked from outside the app later.
- Browser back and in-app back must match everywhere.

## 3. Screens

All screens use the paper background `#FBF8F3` with the 14px dot grid, the 390×844 mobile reference, and ink `#26211E`. Labels use the standard section-label style: Figtree 13px / 700, uppercase, 0.6px letter-spacing, `#6B625B`. All scribbles are `pointer-events: none` and `aria-hidden`, and stay at least 5px clear of text and controls.

### Welcome (first launch)

- **Layout:** content vertically centered, 24px side padding, 120px bottom padding (room for the button), 28px gaps.
- **Greeting:** "hi there!" in Caveat 700, 30px, berry `#C8375E`, rotated −3°.
- **Title:** "what should we call you?" in Young Serif 36px, line-height 1.1, −0.5px letter-spacing.
- **Name field:**
  - Label: "your name".
  - Input:
    - Size and shape: 60px tall, radius 18px, white, padding 0 16px.
    - Text: Young Serif 22px.
    - Shadow: `0 2px 0 #E6DED3`.
    - Border: 1.5px, `#E6DED3` when empty, ink once a name is entered.
    - **No placeholder text.**
    - Autofocus the field.
  - Hint below it: "you can change this anytime in settings." (13px, `#6B625B`).
- **Button** (fixed; 24px from each side, 34px from the bottom; 58px tall, pill shape):
  - Enabled: ink fill, white text, 16px / 600, "let's go" plus an arrow, shadow `0 10px 24px rgba(38,33,30,.22)`.
  - Disabled (name empty): `#E6DED3` fill, `#6B625B` text, "enter your name to start".
  - Enter key submits when enabled.
- **Scribbles:**
  - Star (`assets/01-star.svg`): 52px, left 36 / top 96, rotated −12°.
  - Flower (`assets/05-flower.svg`): 48px, right 40 / top 140, rotated 16°.
  - Squiggle (`assets/04-squiggle-line.svg`): 44×22, right 70 / top 236, rotated −6°.

### My shoots (small change)

- The greeting shows **"hey {display_name}!"** instead of the hard-coded name.
- Add a **settings button** right beside the existing search button:
  - 8px gap between them.
  - Same 44px white circle with a 1.5px `#E6DED3` border.
  - Gear icon, 20px, 2px stroke.
  - `aria-label="Settings"`.

### Settings

- **Header:** a 44px back button (chevron) that goes to My shoots.
- **Title:** "settings" in Young Serif 34px.
- **Section gap:** 24px.
- **Decoration:** a sparkle scribble (`assets/06-sparkle.svg`), 36px, right 34 / top 112, rotated 12°.
- **"profile" section:** label, then a white card (radius 22px, padding 16px, shadow `0 2px 0 #E6DED3`) containing:
  - Label "display name" (14px / 600).
  - A row with 8px gap:
    - Input: grows to fill the row, 48px tall, radius 14px, fill `#FBF8F3`, 1.5px `#E6DED3` border, Figtree 16px / 600, pre-filled with the current name.
    - **Save** button: 48px tall, pill shape, padding 0 18px.
      - Enabled only when the trimmed value isn't empty and differs from the saved name: ink fill, white text.
      - Otherwise: `#F1EAE0` fill, `#6B625B` text.
      - After a successful save the label reads "saved" until the user types again.
  - Hint: `shown on your home screen as "hey {saved name}!"` (13px muted).
- **"about" section:** label, then a white card (radius 22px, padding 4px 16px) with two 56px rows (16px / 600, chevron on the right, 1px `#F1EAE0` divider between them):
  - "privacy policy" → Privacy policy
  - "terms & conditions" → Terms & conditions

### Privacy policy / Terms & conditions (placeholders)

- **Header:** a back button that goes to Settings.
- **Title:** "privacy policy" / "terms & conditions" in Young Serif 32px.
- Under the title: "last updated [DATE]" (13px muted).
- **Body:** a white card (radius 22px) filling the remaining height, with a 32px bottom margin. Inside it, a dashed placeholder box (2px dashed `#E6DED3`, radius 14px) reading "[PRIVACY POLICY TEXT GOES HERE]" / "[TERMS & CONDITIONS TEXT GOES HERE]".
- **Put each page's content in its own easy-to-edit file** (e.g. `content/privacy.md` and `content/terms.md`) and render it on the page, so the real text can be dropped in later without touching layout code. The body card should scroll when the text is long.

---

## Files in this folder

| Path | What |
|---|---|
| `design-source/Welcome.dc.html`, `Settings.dc.html`, `Privacy.dc.html`, `Terms.dc.html` | Exact mockup source for the new screens (inline styles plus a small state class at the bottom). Reference only; they need a design-tool runtime that isn't included. |
| `design-source/Main.dc.html` | Current My shoots mockup, showing the new gear button beside search. |
| `assets/*.svg` | The scribbles used on these screens (same files as the existing scribble set). |

## Known trade-off

All data lives on one device, in one browser. Clearing site data, uninstalling, or switching devices loses the profile and shoots; there's no sync or backup. The app asks the browser to keep its data (`navigator.storage.persist()`) to reduce the chance of it being cleared automatically. A native iOS version can later swap in its own implementation of `lib/db.ts` without screen changes.
