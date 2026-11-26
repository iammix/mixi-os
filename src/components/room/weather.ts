// The real weather outside the window, in Rotterdam and Thessaloniki, from Open-Meteo (no key
// needed). WindowView reads it to draw clouds, rain, snow and wind. `?weather=rain,windy` (any of
// sunny, cloudy, rain, snow, windy) forces a weather for both places, for trying them out.

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
