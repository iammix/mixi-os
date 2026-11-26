import { describe, expect, it } from 'vitest';
import { ALBUMS } from './albums';
import { getNowPlaying, playNext, shuffled } from './musicState';

describe('shuffled', () => {
    it('keeps every item exactly once', () => {
        const items = Array.from({ length: 50 }, (_, i) => i);
        expect([...shuffled(items)].sort((a, b) => a - b)).toEqual(items);
    });

    it('leaves the original alone', () => {
        const items = [1, 2, 3];
        shuffled(items, () => 0);
        expect(items).toEqual([1, 2, 3]);
    });
});

describe('playNext', () => {
    const key = () => `${getNowPlaying().albumId}#${getNowPlaying().track}`;
    const total = ALBUMS.reduce((n, a) => n + a.tracks.length, 0);

    it('plays every track once before any comes round again', () => {
        const heard = new Set([key()]);
        for (let i = 1; i < total; i++) {
            playNext();
            expect(heard.has(key())).toBe(false);
            heard.add(key());
        }
        expect(heard.size).toBe(total);
    });

    it('never plays the same song twice in a row, even across a reshuffle', () => {
        for (let i = 0; i < total * 3; i++) {
            const before = key();
            playNext();
            expect(key()).not.toBe(before);
        }
    });
});
