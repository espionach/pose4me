# Add the "New shoot" screen to the existing app

**Paste this into Claude Code** (from your project root, with this folder copied in):

> Read `new-shoot-page/NEW_SHOOT_SPEC.md` and `new-shoot-page/NewShoot.dc.html`. Add the New shoot screen to our existing app and wire it into the current flow as described. Reuse our existing tokens, fonts, buttons, inputs and scribble components instead of duplicating them, and match the spec's sizes and copy exactly. Don't change any other screen except where the spec says to. When done, list the files you changed.

---

## Where it goes in the flow

**Before:**

My shoots → **+ new shoot** → Camera roll → Pose details → **save N poses** → Shoot plan

**After:**

My shoots → **+ new shoot** → **New shoot** → Camera roll → Pose details → **save N poses** → Shoot plan (of the new shoot)

Changes to existing screens:

1. **My shoots:** the "+ new shoot" button now opens New shoot instead of the camera roll.
2. **Camera roll:** when reached from New shoot, the subtitle reads "pick poses for {shoot name}" using the name just entered.
3. **Pose details → save:** saves the poses into the *new* shoot, then opens that shoot's plan. The shoot's title, date and time come from New shoot.

The "+ add poses" path from an existing Shoot plan does **not** go through New shoot. It still opens the camera roll directly.

## Behavior

- **Draft:** New shoot creates a draft shoot with `{ title, date, time }` and carries it through Camera roll and Pose details. It's only committed to the shoots list on "save N poses".
- **Close (X), top left:** discard the draft and return to My shoots. If the camera roll or pose details are exited early, the draft is also dropped; don't leave empty shoots behind.
- **Name:** required. The button is enabled when `name.trim().length > 0`, and the trimmed name is saved.
- **Date and time:** use native date and time inputs, stored as `YYYY-MM-DD` and `HH:mm` (same format as the Shoot plan's pencil edit mode).
  - The mockup pre-fills a fixed sample date. In the app, **default to today's date and the next full hour**.
- **Keyboard:** Enter in the name field goes to Next (when it's enabled). Autofocus the name field on open.

## Layout (390 × 844 reference, mobile)

Screen background: paper `#FBF8F3` with the dot grid, same as the other screens. Padding 52px top, 20px sides. Vertical gap between sections: 26px.

1. **Header row**
   - A 44px circular close button: white fill, 1.5px `#E6DED3` border, X icon (18px, 2.4px stroke, ink).
   - `aria-label="Cancel new shoot"`.
   - Nothing else in the header.
2. **Title**
   - "new shoot": Young Serif 400, 34px, line-height 1.1, ink `#26211E`, 4px side inset.
   - Flower scribble (`assets/05-flower.svg`) at 46×46: absolutely positioned at right 10px, top −6px of the title block, rotated 14°, `pointer-events: none`, `aria-hidden`.
3. **Shoot name**
   - Label "shoot name": Figtree 13px / 700 / uppercase / 0.6px letter-spacing / `#6B625B`, 8px above the field.
   - Input:
     - Size and shape: 60px tall, radius 18px, white, padding 0 16px.
     - Text: Young Serif 22px, ink.
     - Shadow: `0 2px 0 #E6DED3`.
     - Border: 1.5px, `#E6DED3` when empty, **ink `#26211E` once the name is non-empty**.
     - Placeholder "e.g. golden hour picnic" in `#8A8078`.
4. **Date + time row** (10px gap)
   - **Date** (fills the remaining width) and **Time** (fixed 136px wide).
   - Each has the same label style as above, 8px gap to its input.
   - Inputs: 52px tall, radius 18px, white, 1.5px `#E6DED3` border, padding 0 14px, Figtree 15px / 600, ink.
5. **Decorative scribbles**, `pointer-events: none`, `aria-hidden`:
   - Star (`assets/01-star.svg`), 40×40: left 34px, bottom 132px, rotated −10°.
   - Loop (`assets/12-loop-de-loop.svg`), 46×26: right 40px, bottom 150px, rotated 8°.
   - Keep them ≥5px from every text and control, and below the bottom button in z-order.
6. **Bottom button** (fixed: left/right 20px, bottom 32px, 58px tall, pill, z-index above the scribbles)
   - **Enabled:**
     - Ink fill, white text, Figtree 16px / 600, shadow `0 10px 24px rgba(38,33,30,.22)`.
     - Label "next · pick photos" plus an arrow icon (18px, 2.4px stroke) with a 10px gap.
   - **Disabled** (name empty):
     - `#E6DED3` fill, `#6B625B` text, no shadow.
     - Label "name your shoot to continue".

No subtitle, no step counter, no date preview line. These were removed on purpose.

## Files in this folder

- `NewShoot.dc.html`: the exact mockup source (inline styles plus a small state class at the bottom). It's reference only; it depends on a design-tool runtime that isn't included.
- `assets/`: the three scribble SVGs this screen uses. They're the same files as in the original handoff's scribble set, so reuse the existing copies if the app already has them.
