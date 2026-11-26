// Plays the drum pad's loops (beats.ts) with the Web Audio API. A beat is fetched and decoded the
// first time its pad is pressed, its loop found (beatLoop), and then it loops seamlessly until the
// pad is pressed again or another pad takes over. While a loop plays the room's music is held.
//
// The loop plays on a deck (deck.ts, on the audio thread), like a record on the turntable, so it
// can be scratched: grab the record (scratch.ts) and the loop follows the hand.

import { bestLoopLength, findLoop, loopTempo, onsetEnvelope, type Loop } from './beatLoop';
import { BEATS, type Beat } from './beats';
import deckUrl from './deck.worklet.ts?worker&url';
import { holdMusic } from './musicState';
import { subscribeScratch } from './scratch';

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
let current: { id: string; deck: AudioWorkletNode; gain: GainNode; loop: Loop; sampleRate: number; position: number } | null = null;
let worklet: Promise<void> | null = null;

function audio() {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
}

/** Load the deck onto the audio thread, once. */
function deckReady(ctx: AudioContext) {
    worklet ??= ctx.audioWorklet.addModule(deckUrl);
    return worklet;
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
    const { deck, gain } = playing;
    setTimeout(() => {
        deck.disconnect();
        gain.disconnect();
    }, (FADE + 0.05) * 1000);
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
        [buffer] = await Promise.all([load(beat), deckReady(ctx)]);
    } catch {
        if (state.loading === id) set({ loading: null });
        return;
    }
    // Another pad was pressed while this one loaded: that one wins.
    if (state.loading !== id) return;
    const loop = state.loops[id] ?? loopFor(beat, buffer);

    if (current) fadeOut(current);
    // Only the loop goes to the deck: a few seconds of audio rather than the whole track.
    const from = Math.floor(loop.start * buffer.sampleRate);
    const to = Math.min(buffer.length, Math.floor((loop.start + loop.length) * buffer.sampleRate));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i).slice(from, to));
    const deck = new AudioWorkletNode(ctx, 'deck', {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: { channels, loopStart: 0, loopEnd: to - from, start: 0 },
    });
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + FADE);
    deck.connect(gain).connect(ctx.destination);
    const playing = { id, deck, gain, loop, sampleRate: buffer.sampleRate, position: 0 };
    deck.port.onmessage = (e: MessageEvent<number>) => (playing.position = e.data);
    current = playing;
    holdMusic(true);
    set({ playing: id, loading: null, loops: { ...state.loops, [id]: loop } });
}

/** Where the deck is in the playing loop, in seconds (null when nothing's playing). */
export const padPosition = () => (current ? current.position / current.sampleRate : null);

/** Where the playing loop is within its beat, 0..1 (0 right on the beat), for the lights to pulse. */
export function padBeatPhase() {
    if (!current) return 0;
    const beat = 60 / current.loop.bpm;
    const t = current.position / current.sampleRate;
    return ((t % beat) + beat) % beat / beat;
}

// Scratching: while a loop plays, the hand on the record moves the deck.
subscribeScratch((e) => {
    if (!current) return;
    if (e.type === 'start') current.deck.port.postMessage({ type: 'hand', speed: 0 });
    else if (e.type === 'move') current.deck.port.postMessage({ type: 'hand', speed: e.speed });
    else current.deck.port.postMessage({ type: 'release' });
});
