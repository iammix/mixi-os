import { describe, expect, it } from 'vitest';
import { CLEAR, fromOpenMeteo, parseOverride } from './weather';

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
