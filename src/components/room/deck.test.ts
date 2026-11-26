import { describe, expect, it } from 'vitest';
import { Deck } from './deck';
import { SECONDS_PER_TURN, angleBetween, endScratch, scratchBy, secondsFor, startScratch, subscribeScratch, takeTurn } from './scratch';

const RATE = 1000;
// A ramp, so a sample's value tells you where in the audio it came from.
const ramp = () => [Float32Array.from({ length: 2000 }, (_, i) => i)];
const run = (deck: Deck, frames: number) => {
    const out = [new Float32Array(frames)];
    deck.process(out, frames);
    return out[0];
};

describe('Deck', () => {
    it('plays at normal speed under the motor', () => {
        const deck = new Deck(ramp(), RATE, 100, 1100, 100);
        const out = run(deck, 10);
        expect(Array.from(out)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
    });

    it('goes round the loop', () => {
        const deck = new Deck(ramp(), RATE, 100, 200, 195);
        const out = run(deck, 10);
        expect(out[4]).toBe(199);
        expect(out[5]).toBe(100);
        expect(deck.position).toBe(105);
    });

    it('stops dead under a still hand, and plays backwards when pulled back', () => {
        const deck = new Deck(ramp(), RATE, 0, 2000, 1000);
        deck.handle({ type: 'hand', speed: 0 });
        run(deck, 200);
        const held = deck.position;
        run(deck, 100);
        expect(Math.abs(deck.position - held)).toBeLessThan(0.01);

        deck.handle({ type: 'hand', speed: -2 });
        run(deck, 200);
        expect(deck.position).toBeLessThan(held - 250);
        expect(deck.speed).toBeCloseTo(-2, 1);
    });

    it('wraps backwards round the loop too', () => {
        const deck = new Deck(ramp(), RATE, 100, 200, 102, -1);
        deck.handle({ type: 'hand', speed: -1 });
        run(deck, 5);
        expect(deck.position).toBe(197);
    });

    it('comes back up to speed when let go, smoothly', () => {
        const deck = new Deck(ramp(), RATE, 0, 2000, 500, 0);
        deck.handle({ type: 'hand', speed: 0 });
        deck.handle({ type: 'release' });
        run(deck, 30);
        expect(deck.speed).toBeGreaterThan(0.05);
        expect(deck.speed).toBeLessThan(0.5);
        run(deck, 1000);
        expect(deck.speed).toBeCloseTo(1, 2);
    });
});

describe('scratch', () => {
    it('a whole turn of the record is 1.8 seconds at 33⅓', () => {
        expect(SECONDS_PER_TURN).toBeCloseTo(1.8, 5);
        expect(secondsFor(2 * Math.PI)).toBeCloseTo(1.8, 5);
        expect(secondsFor(-Math.PI)).toBeCloseTo(-0.9, 5);
    });

    it('measures the short way round between two angles', () => {
        expect(angleBetween(0.1, -0.1)).toBeCloseTo(-0.2);
        expect(angleBetween(3.1, -3.1)).toBeCloseTo(2 * Math.PI - 6.2);
    });

    it('settles on the speed of a steady hand', () => {
        const speeds: number[] = [];
        const stop = subscribeScratch((e) => e.type === 'move' && speeds.push(e.speed));
        startScratch();
        for (let i = 0; i < 10; i++) scratchBy((2 * Math.PI) / 60, 1 / 60); // a turn a second, steadily
        endScratch();
        stop();
        expect(speeds[speeds.length - 1]).toBeCloseTo(1.8, 2);
    });

    it('tells listeners how fast the record moves and how far it went in all', () => {
        const events: unknown[] = [];
        const stop = subscribeScratch((e) => events.push(e));
        startScratch();
        scratchBy(Math.PI, 0.5); // half a turn forwards in half a second: 0.9 s of audio at 1.8x
        scratchBy(-Math.PI / 2, 0.25); // a quarter back
        expect(takeTurn()).toBeCloseTo(Math.PI / 2);
        expect(takeTurn()).toBe(0);
        endScratch();
        stop();
        expect(events[0]).toEqual({ type: 'start' });
        // Smoothed: the first move gets most of the way to 1.8x, the pull back swings it backwards.
        expect((events[1] as { speed: number }).speed).toBeCloseTo(1.08);
        expect((events[2] as { speed: number }).speed).toBeLessThan(-0.5);
        expect((events[3] as { seconds: number }).seconds).toBeCloseTo(0.45);
    });
});
