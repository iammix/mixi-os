import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BEATS } from './beats';
import { getPad, padBeatPhase, pressPad, stopPad, subscribePad } from './padPlayer';

// The drum pad up close: four big pads, laid out as on the device (the back pads on top), each
// looping a few bars of one of the beats. Keys 1–4 press the pads, space stops. The loop carries
// on after the panel is closed; the pad in the room shows which one is playing.

// Device pads 3 and 4 are at the back, so they're the top row here.
const LAYOUT = [2, 3, 0, 1];

const DrumPadPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const pad = useSyncExternalStore(subscribePad, getPad);
    const closeButton = useRef<HTMLButtonElement>(null);
    const [, setTick] = useState(0);

    useEffect(() => {
        closeButton.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === ' ') {
                e.preventDefault();
                stopPad();
            } else if (/^[1-4]$/.test(e.key)) void pressPad(BEATS[Number(e.key) - 1].id);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Pulse the playing pad on the beat.
    useEffect(() => {
        if (!pad.playing) return;
        let frame = 0;
        const step = () => {
            setTick((t) => t + 1);
            frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [pad.playing]);
    const pulse = pad.playing ? Math.exp(-padBeatPhase() * 6) : 0;

    const playing = BEATS.find((b) => b.id === pad.playing);
    const loop = playing && pad.loops[playing.id];

    return (
        <div className="room-books-backdrop" onClick={onClose}>
            <div className="room-books room-pad" role="dialog" aria-modal="true" aria-labelledby="room-pad-title" onClick={(e) => e.stopPropagation()}>
                <div className="room-books-header">
                    <h2 id="room-pad-title">mixvirus beats · pad</h2>
                    <button ref={closeButton} className="room-books-close" onClick={onClose} aria-label="Close">
                        esc
                    </button>
                </div>
                <div className="room-pad-grid">
                    {LAYOUT.map((i) => {
                        const beat = BEATS[i];
                        const on = pad.playing === beat.id;
                        const loading = pad.loading === beat.id;
                        return (
                            <button
                                key={beat.id}
                                className={`room-pad-button ${on ? 'on' : ''} ${loading ? 'loading' : ''}`}
                                style={{ '--pad': beat.color, '--pulse': on ? pulse : 0 } as React.CSSProperties}
                                onClick={() => void pressPad(beat.id)}
                                aria-pressed={on}
                            >
                                <span className="room-pad-key">{i + 1}</span>
                                <span className="room-pad-title">{beat.title}</span>
                                <span className="room-pad-year">{loading ? 'loading…' : beat.year}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="room-pad-status" aria-live="polite">
                    {playing && loop
                        ? `${playing.title} · ${Math.round(loop.bpm)} bpm · looping ${Math.round(loop.length)} s`
                        : 'press a pad (or 1–4) to loop a beat'}
                </div>
                <button className="room-books-close room-pad-stop" onClick={stopPad} disabled={!pad.playing}>
                    stop (space)
                </button>
            </div>
        </div>
    );
};

export default DrumPadPanel;
