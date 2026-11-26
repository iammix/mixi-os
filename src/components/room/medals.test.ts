import { describe, expect, it } from 'vitest';
import { engraving, finishedRaces, fitEngraving, hangMedals, medalRaceId } from './medals';
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

describe('fitEngraving', () => {
    // A rough stand-in for canvas measureText: every character is 0.7 of the font size wide.
    const measure = (text: string, size: number) => text.length * size * 0.7;

    it('shrinks a long name until it fits on three lines, keeping every word', () => {
        const fit = fitEngraving('L’ÉTAPE GREECE BY TOUR DE FRANCE', measure, 330, 3, [52, 44, 38, 32]);
        expect(fit.lines.length).toBeLessThanOrEqual(3);
        expect(fit.lines.join(' ')).toBe('L’ÉTAPE GREECE BY TOUR DE FRANCE');
        expect(fit.size).toBeLessThan(52);
    });

    it('keeps the biggest size for a short name', () => {
        expect(fitEngraving('RBR ROTTERDAM', measure, 330, 3, [52, 44])).toEqual({ size: 52, lines: ['RBR', 'ROTTERDAM'] });
    });

    it('cuts off with an ellipsis only when even the smallest size is too long', () => {
        const fit = fitEngraving('A B C D E F G H I J K L M N O P Q R S T U V W X Y Z AA BB CC', measure, 40, 3, [52, 32]);
        expect(fit.size).toBe(32);
        expect(fit.lines).toHaveLength(3);
        expect(fit.lines[2].endsWith('…')).toBe(true);
    });
});
