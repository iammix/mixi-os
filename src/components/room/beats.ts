// The beats on the drum pad by the turntable (see DrumPad): MixVirus Beats, the same ones as on the
// music page. Pads are numbered as on the device, seen from the room: 1 front-left, 2 front-right,
// 3 back-left, 4 back-right.
//
// Each pad loops one phrase from its beat: `start` and `length` in seconds, found with beatLoop and
// checked to join cleanly (the end flows back into the start); `bpm` pulses the lights. A beat
// added without them gets its loop found from the audio when its pad is first pressed.

import ainta from '../../assets/audio/Ainta.mp3';
import eeeeeii from '../../assets/audio/Eeeeeii.mp3';
import goodness from '../../assets/audio/Goodness.mp3';
import itsMixvirus from '../../assets/audio/ItsMixvirus.wav';

export type Beat = {
    id: string;
    title: string;
    year: number;
    url: string;
    /** The pad's light. */
    color: string;
    bpm?: number;
    /** Where the loop starts, seconds into the track (on a downbeat). */
    start?: number;
    /** How long the loop is, in seconds. */
    length?: number;
    /** With only `bpm` given: how many bars to loop (4 unless set). */
    bars?: number;
};

export const BEATS: Beat[] = [
    { id: 'raw-vibes', title: 'Raw Vibes', year: 2013, url: ainta, color: '#ff9a3c', bpm: 81.4, start: 45.246, length: 17.693 },
    { id: 'ei', title: 'Ei', year: 2013, url: eeeeeii, color: '#ff4d5e', bpm: 66.5, start: 33.457, length: 7.2181 },
    { id: 'elevate', title: 'Elevate', year: 2017, url: itsMixvirus, color: '#3cc8ff', bpm: 75, start: 27.674, length: 6.4 },
    { id: 'goodness', title: 'Goodness', year: 2018, url: goodness, color: '#5be07a', bpm: 86.5, start: 13.181, length: 5.5509 },
];

/** The drum pad's root in the model: clicking any part of it opens the pad. */
export const isDrumPad = (name: string) => name === 'Drum_pad';
