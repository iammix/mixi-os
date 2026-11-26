import { describe, expect, it } from 'vitest';
import { bestLoopLength, findLoop, onsetEnvelope, refineLength, repeatLength } from './beatLoop';

const RATE = 22050;
const HOP = 512;

/**
 * A made-up beat: a few seconds of quiet pad, then a boom-bap pattern at `bpm` (kick on 1 and the
 * "and" of 3, snare on 2 and 4, hats on every eighth) for `bars` bars.
 */
function drums(bpm: number, bars: number, intro = 3) {
    const beat = 60 / bpm;
    const length = Math.ceil((intro + bars * 4 * beat + 1) * RATE);
    const out = new Float32Array(length);
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const hit = (time: number, kind: 'kick' | 'snare' | 'hat') => {
        const at = Math.floor(time * RATE);
        const dur = kind === 'kick' ? 0.25 : kind === 'snare' ? 0.15 : 0.04;
        for (let i = 0; i < dur * RATE && at + i < length; i++) {
            const t = i / RATE;
            const env = Math.exp(-t / (dur / 4));
            if (kind === 'kick') out[at + i] += 0.9 * env * Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-t * 30)) * t);
            if (kind === 'snare') out[at + i] += 0.5 * env * (noise() * 0.7 + 0.3 * Math.sin(2 * Math.PI * 190 * t));
            if (kind === 'hat') out[at + i] += 0.12 * env * noise();
        }
    };
    for (let i = 0; i < intro * RATE; i++) out[i] = 0.05 * Math.sin((2 * Math.PI * 220 * i) / RATE);
    for (let b = 0; b < bars; b++) {
        const bar = intro + b * 4 * beat;
        hit(bar, 'kick');
        hit(bar + 2.5 * beat, 'kick');
        hit(bar + beat, 'snare');
        hit(bar + 3 * beat, 'snare');
        for (let e = 0; e < 8; e++) hit(bar + (e * beat) / 2, 'hat');
    }
    return { samples: out, firstBar: intro, bar: 4 * beat };
}

describe('repeatLength', () => {
    for (const bpm of [66, 78, 92, 120, 133]) {
        it(`finds a whole number of bars at ${bpm} bpm`, () => {
            const { samples, bar } = drums(bpm, 40);
            const envelope = onsetEnvelope([samples], RATE, HOP);
            const length = repeatLength(envelope, HOP / RATE);
            const bars = length / bar;
            expect(Math.abs(bars - Math.round(bars)) * bar).toBeLessThan(0.02);
            expect(length).toBeGreaterThanOrEqual(5 - 0.05);
        });
    }
});

describe('refineLength', () => {
    it('lands on the exact repeat, to within a millisecond, from a rough guess', () => {
        const { samples, bar, firstBar } = drums(92, 32);
        const exact = 2 * bar;
        const refined = refineLength(samples, RATE, firstBar + 4 * bar, exact + 0.012);
        expect(Math.abs(refined - exact)).toBeLessThan(0.001);
    });
});

describe('bestLoopLength', () => {
    it('takes the whole phrase when a tune over the drums only comes round every three bars', () => {
        const { samples, bar, firstBar } = drums(92, 40);
        // A tune that changes note every bar and repeats every three.
        const notes = [220, 277, 330];
        for (let i = Math.floor(firstBar * RATE); i < samples.length; i++) {
            const n = Math.floor((i / RATE - firstBar) / bar) % 3;
            samples[i] += 0.3 * Math.sin((2 * Math.PI * notes[n] * i) / RATE);
        }
        const start = firstBar + 8 * bar;
        const { length, seam } = bestLoopLength(samples, RATE, start, bar + 0.01);
        expect(length / bar).toBeCloseTo(3, 2);
        // Not 1: the hats are random noise, different every bar.
        expect(seam).toBeGreaterThan(0.9);
    });

    it('keeps a short loop when it already joins cleanly', () => {
        const { samples, bar, firstBar } = drums(92, 40);
        expect(bestLoopLength(samples, RATE, firstBar + 8 * bar, 2 * bar).length / bar).toBeCloseTo(2, 2);
    });
});

describe('findLoop', () => {
    it('starts the loop on a downbeat, after the intro, a whole number of bars long', () => {
        const { samples, firstBar, bar } = drums(92, 32);
        const envelope = onsetEnvelope([samples], RATE, HOP);
        const loop = findLoop(envelope, HOP / RATE);
        expect(loop.bpm).toBeCloseTo(92, 0);
        const bars = loop.length / bar;
        expect(Math.abs(bars - Math.round(bars)) * bar).toBeLessThan(0.02);
        expect(loop.start).toBeGreaterThan(firstBar);
        // Within 30 ms of a bar line.
        const intoBar = (((loop.start - firstBar) % bar) + bar) % bar;
        expect(Math.min(intoBar, bar - intoBar)).toBeLessThan(0.03);
    });

    it('uses a given tempo instead of guessing', () => {
        const { samples } = drums(92, 32);
        const envelope = onsetEnvelope([samples], RATE, HOP);
        expect(findLoop(envelope, HOP / RATE, { bpm: 92, bars: 2 }).length).toBeCloseTo((2 * 4 * 60) / 92, 5);
    });
});
