import { describe, expect, it, vi } from 'vitest';
import { daysToGo, distance, duration, fromApi, getTraining, monthLabel, nextRace, sessions, startTraining } from './training';

const MONTH = {
    month: '2026-11',
    updated: '2026-11-26T21:00:00.000Z',
    swim: { km: 4, seconds: 4700, sessions: 2 },
    bike: { km: 85.12, seconds: 10200, sessions: 1 },
    run: { km: 10.05, seconds: 2950, sessions: 1 },
};

describe('fromApi', () => {
    it('reads the training API response', () => {
        expect(fromApi(MONTH)).toEqual({ month: '2026-11', swim: MONTH.swim, bike: MONTH.bike, run: MONTH.run });
    });

    it('turns down anything else', () => {
        expect(fromApi(null)).toBeNull();
        expect(fromApi({ error: 'garmin unavailable' })).toBeNull();
        expect(fromApi({ ...MONTH, month: 'November' })).toBeNull();
        expect(fromApi({ ...MONTH, run: { km: 'far', seconds: 1, sessions: 1 } })).toBeNull();
    });
});

describe('writing it on the board', () => {
    it('names the month', () => {
        expect(monthLabel('2026-11')).toBe('November 2026');
    });

    it('swims in metres, rides and runs in kilometres', () => {
        expect(distance('swim', 2.4)).toBe('2,400 m');
        expect(distance('bike', 85)).toBe('85 km');
        expect(distance('run', 12.46)).toBe('12.5 km');
    });

    it('times in hours and minutes', () => {
        expect(duration(4 * 3600 + 5 * 60)).toBe('4h 05m');
        expect(duration(45 * 60)).toBe('45m');
        expect(duration(0)).toBe('0m');
    });

    it('counts sessions by name', () => {
        expect(sessions('swim', 6)).toBe('6 swims');
        expect(sessions('bike', 1)).toBe('1 ride');
        expect(sessions('run', 0)).toBe('0 runs');
    });
});

describe('startTraining', () => {
    it('fetches the month from the API', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify(MONTH)));
        const stop = startTraining({ fetch: fetcher as unknown as typeof fetch, url: 'https://api.example', search: '' });
        await vi.waitFor(() => expect(getTraining().status).toBe('ready'));
        expect(fetcher).toHaveBeenCalledWith('https://api.example/training/month');
        expect(getTraining().totals?.bike.km).toBe(85.12);
        stop();
    });

    it('shows made-up numbers with ?training=demo', () => {
        const fetcher = vi.fn();
        const stop = startTraining({ fetch: fetcher as unknown as typeof fetch, url: 'https://api.example', search: '?training=demo' });
        expect(getTraining().status).toBe('ready');
        expect(fetcher).not.toHaveBeenCalled();
        stop();
    });
});

describe('nextRace', () => {
    it('skips races that are done', () => {
        const next = nextRace(new Date(2026, 10, 26));
        expect(next?.race.id).toBe('rbr-rotterdam-2027');
        expect(next?.days).toBe(128);
    });

    it('still counts a race on its own day', () => {
        expect(nextRace(new Date(2027, 3, 3, 18))?.days).toBe(0);
    });

    it('is nothing once every race is done', () => {
        expect(nextRace(new Date(2030, 0, 1))).toBeNull();
    });
});

describe('daysToGo', () => {
    it('reads right for one day, many days and race day', () => {
        expect(daysToGo(0)).toBe('race day!');
        expect(daysToGo(1)).toBe('day to go');
        expect(daysToGo(30)).toBe('days to go');
    });
});
