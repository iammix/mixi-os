import { describe, expect, it } from 'vitest';
import { monthIn, sportOf, summarise } from './summary.mjs';

describe('sportOf', () => {
    it('sorts Garmin activity types into swim, bike and run', () => {
        expect(sportOf('lap_swimming')).toBe('swim');
        expect(sportOf('open_water_swimming')).toBe('swim');
        expect(sportOf('road_biking')).toBe('bike');
        expect(sportOf('indoor_cycling')).toBe('bike');
        expect(sportOf('virtual_ride')).toBe('bike');
        expect(sportOf('running')).toBe('run');
        expect(sportOf('treadmill_running')).toBe('run');
    });

    it('leaves out everything else', () => {
        expect(sportOf('strength_training')).toBeNull();
        expect(sportOf('walking')).toBeNull();
        expect(sportOf(undefined)).toBeNull();
    });
});

describe('monthIn', () => {
    it('is the month where the board is, not in UTC', () => {
        // 23:30 UTC on 30 Nov is already 1 Dec in Amsterdam.
        const late = new Date(Date.UTC(2026, 10, 30, 23, 30));
        expect(monthIn(late, 'Europe/Amsterdam')).toEqual({ month: '2026-12', start: '2026-12-01', end: '2026-12-01' });
        expect(monthIn(late, 'UTC')).toEqual({ month: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    });
});

describe('summarise', () => {
    const act = (typeKey, startTimeLocal, distance, duration, movingDuration) => ({
        activityType: { typeKey },
        startTimeLocal,
        distance,
        duration,
        movingDuration,
    });

    it('adds up distance, moving time and sessions per sport', () => {
        const totals = summarise(
            [
                act('lap_swimming', '2026-11-02 07:00:00', 2400, 3000, 2700),
                act('lap_swimming', '2026-11-09 07:00:00', 1600, 2000),
                act('road_biking', '2026-11-08 09:00:00', 85123, 10800, 10200),
                act('running', '2026-11-10 18:00:00', 10050, 3000, 2950),
                act('strength_training', '2026-11-11 18:00:00', 0, 1800),
            ],
            '2026-11',
        );
        expect(totals).toEqual({
            swim: { km: 4, seconds: 4700, sessions: 2 },
            bike: { km: 85.12, seconds: 10200, sessions: 1 },
            run: { km: 10.05, seconds: 2950, sessions: 1 },
        });
    });

    it('ignores activities from other months and rows with missing numbers', () => {
        const totals = summarise(
            [act('running', '2026-10-31 18:00:00', 10000, 3000), act('running', '2026-11-01 08:00:00', null, undefined)],
            '2026-11',
        );
        expect(totals.run).toEqual({ km: 0, seconds: 0, sessions: 1 });
    });
});
