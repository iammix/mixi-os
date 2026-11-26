// A virtual turntable for a loop of audio: it plays at whatever speed the record is going, forwards,
// backwards or stood still, the way a stylus reads a groove. Normally the motor holds it at full
// speed; while a hand is on the record its speed follows the hand, and when the hand lets go the
// motor brings it back up to speed. Runs on the audio thread (deck.worklet.ts); kept free of Web
// Audio so it can be tested.

export type DeckMessage =
    | { type: 'hand'; speed: number } // a hand on the record, moving it at `speed` (1 = normal)
    | { type: 'release' }; // the hand lets go: the motor takes over

/** How quickly the record follows the hand (seconds): quick, but smooth enough not to crackle. */
const HAND_RESPONSE = 0.012;
/** How long the motor takes to get the record back up to speed (seconds). */
const MOTOR_RESPONSE = 0.18;

export class Deck {
    /** Where in the audio the stylus is, in samples (fractional). */
    position: number;
    /** How fast the record is going: 1 is normal, 0 stood still, negative backwards. */
    speed: number;
    private target = 1;
    private response = MOTOR_RESPONSE;

    constructor(
        private channels: Float32Array[],
        private sampleRate: number,
        private loopStart: number,
        private loopEnd: number,
        start = loopStart,
        speed = 1,
    ) {
        this.position = start;
        this.speed = speed;
    }

    handle(message: DeckMessage) {
        if (message.type === 'hand') {
            this.target = message.speed;
            this.response = HAND_RESPONSE;
        } else {
            this.target = 1;
            this.response = MOTOR_RESPONSE;
        }
    }

    /** Keep a position inside the loop, going round in either direction. */
    private wrap(p: number) {
        const length = this.loopEnd - this.loopStart;
        return this.loopStart + ((((p - this.loopStart) % length) + length) % length);
    }

    /** The sound at a position, between samples by straight-line interpolation, wrapping round the loop. */
    private read(channel: Float32Array, p: number) {
        const i = Math.floor(p);
        const f = p - i;
        const a = channel[i] ?? 0;
        const next = i + 1 >= this.loopEnd ? this.loopStart : i + 1;
        return a + ((channel[next] ?? 0) - a) * f;
    }

    /** Fill `out` (one array per output channel) with the next `frames` samples. */
    process(out: Float32Array[], frames: number) {
        const ease = 1 - Math.exp(-1 / (this.response * this.sampleRate));
        for (let n = 0; n < frames; n++) {
            this.speed += (this.target - this.speed) * ease;
            for (let c = 0; c < out.length; c++) {
                const source = this.channels[Math.min(c, this.channels.length - 1)];
                out[c][n] = this.read(source, this.position);
            }
            this.position = this.wrap(this.position + this.speed);
        }
    }
}
