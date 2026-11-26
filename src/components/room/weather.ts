// The real weather outside the window, in Rotterdam and Thessaloniki, from Open-Meteo (no key
// needed). WindowView reads it to draw clouds, rain, snow and wind. `?weather=rain,windy` (any of
// sunny, cloudy, rain, snow, windy) forces a weather for both places, for trying them out.

import { WINDOW_PLACES, WindowPlace } from './windowState';

export type Sky = 'sunny' | 'cloudy' | 'rain' | 'snow';

/** intensity and cloud are 0..1, wind is km/h. */
export type Weather = { sky: Sky; intensity: number; cloud: number; windy: boolean; wind: number };

export const CLEAR: Weather = { sky: 'sunny', intensity: 0, cloud: 0, windy: false, wind: 0 };

const WINDY_KMH = 30;

// WMO weather codes (https://open-meteo.com/en/docs): what falls and how hard.
const PRECIPITATION: Record<number, [Sky, number]> = {
    51: ['rain', 0.3], 53: ['rain', 0.3], 55: ['rain', 0.3], 56: ['rain', 0.3], 57: ['rain', 0.3],
    61: ['rain', 0.4], 63: ['rain', 0.6], 65: ['rain', 0.9], 66: ['rain', 0.6], 67: ['rain', 0.6],
    80: ['rain', 0.5], 81: ['rain', 0.7], 82: ['rain', 0.9],
    95: ['rain', 1], 96: ['rain', 1], 99: ['rain', 1],
    71: ['snow', 0.4], 73: ['snow', 0.6], 75: ['snow', 0.9], 77: ['snow', 0.3],
    85: ['snow', 0.6], 86: ['snow', 0.9],
};
const SUNNY = new Set([0, 1]);
const CLOUDY = new Set([2, 3, 45, 48]);

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Turn an Open-Meteo `current=weather_code,cloud_cover,wind_speed_10m` response into a Weather. */
export function fromOpenMeteo(json: unknown): Weather {
    const current = (json as { current?: Record<string, unknown> } | null)?.current;
    if (!current) return CLEAR;
    const code = num(current.weather_code);
    const cover = Math.min(Math.max((num(current.cloud_cover) ?? 0) / 100, 0), 1);
    const wind = Math.max(num(current.wind_speed_10m) ?? 0, 0);
    const base = { windy: wind >= WINDY_KMH, wind };
    const falling = code !== undefined ? PRECIPITATION[code] : undefined;
    if (falling) return { ...base, sky: falling[0], intensity: falling[1], cloud: Math.max(cover, 0.85) };
    if (code !== undefined && CLOUDY.has(code)) return { ...base, sky: 'cloudy', intensity: 0, cloud: Math.max(cover, 0.6) };
    if (code !== undefined && SUNNY.has(code)) return { ...base, sky: 'sunny', intensity: 0, cloud: cover };
    if (code === undefined && current.cloud_cover === undefined) return { ...CLEAR, ...base };
    return cover >= 0.5
        ? { ...base, sky: 'cloudy', intensity: 0, cloud: Math.max(cover, 0.6) }
        : { ...base, sky: 'sunny', intensity: 0, cloud: cover };
}

/** `?weather=rain,windy` → that weather; null when the query names none we know. */
export function parseOverride(search: string): Weather | null {
    const tokens = (new URLSearchParams(search).get('weather') ?? '').split(',').map((t) => t.trim().toLowerCase());
    let weather: Weather | null = null;
    const set = (w: Partial<Weather>) => (weather = { ...(weather ?? CLEAR), ...w });
    for (const t of tokens) {
        if (t === 'sunny') set({ sky: 'sunny', intensity: 0, cloud: 0.1 });
        else if (t === 'cloudy') set({ sky: 'cloudy', intensity: 0, cloud: 0.85 });
        else if (t === 'rain') set({ sky: 'rain', intensity: 0.6, cloud: 0.9 });
        else if (t === 'snow') set({ sky: 'snow', intensity: 0.6, cloud: 0.9 });
        else if (t === 'windy') set({ windy: true, wind: 45 });
    }
    return weather;
}

// The weather in each place, kept up to date while something has called startWeather.
export const REFRESH_MS = 15 * 60 * 1000;

const weather: Record<WindowPlace, Weather> = { home: CLEAR, rotterdam: CLEAR };
const listeners = new Set<() => void>();
let running: { count: number; stop: () => void } | null = null;

export const getWeather = (place: WindowPlace) => weather[place];

export function subscribeWeather(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function set(place: WindowPlace, w: Weather) {
    weather[place] = w;
    listeners.forEach((l) => l());
}

async function load(place: WindowPlace, fetcher: typeof fetch) {
    const { lat, lon } = WINDOW_PLACES[place];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover,wind_speed_10m`;
    try {
        const res = await fetcher(url);
        if (!res.ok) return;
        set(place, fromOpenMeteo(await res.json()));
    } catch {
        // Offline or the service is down: keep what we had and try again next time.
    }
}

/** Start keeping the weather up to date (or apply `?weather=`); returns a function that stops it. */
export function startWeather(opts: { fetch?: typeof fetch; search?: string } = {}): () => void {
    if (!running) {
        const places = Object.keys(WINDOW_PLACES) as WindowPlace[];
        const override = parseOverride(opts.search ?? (typeof location !== 'undefined' ? location.search : ''));
        if (override) {
            places.forEach((p) => set(p, override));
            running = { count: 0, stop: () => {} };
        } else {
            const fetcher = opts.fetch ?? fetch.bind(globalThis);
            const refresh = () => places.forEach((p) => void load(p, fetcher));
            refresh();
            const timer = setInterval(refresh, REFRESH_MS);
            running = { count: 0, stop: () => clearInterval(timer) };
        }
    }
    running.count++;
    let stopped = false;
    return () => {
        if (stopped || !running) return;
        stopped = true;
        if (--running.count === 0) {
            running.stop();
            running = null;
        }
    };
}
