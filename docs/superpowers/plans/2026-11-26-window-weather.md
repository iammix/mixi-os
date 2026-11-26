# Window Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The view outside the room's window shows the real current weather in Rotterdam / Thessaloniki (sunny, cloudy, rainy, snowy, windy), visible only through the window.

**Architecture:** A small store (`weather.ts`) fetches Open-Meteo for both places, maps WMO codes to a `Weather` value and notifies subscribers, like `windowState.ts` does. `WindowView.tsx` reads it each relight: cloud uniforms in the sky shader, a dimmed/greyed look, and a new stencil-masked `Precipitation` points mesh. Wind modifies slant, cloud drift and mover bob.

**Tech Stack:** React 18, @react-three/fiber 8, three 0.169, Vite 5, TypeScript. Adds `vitest@^2` (dev) for the pure logic.

**Spec:** `docs/superpowers/specs/2026-11-26-window-weather-design.md`

## Global Constraints

- Weather is drawn only inside the window stencil (use `STENCIL` from `WindowView.tsx`); nothing outside the window, no labels, no sound.
- Open-Meteo, no API key: `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=weather_code,cloud_cover,wind_speed_10m` (wind in km/h by default).
- Refresh every 15 min; on failure keep the last value; never-fetched default is clear (sunny, 0 cloud, 0 wind).
- Windy = `wind_speed_10m >= 30`.
- Override: `?weather=sunny|cloudy|rain|snow|windy`, comma-combinable, applies to both places and disables fetching.
- Small screens (`window.innerWidth < 768`): half the particles.
- No changes to Blender, `build_window_view.py` or `room.glb`.
- `npm run build` and `npm run lint` must pass.

## Review Focus

- API down / offline / CORS error on first load → view renders clear sky, no console error spam, retries next interval. (Task 2 test `keeps last value on fetch failure`.)
- Malformed or partial response (missing `current`, unknown weather code) → treated as cloudy-by-cover, never throws. (Task 1 test `unknown code falls back to cloud cover`.)
- Bad override like `?weather=hail` or `?weather=` → ignored tokens, falls back to live data if no valid token. (Task 1 test `ignores unknown override tokens`.)
- Switching place mid-fetch → the new place shows its own weather immediately (both fetched up front). (Task 2 test `fetches both places on start`.)
- Unmount/remount of the scene (HMR, route change) → no duplicate intervals, particle geometry disposed. (Task 2 test `stop clears the interval`; Task 4 dispose check in cleanup.)

---

### Task 1: Weather model and WMO mapping (pure)

**Files:**
- Create: `src/components/room/weather.ts`
- Test: `src/components/room/weather.test.ts`
- Modify: `package.json` (add `vitest` dev dep, script `"test": "vitest run"`)

**Interfaces:**
- Produces:
  - `type Sky = 'sunny' | 'cloudy' | 'rain' | 'snow'`
  - `type Weather = { sky: Sky; intensity: number /*0..1*/; cloud: number /*0..1*/; windy: boolean; wind: number /*km/h*/ }`
  - `const CLEAR: Weather` = `{ sky: 'sunny', intensity: 0, cloud: 0, windy: false, wind: 0 }`
  - `fromOpenMeteo(json: unknown): Weather`
  - `parseOverride(search: string): Weather | null`

- [ ] **Step 1: Install vitest, add `test` script.** `npm i -D vitest@^2`.
- [ ] **Step 2: Write failing tests** in `weather.test.ts`:
  - `fromOpenMeteo({current:{weather_code:0,cloud_cover:5,wind_speed_10m:10}})` → `sky 'sunny'`, `cloud 0.05`, `windy false`.
  - code 3 → `'cloudy'`; code 45 → `'cloudy'` (fog).
  - code 61 → `'rain'`, intensity `< 0.5`; code 65 → `'rain'`, intensity `>= 0.8`; code 95 → `'rain'`, intensity `1`.
  - code 71 → `'snow'` light; code 75 → `'snow'` heavy; code 86 → `'snow'`.
  - `wind_speed_10m: 30` → `windy true`; `29.9` → `false`.
  - rain/snow force `cloud >= 0.8` regardless of `cloud_cover`.
  - `unknown code falls back to cloud cover`: code 999, cover 70 → `'cloudy'`; cover 20 → `'sunny'`. `fromOpenMeteo({})` and `fromOpenMeteo(null)` → `CLEAR`.
  - `parseOverride('?weather=rain,windy')` → `sky 'rain'`, `windy true`, intensity `0.6`. `'?weather=snow'` → snow. `'?weather=windy'` → sunny + windy (wind 45).
  - `ignores unknown override tokens`: `'?weather=hail'`, `'?weather='`, `''` → `null`; `'?weather=hail,snow'` → snow.
- [ ] **Step 3: Run** `npm test` — FAIL (module missing).
- [ ] **Step 4: Implement** in `weather.ts`. Code groups: 0–1 sunny; 2–3, 45–48 cloudy; 51–57 drizzle (rain 0.3), 61/63/65 rain 0.4/0.6/0.9, 66–67 rain 0.6, 80/81/82 rain 0.5/0.7/0.9, 95–99 rain 1; 71/73/75 snow 0.4/0.6/0.9, 77 snow 0.3, 85/86 snow 0.6/0.9. Unknown: cloudy if cover ≥ 50 else sunny. Cloudy `cloud = max(cover, 0.6)`. Override intensities 0.6, cloudy cover 0.85, windy wind 45.
- [ ] **Step 5: Run** `npm test` — PASS.
- [ ] **Step 6: Commit** `feat(weather): weather model and WMO mapping`.

### Task 2: Weather store (fetch, refresh, subscribe)

**Files:**
- Modify: `src/components/room/weather.ts`
- Test: `src/components/room/weather.test.ts`

**Interfaces:**
- Consumes: `WINDOW_PLACES`, `WindowPlace` from `windowState.ts`; `fromOpenMeteo`, `parseOverride`, `CLEAR` (Task 1).
- Produces:
  - `getWeather(place: WindowPlace): Weather`
  - `subscribeWeather(listener: () => void): () => void`
  - `startWeather(opts?: { fetch?: typeof fetch; search?: string }): () => void` — returns stop. Idempotent (ref-counted: a second start doesn't add an interval).
  - `const REFRESH_MS = 15 * 60 * 1000`

- [ ] **Step 1: Write failing tests** (fake timers, stub fetch):
  - `fetches both places on start`: stub called twice with lat/lon of rotterdam and home; after resolve, `getWeather('rotterdam')` reflects its response, listener called.
  - `keeps last value on fetch failure`: first fetch ok (rain), advance `REFRESH_MS`, stub rejects → still rain; no throw.
  - never-fetched / first fetch rejects → `getWeather(...)` equals `CLEAR`.
  - `stop clears the interval`: after stop, advancing `REFRESH_MS` makes no fetch calls.
  - override: `search: '?weather=snow'` → no fetch calls, both places snow.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement.** Module-level `Record<WindowPlace, Weather>` and listener set, following `windowState.ts`. Catch errors silently per place (`res.ok` check too).
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(weather): live weather store with 15-minute refresh`.

### Task 3: Clouds and overcast look in the sky

**Files:**
- Create: `src/components/room/skyLook.ts` — move `Look`, `LOOKS`, `lookAt` here from `WindowView.tsx` (keeps the test free of r3f imports)
- Modify: `src/components/room/WindowView.tsx` (sky shader, `useFrame` relight, mount effect)
- Test: `src/components/room/skyLook.test.ts`

**Interfaces:**
- Consumes: `startWeather`, `getWeather`, `subscribeWeather` (Task 2).
- Produces: `applyWeather(look: Look, w: Weather): Look` in `skyLook.ts` (pure) — greys/dims for clouds; sky uniforms `cloud: float`, `drift: float` (time-based offset), `cloudColor: vec3`.

- [ ] **Step 1: Write failing test** in `skyLook.test.ts` for `applyWeather`:
  - `CLEAR` → returns look unchanged (deep equal).
  - `cloud 1` → `light` ≤ 0.7 × input light; `stars` = 0; `top` and `horizon` saturation lower than input (compare via `THREE.Color.getHSL`).
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement.** `applyWeather`: lerp top/horizon toward grey `#8a929c` (scaled by `look.light`) by `0.75 * cloud`, `light *= 1 - 0.35 * cloud`, `stars *= 1 - cloud`. In the sky shader add 2–3 octave value-noise clouds over `(phi * SKY_R + drift, vWorld.y)`, `smoothstep(1 - cloud, ...)` coverage, coloured `cloudColor` (horizon-lit grey, lighter by day), and fade sun glow by `1 - cloud`. `drift += dt * (0.01 + wind/45 * 0.05)` each frame. Call `startWeather()` in an effect, `subscribeWeather` → set `lastUpdate = -Infinity` to relight.
- [ ] **Step 4: Run** `npm test` — PASS; `npm run build` — PASS.
- [ ] **Step 5: Browser check** `npm run dev`: `?weather=sunny` looks as before; `?weather=cloudy` shows drifting grey clouds, no sun, dimmer diorama; click window — both places update. Nothing outside the window opening changes.
- [ ] **Step 6: Commit** `feat(weather): clouds and overcast light in the window view`.

### Task 4: Rain and snow particles, wind effects

**Files:**
- Create: `src/components/room/Precipitation.ts`
- Modify: `src/components/room/WindowView.tsx`

**Interfaces:**
- Consumes: `STENCIL`, `CENTER`, `PHI_RANGE`, `SKY_LOW`, `SKY_HIGH` (export them from `WindowView.tsx` or move to a small `viewGeometry.ts` if circular import), `Weather`.
- Produces: `createPrecipitation(count: number): { points: THREE.Points; update(w: Weather, time: number): void; dispose(): void }`

- [ ] **Step 1: Implement `createPrecipitation`.** Positions seeded once in the annular sector (r 0.35–2.6 from `CENTER`, phi in `PHI_RANGE`, y 0.42–`SKY_HIGH`). `ShaderMaterial` with `...STENCIL`, `transparent`, `depthWrite: false`; uniforms `time, mode (0 rain / 1 snow), density, slant, fallSpeed`. Vertex shader wraps y with `mod`, applies slant `x += slant * fallen`, snow wobble `sin(time + seed)`; discard points with `seed > density`. Rain: elongated streak in fragment (`gl_PointCoord` thin vertical), pale blue-grey α 0.5; snow: soft round dot, white α 0.9. Count `1200` (`600` if `innerWidth < 768`). `renderOrder = 3`.
- [ ] **Step 2: Wire into `WindowView`.** Add `points` to the scene in the mount effect (after the mask setup), dispose in cleanup. In `useFrame` call `update(getWeather(place), now)`; hide when sky is sunny/cloudy. Slant `0.15` calm, `0.6` when windy. When windy, movers get `rotation.z = sin(now*2)*0.06` and `position.y += sin(now*1.5)*0.004` (boats only).
- [ ] **Step 3: Run** `npm run build && npm run lint` — PASS.
- [ ] **Step 4: Browser check:** `?weather=rain` streaks only inside the window, falling fast; `?weather=snow` slow wobbling flakes; `rain,windy` visibly slanted and clouds faster, boats bob; mobile width (devtools 390px) still smooth; toggle place and HMR reload — no duplicated particle layers.
- [ ] **Step 5: Commit** `feat(weather): rain, snow and wind in the window view`.

### Task 5: Live-data check and docs

**Files:**
- Modify: `src/components/room/WindowView.tsx` header comment (mention weather)

- [ ] **Step 1:** Without override, open dev, check Network: two Open-Meteo calls, view matches today's real weather in each city. Block the request in devtools, reload → clear sky, no uncaught errors.
- [ ] **Step 2:** `npm test && npm run build && npm run lint` — all PASS.
- [ ] **Step 3: Commit** `docs(weather): note live weather in window view`.
