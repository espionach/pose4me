# Shoot Planner — design handoff for Claude Code

A mobile-first app that turns inspiration photos into a photoshoot plan: import pose photos, order them, note who's posing, set time limits, add notes, and export the plan.

**Start here in Claude Code:** unzip this folder into your project (or an empty folder), open Claude Code there, and paste:

> Read `HANDOFF.md` and the files in `design-source/`. Build this app as a mobile-first [Next.js + TypeScript + Tailwind | Expo / React Native — pick one] app that matches the designs exactly: same tokens, spacing, radii, copy and interactions. Start with shared tokens and components, then build the 5 screens in flow order. Use local state/mock data first; keep the data model in one place so we can add persistence later. Use the SVGs in `assets/` directly.

---

## What's in this folder

| Path | What it is |
|---|---|
| `design-source/*.dc.html` | The source of every screen. Each is HTML with inline styles plus a small logic class at the bottom (`renderVals()` = the screen's state and handlers). `{{x}}` holes, `<sc-for>` (loop) and `<sc-if>` (conditional) are template syntax. The files load a `support.js` runtime that is **not** included, so treat them as exact reference, not something to run. |
| `design-source/canvas.json` | Screen order and titles. |
| `assets/scribbles/*.svg` | The 16 final decorative scribble stickers. |
| `assets/pose-placeholders/*.svg` | Stick-figure placeholders standing in for real inspiration photos. |

Screens (390 × 844, iPhone-size; don't draw a fake status bar):

1. `Main.dc.html`: **My shoots**
2. `Plan.dc.html`: **Shoot plan**
3. `Import.dc.html`: **Camera roll** (photo picker)
4. `Pose.dc.html`: **Pose details** (multi-photo editor)
5. `Export.dc.html`: **Export** (preview + download PNG)
6. `Scribbles.dc.html`: reference sheet of the 16 stickers (not an app screen)

---

## Design tokens

**Color**

| Token | Hex | Use |
|---|---|---|
| paper | `#FBF8F3` | Screen background, plus a dot grid: `radial-gradient(rgba(38,33,30,.05) 1px, transparent 1px)` at 14px |
| paper-deep | `#F3EDE4` | Export screen bg, segmented-control track |
| desk | `#EDE7DD` | Outside the phone |
| surface | `#FFFFFF` | Cards, inputs, buttons |
| ink | `#26211E` | Text, primary buttons, selected outlines |
| muted | `#6B625B` | Secondary text, labels |
| placeholder | `#8A8078` | Input placeholders, "untitled pose" |
| line | `#E6DED3` | Borders, and card "shadow" `0 2px 0 #E6DED3` |
| line-soft | `#F1EAE0` | Dividers, lined-paper rules |
| dot-inactive | `#D9D0C5` | Pager dots |
| berry | `#C8375E` | Accent: greeting, selection badges, delete, rename underline |
| pink | `#F7C6CF` | Pastel photo/tape/sticker fill |
| butter | `#F8E7A6` | Pastel |
| matcha | `#CFE3C4` | Pastel |
| sky | `#CFE0F2` | Pastel |
| lilac | `#E2D5F2` | Pastel |
| scribble blue | `#7FA7D6` | Spiral stroke |
| scribble lilac | `#B08FD8` | Loop stroke |

**Type** (Google Fonts)

- **Young Serif** 400: screen titles (32–38px), shoot card titles (17px), export page title
- **Figtree** 400/500/600/700: everything else
  - Section labels: 13px / 700 / uppercase / 0.6px tracking / muted
  - Pose title: 15px / 600
  - Pose note: 13px / 400 / muted
  - Buttons: 15–17px / 600
- **Caveat** 700: *only* the "hey priya!" greeting (24px, berry, rotated −3°)

**Shape and elevation**

- Radii:
  - Cards 22px
  - Photos 14px
  - Pills and buttons fully rounded (height/2)
  - Grid photo tiles 8px on the export page
- Primary button: ink fill, white text, 56–58px tall, pill shape
- Secondary button: white fill, 1.5px ink border
- Icon button: 44px white circle with a 1.5px `#E6DED3` border
- Minimum touch target 44px
- Card elevation: `0 2px 0 #E6DED3` (flat "paper" shadow). Floating elements: `0 10px 24px rgba(38,33,30,.16–.25)`

**Icons:** simple inline stroke SVGs (2–2.4px stroke, round caps). No emoji anywhere.

---

## Screens and behavior

### 1 · My shoots

- Header:
  - "hey priya!" in Caveat
  - "my shoots" title with a pink squiggle underline
  - Search icon button
- Filter chips: all / upcoming / done. The selected chip is an ink pill.
- A 2-column grid of **shoot cards**:
  - Pastel photo (120px tall)
  - Title in Young Serif 17px
  - Meta line such as "Oct 4 · 8 poses"
- Fixed bottom primary button **"+ new shoot"**.
- **Press and hold** a card (500 ms) to enter select mode:
  - The chip row is replaced by "N selected", then **cancel** (secondary) and **delete shoots** (berry, trash icon; reads "delete shoot" when only 1 is selected). Delete is disabled at 0.
  - Selected cards get a `0 0 0 3px ink` outline plus a check badge on the photo's top-left. Unselected cards show an empty ring.
  - After the long press, single taps toggle selection.

### 2 · Shoot plan

- Header: back button, then a **pencil** button that toggles edit mode.
  - Edit mode shows a title input (serif 26px) and native date and time inputs.
  - The pencil becomes an ink "✓ done" button. An empty title falls back to "untitled shoot".
- One info row with no pill backgrounds, all 13px / 600 ink, each item with a 14px line icon: calendar + "Sat, Oct 4 · 6:15pm", clock + "32 min total", photo + "8 poses".
- Hint: "drag to reorder · press and hold to select"
- **Pose cards** (full width):
  - 92×116 photo
  - Big number "01" (Figtree 22px / 700)
  - Time chip, e.g. "4 min"
  - Drag grip
  - Title (15px / 600)
  - "Who" chips
  - Note (13px muted)
- **Drag and drop** reorders cards live, and the numbers renumber.
- **Press and hold** gives the same multi-select as My shoots, with "delete poses".
- Tapping a card opens pose details.
- Fixed bottom row: **+ add poses** (secondary; opens the camera roll) and **export** (primary). There's a paper-colored fade behind them. The buttons sit above everything, including scribbles.

### 3 · Camera roll (photo-first flow)

- "Add poses" opens the device camera roll directly. There are no tabs.
- A 3-column grid of photos. Tapping selects a photo and shows a berry badge with its **selection order** (1, 2, 3…), plus a 3px ink outline. Tapping again deselects it and renumbers the rest.
- Bottom button: **"next · N selected →"**. With nothing selected it's disabled and reads "select at least one photo".
- Next opens pose details on the first selected photo.

### 4 · Pose details (steps through the selected photos)

- Header: back to the camera roll, and "photo 1 of 4".
- The **polaroid**:
  - White frame (8px, with a 30px bottom for the caption) and a soft shadow
  - Tilt −2.5° / +2° on alternating photos
  - A pink tape strip at the top
  - The caption is the pose title, Figtree 18px / 700
- **Pencil button** on the polaroid's top-right corner opens a menu:
  - "edit title": the caption becomes an inline input with a berry dashed underline; Enter or blur saves.
  - "change photo": reopens the camera roll.
- **Left and right arrow buttons** beside the polaroid (the right one is ink-filled) plus pager dots step between the selected photos. Arrows dim at 35% at the ends.
- Fixed decorations: a butter star and a berry burst, each at least 5px from any button.
- Fields, stored **per photo**:
  - "who's posing": free text input
  - "time limit": − / value / + stepper, minimum 1 min
  - "notes": lined-paper textarea, 19px on 28px rules
- Bottom: **"save N poses"** returns to the shoot plan.

### 5 · Export

- Title "your shoot plan".
- A tilted white page preview (290×400) with pink tape:
  - Shoot title, meta line, poses, "page X of Y"
- **4 poses per page.** Arrow buttons and dots flip pages and hide when there's only 1 page.
- Options card:
  - "include notes" switch
  - Layout segmented control **list | grid** (working): list = numbered rows with thumbnails; grid = 2×2 photo tiles with a number badge and 1-line titles and notes
- Bottom: single full-width primary **"download png"**. There's no share button.

---

## Scribble stickers (important details)

- **16 designs:** star, burst, spiral, squiggle line, flower, sparkle, smiley, lightning bolt, moon, rainbow, cloud, loop-de-loop, crown, asterisk, cherries, bow. Confetti is removed on purpose; don't add it back.
- They appear on **shoot cards** (My shoots) and **pose cards** (Shoot plan). There are no hearts.
- **Randomized on each load:**
  - Shuffle the pool so no two cards on a screen repeat a design
  - Rotation is random between −28° and 28°
  - Each card cycles through a different edge
- **Placement rules:**
  - Scribbles sit only on card **edges**
  - They keep **≥5px clearance from all text and buttons**
  - They never sit above fixed buttons (put the buttons on a higher z-index)
  - Use `pointer-events: none` so they never block taps
  - My shoots: the top edge or the left and right sides of the photo, never near the title or date, and avoiding the select-badge corner
  - Shoot plan: scale 0.72; only the card's left edge, or the top and bottom edges beside the thumbnail, never over the text column
- No scribble is all black. Each has a pastel fill or a colored stroke.

---

## Data model (suggested)

```ts
type Shoot = { id: string; title: string; date: string /* YYYY-MM-DD */; time: string /* HH:mm */; poses: Pose[] };
type Pose  = { id: string; photoUri: string; title: string; who: string; minutes: number; note: string };
```

Derived values:

- Total time = sum of the poses' `minutes`
- "N poses" = `poses.length`
- The number is the order in the array

## Not in the mockups yet (decide during the build)

- Real camera-roll access and real photo images (the pastel blocks are placeholders)
- The "new shoot" creation screen, and the search / filter-chip behavior
- What the "include notes" switch hides, and actual PNG rendering of the export page
- Persistence (local storage or a backend)
