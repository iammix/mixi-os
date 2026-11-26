// Scratching the record on the turntable: grab it and turn it by hand. ScratchControl turns the
// pointer into turns of the record; the record's animation (RoomAnimations) shows them; the sound
// follows: a drum pad loop is really scratched (padPlayer), a song from the YouTube player pauses
// under a scratch sound and then jumps on or back by as far as the record was turned (MusicToggle).

/** A record at 33⅓ rpm: one turn is this many seconds of audio. */
export const SECONDS_PER_TURN = 60 / (100 / 3);

/** The shortest signed turn from angle a to angle b (radians). */
export const angleBetween = (a: number, b: number) => {
    const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI);
    return d - Math.PI;
};

/** Seconds of audio for a turn of the record (radians, clockwise from above = forwards). */
export const secondsFor = (turn: number) => (turn / (2 * Math.PI)) * SECONDS_PER_TURN;

export type ScratchEvent =
    | { type: 'start' }
    /** The record's speed under the hand: 1 = normal, 0 = held still, negative = backwards. */
    | { type: 'move'; speed: number; seconds: number }
    /** Let go: `seconds` is how far the record was moved in all (beyond where it would have played to). */
    | { type: 'end'; seconds: number };

let grabbed = false;
let active = false;
let pending = 0;
let moved = 0;
let speed = 0;
const listeners = new Set<(e: ScratchEvent) => void>();

export const isScratching = () => active;

/** A hand is on the record (pressed, maybe not moving yet): the room shouldn't turn under it. */
export const isRecordGrabbed = () => grabbed;
export const setRecordGrabbed = (on: boolean) => {
    grabbed = on;
};

/** The record's current speed under the hand (for the speakers to react to). */
export const scratchSpeed = () => (active ? speed : 0);

export function subscribeScratch(listener: (e: ScratchEvent) => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const emit = (e: ScratchEvent) => listeners.forEach((l) => l(e));

export function startScratch() {
    if (active) return;
    active = true;
    pending = 0;
    moved = 0;
    speed = 0;
    emit({ type: 'start' });
}

/** The hand turned the record by `turn` radians (clockwise = forwards) over `dt` seconds. */
export function scratchBy(turn: number, dt: number) {
    if (!active) return;
    pending += turn;
    const seconds = secondsFor(turn);
    moved += seconds;
    // Pointer moves don't line up with frames, so smooth the speed a little to keep it from stuttering.
    const raw = dt > 0 ? seconds / dt : 0;
    speed += (raw - speed) * 0.6;
    emit({ type: 'move', speed, seconds });
}

export function endScratch() {
    if (!active) return;
    active = false;
    speed = 0;
    emit({ type: 'end', seconds: moved });
}

/** How far the hand has turned the record since last asked (radians), for the animation to apply. */
export function takeTurn() {
    const t = pending;
    pending = 0;
    return t;
}
