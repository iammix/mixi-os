// The YouTube player lives in the DOM while the record player animates inside the canvas, so the
// player registers itself here and the animation reads its state every frame.

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
