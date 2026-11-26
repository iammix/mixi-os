import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
    SWAP_SECONDS,
    albumOf,
    getNowPlaying,
    isMusicHeld,
    playNext,
    registerMusicSource,
    secondsSinceSwap,
    subscribeMusicHold,
    subscribeNowPlaying,
} from './musicState';
import { stopPad } from './padPlayer';
import { needleDrop, needleEvent, needleLift, quietNeedle, recordLands, scratchSound, setRecordVolume, startScratchSound, stopScratchSound } from './recordSounds';
import { getPad } from './padPlayer';
import { subscribeScratch } from './scratch';
import { RECORD_LANDS_AT } from './RoomAnimations';

// The audio for whatever track is on the turntable (see albums.ts), played in shuffle (see musicState).
const VOLUME = 60;
// Start the new song this far before the record change finishes, so the arm drops as it begins.
const CUE_LEAD = 0.3;
// Events that count as a user gesture, which browsers require before they'll play sound.
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

type YTPlayer = {
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    setVolume: (volume: number) => void;
    getPlayerState: () => number;
    getCurrentTime: () => number;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    getDuration: () => number;
    destroy: () => void;
};

type YTNamespace = {
    Player: new (
        el: HTMLElement,
        opts: {
            videoId: string;
            playerVars?: Record<string, number | string>;
            events?: {
                onReady?: () => void;
                onStateChange?: (e: { data: number }) => void;
            };
        },
    ) => YTPlayer;
    PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
};

declare global {
    interface Window {
        YT?: YTNamespace;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiPromise: Promise<YTNamespace> | null = null;

const loadYouTubeApi = () => {
    apiPromise ??= new Promise((resolve) => {
        if (window.YT?.Player) return resolve(window.YT);
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT!);
        };
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
    });
    return apiPromise;
};

const MusicToggle: React.FC = () => {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<YTPlayer | null>(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const nowPlaying = useSyncExternalStore(subscribeNowPlaying, getNowPlaying);
    const album = albumOf(nowPlaying);
    const track = album.tracks[nowPlaying.track];
    const [swapping, setSwapping] = useState(false);
    /** The video the player has loaded, so picking it again resumes rather than restarts. */
    const loadedVideo = useRef<string | null>(null);
    /** The player's last state other than buffering, to tell when the needle drops or lifts. */
    const settledState = useRef<number | null>(null);
    /** Whether to put the music back on when the drum pad stops holding it. */
    const resumeAfterHold = useRef(false);

    useEffect(() => {
        let cancelled = false;

        // Autoplay with sound is usually blocked, so also start on the visitor's first interaction.
        const stopWaiting = () => GESTURES.forEach((g) => window.removeEventListener(g, onGesture, true));
        const onGesture = (e: Event) => {
            // The music button toggles playback itself.
            if (button.current?.contains(e.target as Node)) return stopWaiting();
            // Until the player is ready it has no methods yet; it starts by itself once it is. Not
            // while the drum pad holds the music: it'll carry on when the pad stops.
            if (isMusicHeld()) return;
            if (typeof player.current?.playVideo === 'function') player.current.playVideo();
        };
        GESTURES.forEach((g) => window.addEventListener(g, onGesture, true));

        loadYouTubeApi().then((YT) => {
            if (cancelled || !host.current) return;
            const start = getNowPlaying();
            const startVideo = albumOf(start).tracks[start.track].video;
            loadedVideo.current = startVideo;
            player.current = new YT.Player(host.current, {
                videoId: startVideo,
                playerVars: { controls: 0, playsinline: 1 },
                events: {
                    onReady: () => {
                        player.current?.setVolume(VOLUME);
                        setRecordVolume(VOLUME / 100);
                        registerMusicSource(player.current);
                        // Starts playing (or cues whatever was picked meanwhile) via the effect below.
                        setReady(true);
                    },
                    onStateChange: ({ data }) => {
                        const isPlaying = data === YT.PlayerState.PLAYING;
                        if (isPlaying) stopWaiting();
                        setPlaying(isPlaying);
                        // The needle drops as the music starts and lifts as it stops (recordSounds).
                        const needle = needleEvent(settledState.current, data);
                        if (needle === 'drop') needleDrop();
                        else if (needle === 'lift') needleLift();
                        if (data !== YT.PlayerState.BUFFERING) settledState.current = data;
                        // The drum pad holds the music: if it starts anyway (autoplay kicking in, say),
                        // pause it again and let it carry on once the pad stops.
                        if (isPlaying && isMusicHeld()) {
                            resumeAfterHold.current = true;
                            player.current?.pauseVideo();
                        }
                        // On to the next song in the shuffle, changing the record if it's on another.
                        if (data === YT.PlayerState.ENDED) playNext();
                    },
                },
            });
        });
        return () => {
            cancelled = true;
            stopWaiting();
            registerMusicSource(null);
            player.current?.destroy();
            player.current = null;
        };
    }, []);

    // Load the picked track. When the record is being changed, stop now and cue the new song for
    // when the new record is on the platter.
    useEffect(() => {
        const p = player.current;
        if (!ready || !p) return;
        const start = () => {
            setSwapping(false);
            if (loadedVideo.current === track.video) {
                p.playVideo();
            } else {
                loadedVideo.current = track.video;
                p.loadVideoById(track.video);
            }
        };
        const remaining = SWAP_SECONDS - CUE_LEAD - secondsSinceSwap();
        if (remaining <= 0) {
            start();
            return;
        }
        setSwapping(true);
        p.pauseVideo();
        const timer = window.setTimeout(start, remaining * 1000);
        // The thud of the new record settling onto the platter, in step with the animation.
        const landing = RECORD_LANDS_AT - secondsSinceSwap();
        const landed = landing > 0 ? window.setTimeout(recordLands, landing * 1000) : 0;
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(landed);
        };
        // Only a new pick or the player becoming ready should (re)start playback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nowPlaying, ready]);

    // The drum pad holds the music while it plays a loop: pause, then carry on afterwards if it was on.
    useEffect(
        () =>
            subscribeMusicHold(() => {
                const p = player.current;
                if (!p || typeof p.pauseVideo !== 'function') return;
                if (isMusicHeld()) {
                    // Playing, or buffering on its way to playing.
                    resumeAfterHold.current = [1, 3].includes(p.getPlayerState());
                    if (resumeAfterHold.current) p.pauseVideo();
                } else if (resumeAfterHold.current) {
                    resumeAfterHold.current = false;
                    p.playVideo();
                }
            }),
        [],
    );

    // Scratching the record while a song plays: the song can't be scratched for real (it's YouTube),
    // so it pauses under a scratch sound and then carries on from as far on or back as the record
    // was turned. (A drum pad loop is scratched for real: see padPlayer.)
    useEffect(() => {
        let wasPlaying = false;
        return subscribeScratch((e) => {
            if (getPad().playing) return;
            const p = player.current;
            const ready = p && typeof p.pauseVideo === 'function';
            if (e.type === 'start') {
                // Playing, or buffering on its way to playing (as right after a jump).
                wasPlaying = !!ready && [1, 3].includes(p.getPlayerState());
                if (wasPlaying) {
                    quietNeedle(true);
                    p!.pauseVideo();
                }
                startScratchSound();
            } else if (e.type === 'move') {
                scratchSound(e.speed);
            } else {
                stopScratchSound();
                if (wasPlaying && ready) {
                    p.seekTo(Math.max(0, p.getCurrentTime() + e.seconds), true);
                    p.playVideo();
                    // The needle never left the record: keep its sounds quiet until it's playing again.
                    window.setTimeout(() => quietNeedle(false), 1500);
                }
                wasPlaying = false;
            }
        });
    }, []);

    const toggle = () => {
        if (!player.current) return;
        if (playing) player.current.pauseVideo();
        else {
            // Putting the music back on while the drum pad plays stops the pad (and lets the music go).
            if (isMusicHeld()) stopPad();
            player.current.playVideo();
        }
    };

    return (
        <>
            {/* The player only provides the audio, so keep it out of sight. */}
            <div className="room-music-player" aria-hidden>
                <div ref={host} />
            </div>
            <button
                ref={button}
                className={`room-music ${playing ? 'playing' : ''}`}
                onClick={toggle}
                disabled={!ready}
                aria-label={playing ? 'Pause music' : 'Play music'}
            >
                <span className="room-music-icon">{playing ? '❚❚' : '▶'}</span>
                <span className="room-music-text">
                    <span className="room-music-label">{swapping ? 'changing the record…' : "room's jam"}</span>
                    {album.artist.toLowerCase()} - {track.title.toLowerCase()}
                </span>
            </button>
        </>
    );
};

export default MusicToggle;
