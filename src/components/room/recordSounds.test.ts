import { describe, expect, it } from 'vitest';
import { crackleSamples, needleEvent } from './recordSounds';

const UNSTARTED = -1, ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5;

describe('needleEvent', () => {
    it('drops the needle when playback starts, from anything but playing', () => {
        expect(needleEvent(null, PLAYING)).toBe('drop');
        expect(needleEvent(UNSTARTED, PLAYING)).toBe('drop');
        expect(needleEvent(PAUSED, PLAYING)).toBe('drop');
        expect(needleEvent(ENDED, PLAYING)).toBe('drop');
        expect(needleEvent(CUED, PLAYING)).toBe('drop');
    });

    it('lifts it when playback stops', () => {
        expect(needleEvent(PLAYING, PAUSED)).toBe('lift');
        expect(needleEvent(PLAYING, ENDED)).toBe('lift');
    });

    it('does nothing for buffering mid-song, or a stop when nothing was playing', () => {
        expect(needleEvent(PLAYING, BUFFERING)).toBeNull();
        expect(needleEvent(PLAYING, PLAYING)).toBeNull();
        expect(needleEvent(PAUSED, ENDED)).toBeNull();
        expect(needleEvent(null, CUED)).toBeNull();
    });
});

describe('crackleSamples', () => {
    // A small seeded random so the test is the same every run.
    const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    it('stays within -1..1', () => {
        const samples = crackleSamples(48000, 48000, seeded(1));
        expect(Math.max(...samples)).toBeLessThanOrEqual(1.05);
        expect(Math.min(...samples)).toBeGreaterThanOrEqual(-1.05);
    });

    it('is mostly quiet hiss with pops now and then', () => {
        const samples = crackleSamples(48000, 48000, seeded(2), 90);
        const pops = samples.filter((s) => Math.abs(s) > 0.25).length;
        // About 90 pops in a second, each loud for a sample or two.
        expect(pops).toBeGreaterThan(40);
        expect(pops).toBeLessThan(400);
        const quiet = samples.filter((s) => Math.abs(s) < 0.03).length;
        expect(quiet / samples.length).toBeGreaterThan(0.9);
    });
});
