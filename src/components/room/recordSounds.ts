// The turntable's own noises, made with the Web Audio API (no sound files): the needle lifting off
// when the music stops or the record is changed, the new record landing on the platter, and the
// needle dropping into the groove when a song starts, with a little vinyl crackle that fades out
// under the music. MusicToggle plays them along with the YouTube player.

// YouTube player states (https://developers.google.com/youtube/iframe_api_reference#Playback_status).
const PLAYING = 1;
const BUFFERING = 3;

export type NeedleEvent = 'drop' | 'lift' | null;

/**
 * What the needle does when the player goes from `settled` (its last state other than buffering)
 * to `next`: it drops when playback starts and lifts when it stops. Buffering in the middle of a
 * song is neither.
 */
export function needleEvent(settled: number | null, next: number): NeedleEvent {
    if (next === BUFFERING) return null;
    if (next === PLAYING) return settled === PLAYING ? null : 'drop';
    return settled === PLAYING ? 'lift' : null;
}

/**
 * Vinyl crackle: sparse pops of random size and sign, each dying away over a few samples, on a
 * faint hiss. `density` is pops per second.
 */
export function crackleSamples(length: number, sampleRate: number, random: () => number = Math.random, density = 90) {
    const out = new Float32Array(length);
    const popChance = density / sampleRate;
    let pop = 0;
    for (let i = 0; i < length; i++) {
        if (random() < popChance) pop = (random() < 0.5 ? -1 : 1) * (0.3 + 0.7 * random() ** 2);
        out[i] = pop + (random() * 2 - 1) * 0.02;
        pop *= 0.55;
    }
    return out;
}

// How loud the record noises are, before the music's own volume (MusicToggle) is applied.
const LEVEL = 0.35;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let crackle: AudioBuffer | null = null;

/** The audio context, made the first time it's needed. */
function audio() {
    if (!context && typeof window !== 'undefined' && window.AudioContext) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = LEVEL;
        master.connect(context.destination);
        const length = context.sampleRate * 3;
        crackle = context.createBuffer(1, length, context.sampleRate);
        crackle.getChannelData(0).set(crackleSamples(length, context.sampleRate));
    }
    return context;
}

/**
 * Browsers only let pages make sound after a click or key press, so wake the audio on the first
 * one. Until then nothing plays (rather than every queued noise going off at once later).
 */
if (typeof window !== 'undefined') {
    const wake = () => {
        void audio()?.resume();
        ['pointerdown', 'keydown', 'touchend'].forEach((g) => window.removeEventListener(g, wake, true));
    };
    ['pointerdown', 'keydown', 'touchend'].forEach((g) => window.addEventListener(g, wake, true));
}

let needleQuiet = false;

/** Keep the needle drop/lift quiet: while scratching, the needle never leaves the record. */
export function quietNeedle(on: boolean) {
    needleQuiet = on;
}

/** The context if it's allowed to make sound right now. */
function ready() {
    const ctx = audio();
    return ctx && master && ctx.state === 'running' ? ctx : null;
}

/** Set how loud the noises are, 0..1 (follows the music's volume). */
export function setRecordVolume(volume: number) {
    audio();
    if (master) master.gain.value = LEVEL * Math.min(1, Math.max(0, volume));
}

/** A short burst of filtered noise: the stylus touching or leaving the vinyl. */
function tick(ctx: AudioContext, at: number, gain: number, frequency: number, length = 0.03) {
    const source = ctx.createBufferSource();
    source.buffer = crackle;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    source.connect(filter).connect(env).connect(master!);
    source.start(at, Math.random() * 2, length + 0.02);
}

/** A low, soft knock: the arm or the record coming down. */
function thump(ctx: AudioContext, at: number, gain: number, frequency: number, length: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * 1.6, at);
    osc.frequency.exponentialRampToValueAtTime(frequency, at + length * 0.5);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(master!);
    osc.start(at);
    osc.stop(at + length + 0.02);
}

/** The needle drops into the lead-in groove: a thump, a click, then crackle fading under the music. */
export function needleDrop() {
    if (needleQuiet) return;
    const ctx = ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    thump(ctx, now, 0.9, 55, 0.18);
    tick(ctx, now, 0.6, 2500);

    const source = ctx.createBufferSource();
    source.buffer = crackle;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 900;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.7, now + 0.05);
    env.gain.setValueAtTime(0.7, now + 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    source.connect(highpass).connect(lowpass).connect(env).connect(master!);
    source.start(now, Math.random(), 2.7);
}

/** The needle comes up off the record. */
export function needleLift() {
    if (needleQuiet) return;
    const ctx = ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    tick(ctx, now, 0.45, 3200, 0.025);
    tick(ctx, now + 0.05, 0.2, 1800, 0.06);
}

/** The new record settles onto the mat. */
export function recordLands() {
    const ctx = ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    thump(ctx, now, 0.5, 80, 0.12);
    tick(ctx, now, 0.15, 900, 0.05);
}

// --- Scratching a song ---
// The YouTube player's sound can't be reached to scratch it for real, so while a song is scratched
// it's paused and this plays instead: the whoosh of the record under the needle (band-passed
// noise) and the pitch of the music being dragged (a buzzy tone), both following the record's speed.

let scratchFx: { osc: OscillatorNode; noise: AudioBufferSourceNode; band: BiquadFilterNode; tone: GainNode; hiss: GainNode } | null = null;

export function startScratchSound() {
    const ctx = ready();
    if (!ctx || scratchFx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400;
    const tone = ctx.createGain();
    tone.gain.value = 0;
    osc.connect(lowpass).connect(tone).connect(master!);

    const noise = ctx.createBufferSource();
    noise.buffer = crackle;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.value = 900;
    const hiss = ctx.createGain();
    hiss.gain.value = 0;
    noise.connect(band).connect(hiss).connect(master!);

    osc.start(now);
    noise.start(now);
    scratchFx = { osc, noise, band, tone, hiss };
}

/** The record's speed under the hand: 1 = normal, 0 = still, negative = backwards. */
export function scratchSound(speed: number) {
    const ctx = context;
    if (!ctx || !scratchFx) return;
    const now = ctx.currentTime;
    const s = Math.min(4, Math.abs(speed));
    scratchFx.osc.frequency.setTargetAtTime(35 + 110 * s, now, 0.01);
    scratchFx.band.frequency.setTargetAtTime(500 + 1600 * s, now, 0.01);
    scratchFx.tone.gain.setTargetAtTime(Math.min(0.5, 0.3 * s), now, 0.01);
    scratchFx.hiss.gain.setTargetAtTime(Math.min(0.9, 0.5 * s), now, 0.01);
}

export function stopScratchSound() {
    const ctx = context;
    if (!ctx || !scratchFx) return;
    const { osc, noise, tone, hiss } = scratchFx;
    const now = ctx.currentTime;
    tone.gain.setTargetAtTime(0, now, 0.02);
    hiss.gain.setTargetAtTime(0, now, 0.02);
    osc.stop(now + 0.2);
    noise.stop(now + 0.2);
    scratchFx = null;
}
