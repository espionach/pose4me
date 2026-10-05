# Navigation map

The source of truth for where every action goes. Each row is covered by
`e2e/navigation.spec.ts` (row numbers match the test names) or `e2e/welcome-settings.spec.ts`.

URLs: `/` My shoots · `/new` New shoot · `/shoot?id=…` Shoot plan · `/shoot/pose?id=…` Pose details ·
`/shoot/export?id=…` Export · `/welcome` · `/settings` · `/privacy` · `/terms`.
While a new shoot is being created (before it's saved) its id is `new`.

"The photo picker" is Apple's native picker on iPhone, and the browser's file chooser on the web.

| # | From | Action | Goes to |
|---|---|---|---|
| 1 | My shoots | + new shoot | New shoot |
| 2 | My shoots | tap a shoot card | That shoot's Shoot plan |
| 3 | New shoot | X | My shoots (draft discarded) |
| 4 | New shoot | next · pick photos → pick | Pose details, photos in the order picked |
| 5 | New shoot | next · pick photos → cancel | Stays on New shoot (name, date, time kept) |
| 6 | Shoot plan | + add poses → pick | Pose details, photos in the order picked |
| 7 | Shoot plan | + add poses → cancel | Stays on the plan, unchanged |
| 8 | Pose details (picked photos) | back, nothing changed | The screen that opened the picker: New shoot (fields kept) or the plan |
| 9 | Pose details (picked photos) | back, after any edit | "discard these poses?" → **discard** goes back as in row 8; **keep editing** stays |
| 10 | Pose details | camera on the polaroid → pick 1 | Same pose, only the image replaced (name, who's posing, time, notes kept) |
| 11 | Pose details | camera on the polaroid → cancel | Unchanged |
| 12 | Pose details (picked photos) | save N poses | Shoot plan of the new shoot, or of the shoot being added to |
| 13 | Shoot plan | tap a pose card | Pose details for that shoot's poses, opened on the tapped pose |
| 14 | Pose details (from a card) | back | Shoot plan (edits kept — they save as you type) |
| 15 | Pose details (from a card) | save | Shoot plan |
| 16 | Shoot plan | back | My shoots |
| 17 | Shoot plan | save (export) | Export |
| 18 | Export | back | Shoot plan |
| — | App load, no profile | — | Welcome |
| — | App load, profile exists | — | My shoots |
| — | Welcome | let's go | My shoots (Welcome replaced in history) |
| — | My shoots | gear | Settings |
| — | Settings | back | My shoots |
| — | Settings | privacy policy / terms & conditions | Privacy policy / Terms & conditions |
| — | Privacy policy / Terms | back | Settings |

## Pose details

- Arrows and pager dots step through the set it was opened with: the picked photos in the
  order picked, or all of the shoot's poses in plan order starting on the tapped pose.
- The counter shows the position in that set ("photo 3 of 8"); arrows dim at the ends.
- Edits are kept per pose while stepping.

## General rules

- In-app back and the browser's back go to the same place. (The iOS app has no swipe-back.)
  On the web, the browser's back from Pose details after picking discards without asking.
- Saving poses, then going back, never adds them twice; finished flows are removed from history.
- Unsaved work (a new shoot, picked photos) lives in memory only. Reloading mid-flow returns
  to the nearest valid screen; nothing half-saved is left behind.
- Missing state (bad id, refresh after a flow ended) falls back to the nearest valid parent.
