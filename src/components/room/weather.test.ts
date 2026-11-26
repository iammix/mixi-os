import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLEAR, REFRESH_MS, fromOpenMeteo, getWeather, parseOverride, startWeather, subscribeWeather } from './weather';

const current = (weather_code: number, cloud_cover = 50, wind_speed_10m = 10) => ({
    current: { weather_code, cloud_cover, wind_speed_10m },
});

describe('fromOpenMeteo', () => {
    it('clear sky is sunny with its cloud cover', () => {
        const w = fromOpenMeteo(current(0, 5, 10));
        expect(w.sky).toBe('sunny');
        expect(w.cloud).toBeCloseTo(0.05);
        expect(w.windy).toBe(false);
    });

    it('overcast and fog are cloudy', () => {
        expect(fromOpenMeteo(current(3)).sky).toBe('cloudy');
        expect(fromOpenMeteo(current(45)).sky).toBe('cloudy');
    });

    it('rain codes give rain with intensity', () => {
        const light = fromOpenMeteo(current(61));
        expect(light.sky).toBe('rain');
        expect(light.intensity).toBeLessThan(0.5);
        expect(fromOpenMeteo(current(65)).intensity).toBeGreaterThanOrEqual(0.8);
        const storm = fromOpenMeteo(current(95));
        expect(storm.sky).toBe('rain');
        expect(storm.intensity).toBe(1);
    });

    it('snow codes give snow with intensity', () => {
        const light = fromOpenMeteo(current(71));
        expect(light.sky).toBe('snow');
        expect(light.intensity).toBeLessThan(0.5);
        expect(fromOpenMeteo(current(75)).intensity).toBeGreaterThanOrEqual(0.8);
        expect(fromOpenMeteo(current(86)).sky).toBe('snow');
    });

    it('windy from 30 km/h', () => {
        expect(fromOpenMeteo(current(0, 0, 30)).windy).toBe(true);
        expect(fromOpenMeteo(current(0, 0, 29.9)).windy).toBe(false);
        expect(fromOpenMeteo(current(0, 0, 30)).wind).toBe(30);
    });

    it('rain and snow are always heavily clouded', () => {
        expect(fromOpenMeteo(current(61, 10)).cloud).toBeGreaterThanOrEqual(0.8);
        expect(fromOpenMeteo(current(71, 0)).cloud).toBeGreaterThanOrEqual(0.8);
    });

    it('unknown code falls back to cloud cover', () => {
        expect(fromOpenMeteo(current(999, 70)).sky).toBe('cloudy');
        expect(fromOpenMeteo(current(999, 20)).sky).toBe('sunny');
        expect(fromOpenMeteo({})).toEqual(CLEAR);
        expect(fromOpenMeteo(null)).toEqual(CLEAR);
    });
});

describe('parseOverride', () => {
    it('reads combined tokens', () => {
        const w = parseOverride('?weather=rain,windy')!;
        expect(w.sky).toBe('rain');
        expect(w.windy).toBe(true);
        expect(w.intensity).toBe(0.6);
        expect(parseOverride('?weather=snow')!.sky).toBe('snow');
    });

    it('windy alone is sunny and windy', () => {
        const w = parseOverride('?weather=windy')!;
        expect(w.sky).toBe('sunny');
        expect(w.windy).toBe(true);
        expect(w.wind).toBe(45);
    });

    it('ignores unknown override tokens', () => {
        expect(parseOverride('?weather=hail')).toBeNull();
        expect(parseOverride('?weather=')).toBeNull();
        expect(parseOverride('')).toBeNull();
        expect(parseOverride('?weather=hail,snow')!.sky).toBe('snow');
    });
});

describe('weather store', () => {
    const ok = (code: number) =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(current(code, 90, 5)) } as Response);
    const flush = async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fetches both places on start', async () => {
        const fetch = vi.fn((url: string) => ok(url.includes('latitude=51.92') ? 63 : 0));
        const listener = vi.fn();
        const unsubscribe = subscribeWeather(listener);
        const stop = startWeather({ fetch: fetch as unknown as typeof globalThis.fetch, search: '' });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls.map(([u]) => u).join(' ')).toMatch(/latitude=40\.63.*longitude=22\.94|longitude=22\.94/);
        expect(getWeather('rotterdam').sky).toBe('rain');
        expect(getWeather('home').sky).toBe('sunny');
        expect(listener).toHaveBeenCalled();
        stop();
        unsubscribe();
    });

    it('keeps last value on fetch failure', async () => {
        let fail = false;
        const fetch = vi.fn(() => (fail ? Promise.reject(new Error('offline')) : ok(63)));
        const stop = startWeather({ fetch: fetch as unknown as typeof globalThis.fetch, search: '' });
        await flush();
        expect(getWeather('rotterdam').sky).toBe('rain');
        fail = true;
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(getWeather('rotterdam').sky).toBe('rain');
        stop();
    });

    it('stop clears the interval', async () => {
        const fetch = vi.fn(() => ok(0));
        const stop = startWeather({ fetch: fetch as unknown as typeof globalThis.fetch, search: '' });
        await flush();
        stop();
        await vi.advanceTimersByTimeAsync(REFRESH_MS * 2);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('a second start shares the first one', async () => {
        const fetch = vi.fn(() => ok(0));
        const f = fetch as unknown as typeof globalThis.fetch;
        const stop1 = startWeather({ fetch: f, search: '' });
        const stop2 = startWeather({ fetch: f, search: '' });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        stop1();
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(fetch).toHaveBeenCalledTimes(4);
        stop2();
    });

    it('is clear when the first fetch fails', async () => {
        vi.resetModules();
        const fresh = await import('./weather');
        expect(fresh.getWeather('home')).toEqual(CLEAR);
        const stop = fresh.startWeather({ fetch: (() => Promise.reject(new Error('offline'))) as typeof globalThis.fetch, search: '' });
        await flush();
        expect(fresh.getWeather('home')).toEqual(fresh.CLEAR);
        expect(fresh.getWeather('rotterdam')).toEqual(fresh.CLEAR);
        stop();
    });

    it('override skips fetching', async () => {
        const fetch = vi.fn(() => ok(0));
        const stop = startWeather({ fetch: fetch as unknown as typeof globalThis.fetch, search: '?weather=snow' });
        await flush();
        expect(fetch).not.toHaveBeenCalled();
        expect(getWeather('home').sky).toBe('snow');
        expect(getWeather('rotterdam').sky).toBe('snow');
        stop();
    });
});
