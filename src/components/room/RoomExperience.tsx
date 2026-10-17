import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import BookShelf from './BookShelf';
import MusicToggle from './MusicToggle';
import RoomScene from './RoomScene';
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
    const booksOpenRef = useRef(booksOpen);
    booksOpenRef.current = booksOpen;
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
            // Scrolling inside the book pop-up shouldn't zoom into the computer behind it.
            if (e.deltaY > 0 && !booksOpenRef.current) enter();
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
            if (touchStartY === null || y === undefined || x === undefined) return;
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
                gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.1 }}
            >
                <Suspense fallback={null}>
                    <RoomScene zoomed={zoomed} screenOverlay={screenOverlay} onArrive={handleArrive} onBooksClick={openBooks} />
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

            <MusicToggle />

            {booksOpen && <BookShelf onClose={closeBooks} />}

            {phase === 'app' && (
                <button className="room-exit" onClick={leave} aria-label="Back to the room">
                    esc
                </button>
            )}
        </div>
    );
};

export default RoomExperience;
