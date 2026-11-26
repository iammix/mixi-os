// The deck (deck.ts) on the audio thread. padPlayer loads this with `?worker&url`, so Vite bundles
// it into one script the AudioWorklet can run.
//
// Started with processorOptions { channels, loopStart, loopEnd, start } (samples); takes DeckMessages
// on its port and reports where the stylus is (in samples) about thirty times a second.

import { Deck, type DeckMessage } from './deck';

// The AudioWorklet global scope, which TypeScript's DOM types don't describe.
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor(options?: unknown);
}

type Options = { processorOptions: { channels: Float32Array[]; loopStart: number; loopEnd: number; start: number } };

class DeckProcessor extends AudioWorkletProcessor {
    private deck: Deck;
    private sinceReport = 0;

    constructor(options: Options) {
        super();
        const { channels, loopStart, loopEnd, start } = options.processorOptions;
        this.deck = new Deck(channels, sampleRate, loopStart, loopEnd, start);
        this.port.onmessage = (e: MessageEvent<DeckMessage>) => this.deck.handle(e.data);
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
        const out = outputs[0];
        this.deck.process(out, out[0].length);
        this.sinceReport += out[0].length;
        if (this.sinceReport >= sampleRate / 30) {
            this.sinceReport = 0;
            this.port.postMessage(this.deck.position);
        }
        return true;
    }
}

registerProcessor('deck', DeckProcessor);
