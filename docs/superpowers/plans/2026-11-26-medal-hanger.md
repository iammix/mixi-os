# Medal Hanger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SWIM · BIKE · RUN medal hanger on the wall above the tri bag, with one generated medal per finished race in `races.ts`; clicking a medal opens that race's write-up.

**Architecture:** The bar and its hooks are modelled once in Blender (new build script, re-exported into `room.glb`), with an empty per hook marking where a medal hangs. The website reads the hook positions, works out which races get medals (pure, tested module), and builds the medals in three.js at runtime — the same split as `RecordRack.tsx` over `albums.ts`.

**Tech Stack:** Blender Python (bpy), React 18, @react-three/fiber 8, three 0.169, vitest 2.

**Spec:** `docs/superpowers/specs/2026-11-26-medal-hanger-design.md`

## Global Constraints

- Bar: matte black steel, text **SWIM · BIKE · RUN** cut out, on the left wall (Blender x = −2.10 wall face) above the tri bag (bag at Blender x ≈ −1.99, y −1.72).
- Medal only for races where `isDone(race)` is true, date order, left to right, one per hook.
- Default medal: gold disc + engraved race name and year; optional `medal.photo` replaces the face, optional `medal.ribbon` sets the ribbon colour.
- Hover swings the medal and shows the pointer cursor; click opens `RaceCalendar` on that race if it has a `post`, else the calendar list.
- Must not cover or steal clicks from the bike, bag, cap or goggles. Nothing re-modelled per race.
- three.js names: GLTFLoader turns spaces into underscores (`Medal hook 00` → `Medal_hook_00`), as `races.ts` already relies on (`Triathlon_bag`).

## Review Focus

- More finished races than hooks: extra medals must still appear (stacked on the last hook), not vanish — tested in Task 2.
- A race finished *today*: `isDone` is false on race day, so the medal appears the day after — tested in Task 2.
- A medal for a race without a `post`: clicking must open the list, not a blank story — Task 4 step.
- `medal.photo` that fails to load: the engraved face must stay, not a black disc — Task 3 step.
- Hovering while zoomed into the monitor: no swing and no pointer, like the other clickables — Task 3/4 steps.

---

### Task 1: Model the hanger in Blender

**Files:**
- Create: `scripts/build_medal_hanger.py`
- Modify (generated): `model/Minimal_Reacto_Room.blend`, `public/models/room.glb`

**Interfaces:**
- Produces: in `room.glb`, a node `Medal hanger` (in collection `08 Triathlon gear`) with mesh child `Medal hanger bar` and 6 empties `Medal hook 00` … `Medal hook 05`, ordered left to right as seen from the room, each placed at the point a ribbon hangs from.

- [ ] **Step 1: Write the script** in the style of `scripts/build_monitor_arm.py` (docstring with run command, `--save` flag, removes any previous `Medal hanger` objects so it is re-runnable). Bar ≈ 0.50 m long, 0.06 m tall, 4 mm thick, standing 15 mm off the wall on two stand-offs, centred at Blender (x −2.085, y −1.65, z 1.38); letters cut through using a text object converted to mesh and a boolean difference; 6 hooks (small bent rods) evenly spaced along the underside. Material `Matte black steel` (base 0.02, roughness 0.6, metallic 0.8).
- [ ] **Step 2: Run it**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend --python scripts/build_medal_hanger.py -- --save`
Expected: exits 0, prints the 6 hook positions.

- [ ] **Step 3: Check clearance with a render** from the `01 Hero isometric` camera (`bpy.ops.render.render(write_still=True)` to the scratchpad). Expected: the bar is fully visible above the bag and clear of the Reacto rear wheel (rear axle at y −1.053, z 0.84, wheel radius ≈ 0.35). If it overlaps, move the centre along y towards the corner or raise z, and re-run.
- [ ] **Step 4: Re-export**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend --python scripts/export_room.py -- public/models/room.glb`
Then list node names in the GLB (the `node -e` one-liner reading the JSON chunk). Expected: `Medal hanger`, `Medal hanger bar`, `Medal hook 00`…`05` present.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_medal_hanger.py model/Minimal_Reacto_Room.blend public/models/room.glb
git commit -m "feat(room): SWIM · BIKE · RUN medal hanger above the tri bag"
```
(Note: the .blend/.glb also carry the uncommitted Mac mini and monitor-arm changes — commit those first, separately, with their scripts.)

### Task 2: Medal logic

**Files:**
- Create: `src/components/room/medals.ts`, `src/components/room/medals.test.ts`
- Modify: `src/components/room/races.ts` (type + header comment)

**Interfaces:**
- Produces:
  - in `races.ts`: `export type RaceMedal = { photo?: string; ribbon?: string }`; `Race.medal?: RaceMedal`
  - `HOOK_PREFIX = 'Medal_hook_'`, `MEDAL_PREFIX = 'Medal_'`, `DEFAULT_RIBBON = '#1f4fa8'`
  - `finishedRaces(races: Race[], now?: Date): Race[]` — done races, date order
  - `hangMedals(races: Race[], hookCount: number): { race: Race; hook: number; stack: number }[]` — race i on hook min(i, hookCount−1); `stack` counts medals already on that hook (0 for the first)
  - `engraving(race: Race): { title: string; year: string }` — title is `race.name`, year from `race.date`
  - `medalRaceId(objectName: string): string | null` — `'Medal_letape-greece-2026'` → `'letape-greece-2026'`; hook/hanger names → `null`

- [ ] **Step 1: Write the failing tests** in `medals.test.ts`:

```ts
const race = (id: string, date: string): Race => ({ id, name: id, date, location: 'x', kind: 'x' });
const NOW = new Date(2026, 10, 26);

it('only races before today get medals, in date order', () => {
    const rs = [race('b', '2026-06-01'), race('future', '2027-04-03'), race('a', '2026-04-04'), race('today', '2026-11-26')];
    expect(finishedRaces(rs, NOW).map((r) => r.id)).toEqual(['a', 'b']);
});
it('one medal per hook, left to right', () => {
    expect(hangMedals([race('a', '2026-01-01'), race('b', '2026-02-01')], 6).map((m) => [m.hook, m.stack])).toEqual([[0, 0], [1, 0]]);
});
it('extra medals stack on the last hook', () => {
    const rs = ['a', 'b', 'c', 'd'].map((id, i) => race(id, `2026-0${i + 1}-01`));
    expect(hangMedals(rs, 2).map((m) => [m.hook, m.stack])).toEqual([[0, 0], [1, 0], [1, 1], [1, 2]]);
});
it('no hooks, no medals', () => expect(hangMedals([race('a', '2026-01-01')], 0)).toEqual([]));
it('engraves the name and the year', () =>
    expect(engraving(race('L’Étape Greece', '2026-04-04'))).toEqual({ title: 'L’Étape Greece', year: '2026' }));
it('reads the race id back from a medal object name', () => {
    expect(medalRaceId('Medal_letape-greece-2026')).toBe('letape-greece-2026');
    expect(medalRaceId('Medal_hook_00')).toBeNull();
    expect(medalRaceId('Medal_hanger_bar')).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/room/medals.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `medals.ts` with the signatures above, using `isDone` and `racesInOrder`-style sorting from `races.ts`; `medalRaceId` must reject names starting with `Medal_hook_` or `Medal_hanger`. Add `RaceMedal` to `races.ts` and a line to its header comment: "Add `medal: { photo, ribbon }` to use a photo of the real medal and its ribbon colour."
- [ ] **Step 4: Run** `npm test` — Expected: all suites PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(medals): which races get medals and where they hang"`

### Task 3: Medals in the scene

**Files:**
- Create: `src/components/room/Medals.tsx`, `src/components/room/medalState.ts`
- Modify: `src/components/room/RoomScene.tsx` (mount `<Medals scene={scene} zoomed={zoomed} />` next to `<RecordRack />`; set hover in `onRoomHover`/`onRoomLeave`)

**Interfaces:**
- Consumes: Task 1 hook empties; Task 2 `finishedRaces`, `hangMedals`, `engraving`, `MEDAL_PREFIX`, `HOOK_PREFIX`, `DEFAULT_RIBBON`.
- Produces: `medalState.ts` with `setMedalHover(raceId: string | null): void` and `getMedalHover(): string | null` (module-level, like `rackState.ts`); each medal is a `THREE.Group` named `Medal_<race.id>` added under the hook's parent at the hook's position.

- [ ] **Step 1: Implement `Medals.tsx`.** On mount: collect `Medal_hook_NN` objects from `scene` sorted by name, run `hangMedals(finishedRaces(RACES), hooks.length)`, and for each build a group pivoting at the hook: a V ribbon (two thin planes, `medal.ribbon ?? DEFAULT_RIBBON`, ≈ 0.12 m long) and a gold disc (cylinder r 0.035 m, depth 4 mm, `MeshStandardMaterial` color `#c9a227`, metalness 1, roughness 0.3) whose front face uses a canvas texture with the engraving (darker gold text on gold, race name wrapped to ≤ 3 lines, year below). Stacked medals (`stack > 0`) hang 2 cm lower and 6 mm further from the wall each. If `medal.photo` is set, load it with `TextureLoader` and swap the face map **only in the onLoad callback**, so a failed load keeps the engraving. Dispose geometries, materials and textures on unmount.
- [ ] **Step 2: Swing in `useFrame`.** The hovered medal (`getMedalHover()`, ignored while `zoomed`) gets a damped swing about the hook's horizontal axis parallel to the wall: amplitude ≈ 0.12 rad, ≈ 1.6 Hz, decaying over ≈ 2 s after the pointer leaves; others settle to rest.
- [ ] **Step 3: Hook up hover** in `RoomScene.onRoomHover`: `setMedalHover(!zoomed ? medalRaceIdOf(e.object) : null)`, where the walk up the parents uses `medalRaceId`; `onRoomLeave` clears it.
- [ ] **Step 4: Verify in the app.** `npm run dev`, open the room. Expected: one engraved medal reading "L’Étape Greece by Tour de France / 2026" on the first hook, five empty hooks; it swings on hover, not while zoomed into the monitor. Temporarily set a bogus `medal.photo` on L'Étape: the engraving stays (revert after).
- [ ] **Step 5: Commit** `git commit -m "feat(medals): engraved medals hang from the hooks and swing on hover"`

### Task 4: Click a medal to open its race

**Files:**
- Modify: `src/components/room/RoomScene.tsx` (`Clickable`, `clickableFor`, `onRoomClick`, props), `src/components/room/RoomExperience.tsx`, `src/components/room/RaceCalendar.tsx`

**Interfaces:**
- Consumes: Task 2 `medalRaceId`; `RACES` from `races.ts`.
- Produces: `RoomSceneProps.onMedalClick: (raceId: string) => void`; `RaceCalendar` props `{ onClose: () => void; initialRaceId?: string }`.

- [ ] **Step 1: `RaceCalendar`**: initialise `race` state to the race with `initialRaceId` **only if it has a `post`**, else `null` (the list). Escape from a story opened this way still goes back to the list first, as today.
- [ ] **Step 2: `RoomScene`**: add `{ kind: 'medal'; race: string }` to `Clickable`, checked in `clickableFor` before the other kinds via `medalRaceId(o.name)`; `onRoomClick` calls `onMedalClick(target.race)`.
- [ ] **Step 3: `RoomExperience`**: replace `racesOpen: boolean` with `raceView: { raceId?: string } | null`; the tri bag opens `{}`, a medal opens `{ raceId }`; render `<RaceCalendar initialRaceId={raceView.raceId} onClose={closeRaces} />`; keep `popupOpenRef` counting it.
- [ ] **Step 4: Verify.** `npm run build && npm test` pass. In `npm run dev`: clicking the L'Étape medal shows the paper unfolding straight onto the Sparta write-up, Escape goes back to the list, then closes; clicking the bag still opens the list; bag, cap, goggles and bike still work. Temporarily remove L'Étape's `post`: the medal opens the list (revert after).
- [ ] **Step 5: Commit** `git commit -m "feat(medals): clicking a medal opens that race's story"`
