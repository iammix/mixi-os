import { describe, expect, it } from 'vitest';
import { daylight, sunPosition, timeOffset } from './sun';

const ROTTERDAM = { lat: 51.92, lon: 4.48 };

describe('sunPosition', () => {
    it('is up at noon and down at midnight in Rotterdam', () => {
        const noon = sunPosition(new Date(Date.UTC(2026, 10, 26, 11, 40)), ROTTERDAM.lat, ROTTERDAM.lon);
        const midnight = sunPosition(new Date(Date.UTC(2026, 10, 26, 23, 0)), ROTTERDAM.lat, ROTTERDAM.lon);
        expect(noon.elevation).toBeGreaterThan(10);
        expect(noon.azimuth).toBeGreaterThan(160);
        expect(noon.azimuth).toBeLessThan(200);
        expect(midnight.elevation).toBeLessThan(-40);
    });
});

describe('daylight', () => {
    it('is night well below the horizon and day well above it', () => {
        expect(daylight(-20)).toBe(0);
        expect(daylight(-6)).toBe(0);
        expect(daylight(8)).toBe(1);
        expect(daylight(45)).toBe(1);
    });

    it('fades in between, more light the higher the sun', () => {
        expect(daylight(0)).toBeGreaterThan(0);
        expect(daylight(0)).toBeLessThan(daylight(4));
        expect(daylight(4)).toBeLessThan(1);
    });

    it('a heavy sky takes some of it away', () => {
        expect(daylight(30, 1)).toBeCloseTo(0.7);
        expect(daylight(30, 0.5)).toBeGreaterThan(daylight(30, 1));
    });
});

describe('timeOffset', () => {
    // 14:00:30 in Rotterdam (13:00:30 UTC in winter).
    const now = new Date(Date.UTC(2026, 10, 26, 13, 0, 30));
    const rotterdamTime = (ms: number) =>
        new Date(now.getTime() + ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    it('moves the clock to the time asked for in Rotterdam', () => {
        expect(rotterdamTime(timeOffset('?time=22:15', now))).toBe('22:15:00');
        expect(rotterdamTime(timeOffset('?time=6:05', now))).toBe('06:05:00');
    });

    it('goes the short way round midnight', () => {
        // 00:30 in Rotterdam: 23:00 is an hour and a half back, not 22 and a half ahead.
        const justAfterMidnight = new Date(Date.UTC(2026, 10, 25, 23, 30));
        expect(timeOffset('?time=23:00', justAfterMidnight)).toBe(-90 * 60 * 1000);
        // And from 14:00, 01:00 is 11 hours on rather than 13 back.
        expect(timeOffset('?time=01:00', now)).toBe((11 * 60 * 60 - 30) * 1000);
    });

    it('leaves the clock alone without a valid time', () => {
        expect(timeOffset('', now)).toBe(0);
        expect(timeOffset('?time=noon', now)).toBe(0);
        expect(timeOffset('?time=25:00', now)).toBe(0);
    });
});
