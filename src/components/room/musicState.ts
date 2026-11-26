// The YouTube player lives in the DOM while the record player animates inside the canvas, so the
// player registers itself here and the animation reads its state every frame. This also holds which
// record is on the turntable and which track is playing, so the tracklist, the player and the
// animation agree.
import { ALBUMS, Album } from './albums';

type MusicSource = {
    getPlayerState: () => number;
    getCurrentTime: () => number;
    getDuration: () => number;
};

const PLAYING = 1;

let source: MusicSource | null = null;

export function registerMusicSource(player: MusicSource | null) {
    source = player;
}

export function isMusicPlaying(): boolean {
    return source?.getPlayerState() === PLAYING;
}

/** Seconds into the song. */
export function musicTime(): number {
    return source?.getCurrentTime() ?? 0;
}

/** How far through the song we are, 0..1. */
export function musicProgress(): number {
    const duration = source?.getDuration() ?? 0;
    return duration > 0 ? Math.min(1, musicTime() / duration) : 0;
}

// --- What's on the turntable ---

export type NowPlaying = {
    albumId: string;
    track: number;
    /** performance.now() when the last record change started, so the animation and audio stay in step. */
    swapStartedAt: number;
};

/** How long changing the record takes, in seconds: arm off, old record out, new record on. */
export const SWAP_SECONDS = 2.8;

// The room starts on Isaiah Rashad - SAME SH!T.
let nowPlaying: NowPlaying = { albumId: 'its-been-awful', track: 2, swapStartedAt: -Infinity };
const listeners = new Set<() => void>();

export const getNowPlaying = () => nowPlaying;

export function subscribeNowPlaying(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export const albumOf = (state: NowPlaying): Album => ALBUMS.find((a) => a.id === state.albumId) ?? ALBUMS[0];

/** Play a track; picking one from a different album changes the record on the turntable first. */
export function playTrack(albumId: string, track: number) {
    const swap = albumId !== nowPlaying.albumId;
    nowPlaying = { albumId, track, swapStartedAt: swap ? performance.now() : nowPlaying.swapStartedAt };
    listeners.forEach((l) => l());
}

/** Seconds since the current record change started (Infinity if there hasn't been one). */
export function secondsSinceSwap(): number {
    return (performance.now() - nowPlaying.swapStartedAt) / 1000;
}

export const isSwapping = () => secondsSinceSwap() < SWAP_SECONDS;
