import { describe, expect, it } from 'vitest';
import { clockAngles, timeIn } from './clock';
import { WINDOW_PLACES } from './windowState';

const TAU = Math.PI * 2;

describe('timeIn', () => {
    it('Rotterdam and Thessaloniki are an hour apart in winter', () => {
        const noonUtc = new Date(Date.UTC(2026, 10, 26, 12, 0, 0));
        expect(timeIn(noonUtc, WINDOW_PLACES.rotterdam.timeZone)).toEqual({ hours: 13, minutes: 0, seconds: 0 });
        expect(timeIn(noonUtc, WINDOW_PLACES.home.timeZone)).toEqual({ hours: 14, minutes: 0, seconds: 0 });
    });

    it('and still an hour apart in summer time', () => {
        const noonUtc = new Date(Date.UTC(2026, 6, 1, 12, 34, 56));
        expect(timeIn(noonUtc, WINDOW_PLACES.rotterdam.timeZone)).toEqual({ hours: 14, minutes: 34, seconds: 56 });
        expect(timeIn(noonUtc, WINDOW_PLACES.home.timeZone)).toEqual({ hours: 15, minutes: 34, seconds: 56 });
    });

    it('midnight is 0, not 24', () => {
        expect(timeIn(new Date(Date.UTC(2026, 10, 26, 23, 0, 0)), 'Europe/Amsterdam').hours).toBe(0);
    });
});

describe('clockAngles', () => {
    it('angles run clockwise from 12', () => {
        const a = clockAngles({ hours: 15, minutes: 30, seconds: 15 });
        expect(a.seconds).toBeCloseTo(TAU / 4);
        expect(a.minutes).toBeCloseTo(TAU / 2 + (15 / 60) * (TAU / 60));
        expect(a.hours).toBeCloseTo(TAU / 4 + (30.25 / 60) * (TAU / 12));
    });

    it('the second hand ticks: fractions of a second do not move it', () => {
        expect(clockAngles({ hours: 0, minutes: 0, seconds: 7.9 }).seconds).toBeCloseTo((7 / 60) * TAU);
    });
});
