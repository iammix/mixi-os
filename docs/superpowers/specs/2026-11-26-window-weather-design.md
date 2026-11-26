# Window weather — design

## Intent
The view outside the room's window (Rotterdam / Thessaloniki) already follows the real sun.
It should also show the real current weather in that place: sunny, cloudy, rainy, snowy, windy.

## Goals / non-goals
- Goal: weather is visible only through the window, inside the existing stencil mask.
- Non-goal (for now): labels, temperature, sounds, raindrops on the glass, anything outside the window.
  The owner will decide on these later.
- Anti-goal: anything that makes the room slower to load or breaks if the weather API is down.

## Approaches
- **A. Runtime, in code (chosen).** Fetch live weather, render clouds in the sky shader and
  rain/snow as particles in the stencil, wind as slant/drift/bob. No Blender or `room.glb` changes,
  easy to tune.
- B. Blender-built props (cloud meshes, swaying trees, puddles) in `build_window_view.py`.
  More on-style, but heavier GLB and a rebuild per tweak. Possible later add-on for wind.

## Design
- **Data** (`weather.ts`, new): Open-Meteo `current=weather_code,cloud_cover,wind_speed_10m`
  for each place's lat/lon (already in `windowState.ts`). No API key. Refresh every 15 min;
  on failure keep the last value, default to clear.
- **Mapping** (WMO codes): 0–1 sunny · 2–3, 45–48 (fog) cloudy · 51–67, 80–82, 95–99 rainy ·
  71–77, 85–86 snowy. Intensity (light/heavy) from the code. Windy is a modifier on top
  when wind ≥ 30 km/h. Cloud cover % sets cloudiness.
- **Clouds**: procedural noise clouds in the sky fragment shader, coverage + drift speed as
  uniforms. Overcast greys/dims sky colours and the scene tint, and fades sun and stars.
- **Rain / snow**: one `THREE.Points` (or instanced streaks) volume in front of the diorama,
  stencil-masked like the rest of the view, animated in the vertex shader. Rain: thin fast
  streaks; snow: slow wobbling flakes. Density from intensity.
- **Wind**: slants precipitation, speeds cloud drift, adds a bob/roll to the sailboat and water taxi.
- **Testing override**: `?weather=sunny|cloudy|rain|snow|windy` (combinable, e.g. `rain,windy`)
  forces a state for both places.

## Left to the builder (Claude's calls)
- Exact thresholds, particle counts, colours and speeds — tuned by eye in the browser.
- Particle count halved on small screens.
- Fetch both places up front so switching the view is instant.
