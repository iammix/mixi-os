import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
    SWAP_SECONDS,
    albumOf,
    getNowPlaying,
    playTrack,
    registerMusicSource,
    secondsSinceSwap,
    subscribeNowPlaying,
} from './musicState';

// The audio for whatever track is on the turntable (see albums.ts); it starts on Isaiah Rashad - SAME SH!T.
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
    PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
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

    useEffect(() => {
        let cancelled = false;

        // Autoplay with sound is usually blocked, so also start on the visitor's first interaction.
        const stopWaiting = () => GESTURES.forEach((g) => window.removeEventListener(g, onGesture, true));
        const onGesture = (e: Event) => {
            // The music button toggles playback itself.
            if (button.current?.contains(e.target as Node)) return stopWaiting();
            player.current?.playVideo();
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
                        registerMusicSource(player.current);
                        // Starts playing (or cues whatever was picked meanwhile) via the effect below.
                        setReady(true);
                    },
                    onStateChange: ({ data }) => {
                        const isPlaying = data === YT.PlayerState.PLAYING;
                        if (isPlaying) stopWaiting();
                        setPlaying(isPlaying);
                        // Like a record, carry on to the next track (and round to the start again).
                        if (data === YT.PlayerState.ENDED) {
                            const now = getNowPlaying();
                            playTrack(now.albumId, (now.track + 1) % albumOf(now).tracks.length);
                        }
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
        return () => window.clearTimeout(timer);
        // Only a new pick or the player becoming ready should (re)start playback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nowPlaying, ready]);

    const toggle = () => {
        if (!player.current) return;
        if (playing) player.current.pauseVideo();
        else player.current.playVideo();
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
