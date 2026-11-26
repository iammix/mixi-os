import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { loadHandwriting } from './handwriting';
import { drawTrainingBoard } from './trainingBoardDraw';
import { SPORTS, currentMonth, distance, duration, getTraining, monthLabel, nextRace, sessions, subscribeTraining } from './training';

/** The training board from up close, big enough to read. */
const TrainingBoardCloseUp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const canvas = useRef<HTMLCanvasElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const training = useSyncExternalStore(subscribeTraining, getTraining);

    useEffect(() => {
        closeButton.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        const el = canvas.current;
        if (!el) return;
        let alive = true;
        const draw = () => {
            const ctx = el.getContext('2d');
            if (!alive || !ctx) return;
            // Draw at the size it's shown, in device pixels, so the writing stays sharp.
            const { width } = el.getBoundingClientRect();
            const ratio = window.devicePixelRatio || 1;
            el.width = Math.round(width * ratio);
            el.height = Math.round((width * ratio * 2) / 3);
            drawTrainingBoard(ctx, el.width, el.height, training, nextRace());
        };
        draw();
        loadHandwriting().then(draw);
        window.addEventListener('resize', draw);
        return () => {
            alive = false;
            window.removeEventListener('resize', draw);
        };
    }, [training]);

    // What the board says, for screen readers.
    const next = nextRace();
    const totals = training.totals;
    const summary = [
        `Training, ${monthLabel(totals?.month ?? currentMonth())}.`,
        ...(totals
            ? SPORTS.map((s) => `${s}: ${distance(s, totals[s].km)}, ${sessions(s, totals[s].sessions)}, ${duration(totals[s].seconds)} moving.`)
            : ['No numbers from Garmin yet.']),
        next ? `Next race: ${next.race.name}, in ${next.days} days.` : 'No race booked yet.',
    ].join(' ');

    return (
        <div className="room-books-backdrop" onClick={onClose}>
            <div
                className="room-training"
                role="dialog"
                aria-modal="true"
                aria-label="Training board"
                onClick={(e) => e.stopPropagation()}
            >
                <canvas ref={canvas} className="room-training-board" role="img" aria-label={summary} />
                <button ref={closeButton} className="room-books-close room-training-close" onClick={onClose} aria-label="Close">
                    esc
                </button>
            </div>
        </div>
    );
};

export default TrainingBoardCloseUp;
