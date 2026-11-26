// Plays the drum pad's loops (beats.ts) with the Web Audio API. A beat is fetched and decoded the
// first time its pad is pressed, its loop found (beatLoop), and then it loops seamlessly until the
// pad is pressed again or another pad takes over. While a loop plays the room's music is held.

import { bestLoopLength, findLoop, loopTempo, onsetEnvelope, type Loop } from './beatLoop';
import { BEATS, type Beat } from './beats';
import { holdMusic } from './musicState';

export type PadState = { playing: string | null; loading: string | null; loops: Record<string, Loop> };

const LEVEL = 0.8;
const FADE = 0.04; // seconds, so starting and stopping doesn't click
const HOP = 512;

let state: PadState = { playing: null, loading: null, loops: {} };
const listeners = new Set<() => void>();

export const getPad = () => state;

export function subscribePad(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function set(next: Partial<PadState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let current: { id: string; source: AudioBufferSourceNode; gain: GainNode; startedAt: number; loop: Loop } | null = null;

function audio() {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
}

function load(beat: Beat) {
    let buffer = buffers.get(beat.id);
    if (!buffer) {
        buffer = fetch(beat.url)
            .then((res) => res.arrayBuffer())
            .then((data) => audio().decodeAudioData(data));
        buffers.set(beat.id, buffer);
        // Let a failed download be tried again next time.
        buffer.catch(() => buffers.delete(beat.id));
    }
    return buffer;
}

/** The loop for a beat: what beats.ts pins, the rest found in the audio. */
export function loopFor(beat: Beat, buffer: AudioBuffer): Loop {
    // Pinned in beats.ts: nothing to work out.
    if (beat.start !== undefined && beat.length !== undefined) {
        return { bpm: beat.bpm ?? (16 * 60) / beat.length, start: beat.start, length: Math.min(beat.length, buffer.duration - beat.start) };
    }
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const envelope = onsetEnvelope(channels, buffer.sampleRate, HOP);
    const found = findLoop(envelope, HOP / buffer.sampleRate, { bpm: beat.bpm, bars: beat.bars });
    const start = beat.start ?? found.start;
    // Take the whole phrase and line its end up with its start to the sample (unless the tempo was
    // pinned by hand).
    let length = found.length;
    let bpm = found.bpm;
    if (!beat.bpm) {
        const mono = new Float32Array(buffer.length);
        channels.forEach((ch) => ch.forEach((v, i) => (mono[i] += v / channels.length)));
        length = bestLoopLength(mono, buffer.sampleRate, start, found.length).length;
        bpm = loopTempo(envelope, HOP / buffer.sampleRate, length);
    }
    return { bpm, start, length: Math.min(length, buffer.duration - start) };
}

function fadeOut(playing: NonNullable<typeof current>) {
    const ctx = audio();
    const at = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(at);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, at);
    playing.gain.gain.linearRampToValueAtTime(0, at + FADE);
    playing.source.stop(at + FADE + 0.01);
}

/** Stop whatever the pad is playing (and let the room's music carry on). */
export function stopPad() {
    if (current) fadeOut(current);
    current = null;
    set({ playing: null, loading: null });
    holdMusic(false);
}

/** Press a pad: play its loop, or stop it if it's the one playing. */
export async function pressPad(id: string) {
    if (state.playing === id) {
        stopPad();
        return;
    }
    const beat = BEATS.find((b) => b.id === id);
    if (!beat) return;
    const ctx = audio();
    set({ loading: id });
    let buffer: AudioBuffer;
    try {
        buffer = await load(beat);
    } catch {
        if (state.loading === id) set({ loading: null });
        return;
    }
    // Another pad was pressed while this one loaded: that one wins.
    if (state.loading !== id) return;
    const loop = state.loops[id] ?? loopFor(beat, buffer);

    if (current) fadeOut(current);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loop.start;
    source.loopEnd = loop.start + loop.length;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + FADE);
    source.connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime, loop.start);
    current = { id, source, gain, startedAt: ctx.currentTime, loop };
    holdMusic(true);
    set({ playing: id, loading: null, loops: { ...state.loops, [id]: loop } });
}

/** Where the playing loop is within its beat, 0..1 (0 right on the beat), for the lights to pulse. */
export function padBeatPhase() {
    if (!current || !context) return 0;
    const beat = 60 / current.loop.bpm;
    const t = context.currentTime - current.startedAt;
    return ((t % beat) + beat) % beat / beat;
}
