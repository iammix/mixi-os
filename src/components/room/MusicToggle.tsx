import React, { useEffect, useRef, useState } from 'react';
import { registerMusicSource } from './musicState';

// Isaiah Rashad - SAME SH!T (audio provided to YouTube by Top Dawg Entertainment/Warner Records).
const VIDEO_ID = 'iG-ZWavEAc8';
const VOLUME = 60;
// Events that count as a user gesture, which browsers require before they'll play sound.
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

type YTPlayer = {
    playVideo: () => void;
    pauseVideo: () => void;
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
            player.current = new YT.Player(host.current, {
                videoId: VIDEO_ID,
                playerVars: { loop: 1, playlist: VIDEO_ID, controls: 0, playsinline: 1 },
                events: {
                    onReady: () => {
                        player.current?.setVolume(VOLUME);
                        registerMusicSource(player.current);
                        setReady(true);
                        player.current?.playVideo();
                    },
                    onStateChange: ({ data }) => {
                        const isPlaying = data === YT.PlayerState.PLAYING;
                        if (isPlaying) stopWaiting();
                        setPlaying(isPlaying);
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
                    <span className="room-music-label">room's jam</span>
                    isaiah rashad - same sh!t
                </span>
            </button>
        </>
    );
};

export default MusicToggle;
