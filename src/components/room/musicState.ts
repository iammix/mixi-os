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

// --- Holding the music ---
// While the drum pad plays a loop the room's music stops, and picks up again when the pad stops
// (if it was playing). MusicToggle does the pausing and resuming.

let held = false;
const holdListeners = new Set<() => void>();

export const isMusicHeld = () => held;

export function holdMusic(hold: boolean) {
    if (hold === held) return;
    held = hold;
    holdListeners.forEach((l) => l());
}

export function subscribeMusicHold(listener: () => void) {
    holdListeners.add(listener);
    return () => {
        holdListeners.delete(listener);
    };
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

// --- Shuffle ---
// The room plays every track on every record in a shuffled order, a different one each visit, and
// only goes round again once it has played them all.

export type TrackRef = { albumId: string; track: number };

/** A shuffled copy of `items` (Fisher–Yates). */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

const allTracks = (): TrackRef[] => ALBUMS.flatMap((a) => a.tracks.map((_, track) => ({ albumId: a.id, track })));

let queue: TrackRef[] = shuffled(allTracks());

/** The next track in the shuffle, never the one that's playing; reshuffles once all have played. */
function nextInShuffle(current: TrackRef): TrackRef {
    const same = (t: TrackRef) => t.albumId === current.albumId && t.track === current.track;
    queue = queue.filter((t) => !same(t));
    if (queue.length === 0) queue = shuffled(allTracks().filter((t) => !same(t)));
    return queue.shift() ?? current;
}

let nowPlaying: NowPlaying = { ...(queue.shift() ?? { albumId: ALBUMS[0].id, track: 0 }), swapStartedAt: -Infinity };
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

/** A song has finished: play the next one in the shuffle (changing the record if need be). */
export function playNext() {
    const next = nextInShuffle(nowPlaying);
    playTrack(next.albumId, next.track);
}
