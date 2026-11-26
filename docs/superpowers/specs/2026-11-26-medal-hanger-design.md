# Medal hanger — design

## Intent
A medal hanger on the wall by the tri gear, with one medal for every finished race in
`src/components/room/races.ts`. It fills itself as races are added and finished, so the corner
shows the racing history at a glance and each medal leads to that race's story.

## Goals
- A matte black steel bar with **SWIM · BIKE · RUN** cut out, mounted on the left wall
  (x = −2.10) above the tri bag (bag at about world x −1.99, y −1.72), with hooks underneath.
- One medal per race where `isDone(race)` is true, in date order, left to right, one per hook.
- Medal: gold disc on a ribbon, race name and year engraved on the face (canvas texture).
- Optional `medal?: { photo?: string; ribbon?: string }` on `Race`: a photo of the real medal
  replaces the engraved face, and `ribbon` sets the ribbon colour. Without them, an engraved
  gold disc with a default ribbon.
- Hover: the medal under the cursor swings a little on its hook (pointer cursor, like other
  clickables). Click: opens the race calendar straight on that race's write-up when it has a
  `post`; otherwise opens the calendar list.

## Non-goals
- No new popup UI: reuse `RaceCalendar` (add an optional `initialRaceId` prop).
- No medals for upcoming races; no "empty slot" placeholders beyond the bare hooks.

## Anti-goals
- Re-modelling or re-exporting the room per race.
- Medals clipping into the bike, the bag or the wall, or blocking existing click targets
  (bag, cap, goggles, bike).

## Approaches
1. **Hanger in Blender, medals generated in code from `races.ts`** — chosen. Model once; the
   medals follow the data, like the record rack follows `albums.ts`.
2. Everything in Blender — rejected: every new race needs a re-model and re-export.
3. Real medal photos — kept as the optional `medal.photo` field on top of 1.

## How (decided)
- Blender: a new `scripts/build_medal_hanger.py` (same style as `build_monitor_arm.py`) adds
  one empty "Medal hanger" with the bar and hook meshes to "08 Triathlon gear"; hook positions
  are marked by empties named `Medal hook 00..NN` so the website knows where to hang medals.
  Then re-export with `scripts/export_room.py`.
- Website: a `Medals.tsx` component (like `RecordRack.tsx`) builds the medals at the hooks;
  `RoomScene.clickableFor` gets a `{ kind: 'medal'; race: string }` target; hover swing in
  `useFrame`; `RoomExperience` passes the race id through to `RaceCalendar`.
- Pure logic (which races get medals, hook assignment, engraving text) lives in a small module
  with vitest tests, like `weather.ts`.

## Left to the builder
- Exact height, length and hook count of the bar (enough hooks for several seasons; ~6),
  chosen so it clears the bike's rear wheel and sits above the bag in the hero camera view.
- If there are more finished races than hooks: double up medals on the last hooks.
- Disc size, ribbon length, materials and swing tuning.
