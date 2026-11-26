// Finds a loop in a beat: a stretch that repeats cleanly, starting on a downbeat. Used by the drum
// pad (padPlayer) on the decoded audio, so any beat can go on a pad without hand-marking.
//
// Beats are built from loops, so rather than guess the tempo (easily fooled by swing or half-time)
// it measures how long the music takes to repeat itself: it listens for hits (sudden rises in
// loudness, weighted towards the low end where kicks and snares live) and finds the gap after which
// they line up again. Then it finds where the bars start, picks the busiest stretch from the body
// of the track, and fine-tunes the length to the sample against the audio itself.

/** How loud the music suddenly gets, every `hop` samples: high at each hit, near zero between. */
export function onsetEnvelope(channels: Float32Array[], sampleRate: number, hop = 512) {
    const length = channels[0]?.length ?? 0;
    const frames = Math.floor(length / hop);
    const energy = new Float32Array(frames);
    // A gentle low-pass so kicks and snares count for more than hi-hats and vocals.
    const a = Math.exp((-2 * Math.PI * 300) / sampleRate);
    let low = 0;
    for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let i = f * hop; i < (f + 1) * hop; i++) {
            let s = 0;
            for (const ch of channels) s += ch[i];
            s /= channels.length;
            low = a * low + (1 - a) * s;
            sum += low * low + 0.25 * s * s;
        }
        energy[f] = Math.sqrt(sum / hop);
    }
    const out = new Float32Array(frames);
    for (let f = 1; f < frames; f++) out[f] = Math.max(0, energy[f] - energy[f - 1]);
    return out;
}

/** Total of the envelope at times start, start + step, start + 2 step... (linear interpolation). */
function combSum(envelope: Float32Array, hopSeconds: number, start: number, step: number) {
    let sum = 0;
    for (let t = start; t / hopSeconds < envelope.length - 1; t += step) {
        const x = t / hopSeconds;
        const i = Math.floor(x);
        sum += envelope[i] * (1 - (x - i)) + envelope[i + 1] * (x - i);
    }
    return sum;
}

/**
 * How long until the music repeats itself, in seconds, between `min` and `max`: beats are built
 * from loops, so the hits line up again after every loop. Where a short loop repeats inside a
 * longer one, the shortest that repeats about as well as the best is taken. Measured over the body
 * of the track (`from`..`to`, fractions of it).
 */
export function repeatLength(envelope: Float32Array, hopSeconds: number, opts: { min?: number; max?: number; from?: number; to?: number } = {}) {
    const min = Math.round((opts.min ?? 5) / hopSeconds);
    const max = Math.round((opts.max ?? 17) / hopSeconds);
    const a = Math.floor((opts.from ?? 0.1) * envelope.length);
    const b = Math.floor((opts.to ?? 0.9) * envelope.length);
    let mean = 0;
    for (let i = a; i < b; i++) mean += envelope[i];
    mean /= Math.max(1, b - a);
    const r = new Float32Array(max + 2);
    for (let lag = min - 1; lag <= max + 1; lag++) {
        let xy = 0, xx = 0, yy = 0;
        for (let i = a; i + lag < b; i++) {
            const x = envelope[i] - mean;
            const y = envelope[i + lag] - mean;
            xy += x * y;
            xx += x * x;
            yy += y * y;
        }
        r[lag] = xx && yy ? xy / Math.sqrt(xx * yy) : 0;
    }
    let best = 0;
    for (let lag = min; lag <= max; lag++) best = Math.max(best, r[lag]);
    let pick = min;
    for (let lag = min; lag <= max; lag++) {
        if (r[lag] >= 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
            pick = lag;
            break;
        }
    }
    // Between frames: the peak of a parabola through the pick and its neighbours.
    const [y0, y1, y2] = [r[pick - 1], r[pick], r[pick + 1]];
    const denom = y0 - 2 * y1 + y2;
    const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0;
    return (pick + shift) * hopSeconds;
}

/**
 * Fine-tune a loop's length to the sample, so it joins up without a hiccup: the length within
 * ±`search` seconds at which the audio after the loop best matches the audio at its start.
 */
export function refineLength(mono: Float32Array, sampleRate: number, start: number, length: number, search = 0.03) {
    // Work at about 4 kHz: plenty to line up hits, and quick.
    const factor = Math.max(1, Math.floor(sampleRate / 4000));
    const rate = sampleRate / factor;
    const down = new Float32Array(Math.floor(mono.length / factor));
    for (let i = 0; i < down.length; i++) {
        let s = 0;
        for (let k = 0; k < factor; k++) s += mono[i * factor + k];
        down[i] = s / factor;
    }
    const window = Math.floor(3 * rate);
    const s0 = Math.floor(start * rate);
    const base = Math.round(length * rate);
    const reach = Math.ceil(search * rate);
    let bestLag = base;
    let best = -Infinity;
    for (let lag = base - reach; lag <= base + reach; lag++) {
        if (s0 + lag + window >= down.length) break;
        let xy = 0, yy = 0;
        for (let i = 0; i < window; i++) {
            const y = down[s0 + lag + i];
            xy += down[s0 + i] * y;
            yy += y * y;
        }
        const score = yy ? xy / Math.sqrt(yy) : 0;
        if (score > best) {
            best = score;
            bestLag = lag;
        }
    }
    return bestLag / rate;
}

/**
 * How cleanly a loop joins: how alike the audio is just after its end and just after its start
 * (correlation, 1 = the same).
 */
export function seamScore(mono: Float32Array, sampleRate: number, start: number, length: number, window = 0.75) {
    const a = Math.floor(start * sampleRate);
    const b = Math.floor((start + length) * sampleRate);
    const n = Math.min(Math.floor(window * sampleRate), mono.length - b);
    if (n <= 0) return -1;
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < n; i++) {
        xy += mono[a + i] * mono[b + i];
        xx += mono[a + i] ** 2;
        yy += mono[b + i] ** 2;
    }
    return xx && yy ? xy / Math.sqrt(xx * yy) : -1;
}

/**
 * The drums can repeat sooner than the whole phrase (a melody over three or four drum loops, say),
 * so try whole multiples of a loop, each fine-tuned, and keep the shortest that joins about as
 * cleanly as the best. Returns the length and how cleanly it joins.
 */
export function bestLoopLength(mono: Float32Array, sampleRate: number, start: number, length: number, maxLength = 26) {
    const duration = mono.length / sampleRate;
    const options: { length: number; seam: number }[] = [];
    for (let k = 1; k <= 4 && k * length <= maxLength && start + k * length + 1 < duration; k++) {
        const refined = refineLength(mono, sampleRate, start, k * length);
        options.push({ length: refined, seam: seamScore(mono, sampleRate, start, refined) });
    }
    if (!options.length) return { length, seam: -1 };
    const best = Math.max(...options.map((o) => o.seam));
    return options.find((o) => o.seam >= best - 0.03)!;
}

/** How well a beat every `step` seconds lines up with the hits, at its best offset (mean per beat). */
function grid(envelope: Float32Array, hopSeconds: number, step: number, phases = 24) {
    const count = Math.floor(((envelope.length - 1) * hopSeconds) / step);
    let best = 0;
    for (let k = 0; k < phases; k++) best = Math.max(best, combSum(envelope, hopSeconds, (k / phases) * step, step));
    return best / Math.max(1, count);
}

/**
 * The tempo of a loop `length` seconds long: it holds a whole number of beats, so try each count
 * that gives a tempo between `min` and `max` and keep the one whose beats (and the eighth notes
 * between them) land on the most hits.
 */
export function loopTempo(envelope: Float32Array, hopSeconds: number, length: number, min = 70, max = 140) {
    let bestBpm = (16 * 60) / length;
    let best = -1;
    for (let beats = 2; beats <= 96; beats++) {
        const bpm = (beats * 60) / length;
        if (bpm < min || bpm >= max) continue;
        const s = grid(envelope, hopSeconds, 60 / bpm) + 0.5 * grid(envelope, hopSeconds, 30 / bpm);
        if (s > best) {
            best = s;
            bestBpm = bpm;
        }
    }
    return bestBpm;
}

export type Loop = { bpm: number; start: number; length: number };

/**
 * A loop: where it starts (on a downbeat) and how long it is, in seconds, plus its tempo (for the
 * lights). Without a `bpm` the length is how long the music takes to repeat itself; with one it's
 * `bars` bars of 4 beats. It's taken from between `from` and `to` (fractions of the track), where
 * the most is going on.
 */
export function findLoop(envelope: Float32Array, hopSeconds: number, opts: { bars?: number; bpm?: number; from?: number; to?: number } = {}): Loop {
    const length = opts.bpm ? ((opts.bars ?? 4) * 4 * 60) / opts.bpm : repeatLength(envelope, hopSeconds);
    const bpm = opts.bpm ?? loopTempo(envelope, hopSeconds, length);
    const beat = 60 / bpm;
    const bar = beat * 4;
    const duration = envelope.length * hopSeconds;

    // Where the beats fall: the offset (within one beat) that lands on the most hits.
    const steps = 48;
    let beatPhase = 0;
    let best = -1;
    for (let k = 0; k < steps; k++) {
        const s = combSum(envelope, hopSeconds, (k / steps) * beat, beat);
        if (s > best) {
            best = s;
            beatPhase = (k / steps) * beat;
        }
    }
    // Which of the four beats starts the bar: the one with the biggest hits (usually the kick on 1).
    let barPhase = beatPhase;
    best = -1;
    for (let k = 0; k < 4; k++) {
        const s = combSum(envelope, hopSeconds, beatPhase + k * beat, bar);
        if (s > best) {
            best = s;
            barPhase = beatPhase + k * beat;
        }
    }

    // The busiest stretch starting on a bar line in the body of the track.
    const from = (opts.from ?? 0.15) * duration;
    const to = Math.min((opts.to ?? 0.75) * duration, duration - length);
    let start = barPhase;
    best = -1;
    for (let t = barPhase; t <= to; t += bar) {
        if (t < from) continue;
        let s = 0;
        for (let f = Math.floor(t / hopSeconds); f < Math.floor((t + length) / hopSeconds); f++) s += envelope[f];
        if (s > best) {
            best = s;
            start = t;
        }
    }
    return { bpm, start, length };
}
