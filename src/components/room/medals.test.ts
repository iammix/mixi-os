import { describe, expect, it } from 'vitest';
import { engraving, finishedRaces, hangMedals, medalRaceId } from './medals';
import type { Race } from './races';

const race = (id: string, date: string): Race => ({ id, name: id, date, location: 'x', kind: 'x' });
const NOW = new Date(2026, 10, 26);

describe('finishedRaces', () => {
    it('only races before today get medals, in date order', () => {
        const rs = [race('b', '2026-06-01'), race('future', '2027-04-03'), race('a', '2026-04-04'), race('today', '2026-11-26')];
        expect(finishedRaces(rs, NOW).map((r) => r.id)).toEqual(['a', 'b']);
    });
});

describe('hangMedals', () => {
    it('one medal per hook, left to right', () => {
        expect(hangMedals([race('a', '2026-01-01'), race('b', '2026-02-01')], 6).map((m) => [m.hook, m.stack])).toEqual([
            [0, 0],
            [1, 0],
        ]);
    });

    it('extra medals stack on the last hook', () => {
        const rs = ['a', 'b', 'c', 'd'].map((id, i) => race(id, `2026-0${i + 1}-01`));
        expect(hangMedals(rs, 2).map((m) => [m.hook, m.stack])).toEqual([
            [0, 0],
            [1, 0],
            [1, 1],
            [1, 2],
        ]);
    });

    it('no hooks, no medals', () => expect(hangMedals([race('a', '2026-01-01')], 0)).toEqual([]));
});

describe('engraving', () => {
    it('engraves the name and the year', () =>
        expect(engraving(race('L’Étape Greece', '2026-04-04'))).toEqual({ title: 'L’Étape Greece', year: '2026' }));
});

describe('medalRaceId', () => {
    it('reads the race id back from a medal object name', () => {
        expect(medalRaceId('Medal_letape-greece-2026')).toBe('letape-greece-2026');
        expect(medalRaceId('Medal_hook_00')).toBeNull();
        expect(medalRaceId('Medal_hanger_bar')).toBeNull();
        expect(medalRaceId('Medal_hanger')).toBeNull();
        expect(medalRaceId('Triathlon_bag')).toBeNull();
    });
});
