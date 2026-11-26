import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import AlbumTracklist from './AlbumTracklist';
import BookShelf from './BookShelf';
import { getNowPlaying } from './musicState';
import MusicToggle from './MusicToggle';
import PaintingInfo from './PaintingInfo';
import RaceCalendar from './RaceCalendar';
import RoomScene from './RoomScene';
import { WINDOW_PLACES, getWindowPlace, subscribeWindowPlace } from './windowState';
import { registerScreenOverlay } from './screenSpace';
import './room.css';

// room -> entering -> app -> leaving -> room
type Phase = 'room' | 'entering' | 'app' | 'leaving';

const SWIPE_THRESHOLD = 40;

const Loader: React.FC = () => {
    const { active, progress } = useProgress();
    if (!active && progress === 100) return null;
    return <div className="room-loader">loading room… {Math.round(progress)}%</div>;
};

type RoomExperienceProps = {
    children: React.ReactNode;
};

const RoomExperience: React.FC<RoomExperienceProps> = ({ children }) => {
    const [phase, setPhase] = useState<Phase>('room');
    const [booksOpen, setBooksOpen] = useState(false);
    const openBooks = useCallback(() => setBooksOpen(true), []);
    const closeBooks = useCallback(() => setBooksOpen(false), []);
    const [album, setAlbum] = useState<string | null>(null);
    const openAlbum = useCallback((albumId?: string) => setAlbum(albumId ?? getNowPlaying().albumId), []);
    const closeAlbum = useCallback(() => setAlbum(null), []);
    const [painting, setPainting] = useState<string | null>(null);
    const closePainting = useCallback(() => setPainting(null), []);
    const [racesOpen, setRacesOpen] = useState(false);
    const openRaces = useCallback(() => setRacesOpen(true), []);
    const closeRaces = useCallback(() => setRacesOpen(false), []);
    // A small note saying which view is outside the window, shown for a moment when it's switched.
    const [windowNote, setWindowNote] = useState<string | null>(null);
    useEffect(() => {
        let timer = 0;
        const unsubscribe = subscribeWindowPlace(() => {
            const { name, note } = WINDOW_PLACES[getWindowPlace()];
            setWindowNote(`${name} · ${note}`);
            clearTimeout(timer);
            timer = window.setTimeout(() => setWindowNote(null), 2600);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);
    const popupOpenRef = useRef(false);
    popupOpenRef.current = booksOpen || album !== null || painting !== null || racesOpen;
    const screenOverlay = useRef<HTMLDivElement>(null);
    useEffect(() => {
        registerScreenOverlay(screenOverlay.current);
        return () => registerScreenOverlay(null);
    }, []);
    const phaseRef = useRef(phase);
    phaseRef.current = phase;

    const zoomed = phase === 'entering' || phase === 'app';

    const enter = useCallback(() => {
        if (phaseRef.current === 'room' || phaseRef.current === 'leaving') setPhase('entering');
    }, []);

    const leave = useCallback(() => {
        if (phaseRef.current === 'entering' || phaseRef.current === 'app') setPhase('leaving');
    }, []);

    const handleArrive = useCallback((arrivedZoomed: boolean) => {
        if (arrivedZoomed && phaseRef.current === 'entering') {
            setPhase('app');
        } else if (!arrivedZoomed && phaseRef.current === 'leaving') {
            setPhase('room');
        }
    }, []);

    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            // Scrolling inside a pop-up shouldn't zoom into the computer behind it.
            if (e.deltaY > 0 && !popupOpenRef.current) enter();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') leave();
        };
        let touchStartY: number | null = null;
        let touchStartX = 0;
        const onTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0]?.clientY ?? null;
            touchStartX = e.touches[0]?.clientX ?? 0;
        };
        const onTouchMove = (e: TouchEvent) => {
            const y = e.touches[0]?.clientY;
            const x = e.touches[0]?.clientX;
            if (popupOpenRef.current || touchStartY === null || y === undefined || x === undefined) return;
            // A mostly-vertical upward swipe zooms in; sideways drags turn the room instead.
            if (touchStartY - y > SWIPE_THRESHOLD && Math.abs(touchStartY - y) > 2 * Math.abs(x - touchStartX)) {
                touchStartY = null;
                enter();
            }
        };

        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('keydown', onKey);
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        return () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
        };
    }, [enter, leave]);

    return (
        <div className="room-root">
            <Canvas
                className="room-canvas"
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, stencil: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.1 }}
            >
                <Suspense fallback={null}>
                    <RoomScene
                        zoomed={zoomed}
                        screenOverlay={screenOverlay}
                        onArrive={handleArrive}
                        onBooksClick={openBooks}
                        onAlbumClick={openAlbum}
                        onPaintingClick={setPainting}
                        onRacesClick={openRaces}
                    />
                </Suspense>
            </Canvas>

            <Loader />

            <div className={`room-hint ${phase === 'room' ? 'visible' : ''}`}>
                <span className="room-hint-mouse" />
                drag to look around - scroll to use the computer
            </div>

            {/* Always mounted so the app keeps running on the monitor when zoomed out. */}
            <div ref={screenOverlay} className={`room-app ${phase === 'app' ? 'interactive' : ''}`}>
                {children}
            </div>

            <div className={`room-window-note ${windowNote ? 'visible' : ''}`} aria-live="polite">
                {windowNote}
            </div>

            <MusicToggle />

            {booksOpen && <BookShelf onClose={closeBooks} />}

            {album && <AlbumTracklist albumId={album} onChange={setAlbum} onClose={closeAlbum} />}

            {painting && <PaintingInfo paintingId={painting} onChange={setPainting} onClose={closePainting} />}

            {racesOpen && <RaceCalendar onClose={closeRaces} />}

            {phase === 'app' && (
                <button className="room-exit" onClick={leave} aria-label="Back to the room">
                    esc
                </button>
            )}
        </div>
    );
};

export default RoomExperience;
