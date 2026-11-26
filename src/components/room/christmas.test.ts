import { describe, expect, it } from 'vitest';
import { christmasOverride, isChristmas } from './christmas';

// Noon UTC on a day, so the date is the same in Rotterdam.
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

describe('isChristmas', () => {
    it('is up through December and until Theofania on 6 January', () => {
        expect(isChristmas(day(2026, 12, 1))).toBe(true);
        expect(isChristmas(day(2026, 12, 25))).toBe(true);
        expect(isChristmas(day(2026, 12, 31))).toBe(true);
        expect(isChristmas(day(2027, 1, 1))).toBe(true);
        expect(isChristmas(day(2027, 1, 6))).toBe(true);
    });

    it('is down the rest of the year', () => {
        expect(isChristmas(day(2026, 11, 30))).toBe(false);
        expect(isChristmas(day(2027, 1, 7))).toBe(false);
        expect(isChristmas(day(2027, 7, 15))).toBe(false);
    });

    it('goes by the date in Rotterdam, not UTC', () => {
        // 23:30 UTC on 30 November is already 1 December in Rotterdam.
        expect(isChristmas(new Date(Date.UTC(2026, 10, 30, 23, 30)))).toBe(true);
        // 23:30 UTC on 6 January is 7 January there: they've come down.
        expect(isChristmas(new Date(Date.UTC(2027, 0, 6, 23, 30)))).toBe(false);
    });
});

describe('christmasOverride', () => {
    it('reads ?christmas=on and off, and otherwise leaves it to the date', () => {
        expect(christmasOverride('?christmas=on')).toBe(true);
        expect(christmasOverride('?christmas=off')).toBe(false);
        expect(christmasOverride('')).toBeNull();
        expect(christmasOverride('?christmas=maybe')).toBeNull();
    });
});
