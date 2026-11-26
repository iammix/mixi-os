import React, { useEffect, useRef } from 'react';
import { PAINTINGS, paintingUrl } from './paintings';

type PaintingInfoProps = {
    paintingId: string;
    /** Move to the next painting on the wall without closing the pop-up. */
    onChange: (paintingId: string) => void;
    onClose: () => void;
};

/** The story of a painting on the wall and the painter who made it. */
const PaintingInfo: React.FC<PaintingInfoProps> = ({ paintingId, onChange, onClose }) => {
    const closeButton = useRef<HTMLButtonElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const index = Math.max(0, PAINTINGS.findIndex((p) => p.id === paintingId));
    const painting = PAINTINGS[index];
    const step = (by: number) => onChange(PAINTINGS[(index + by + PAINTINGS.length) % PAINTINGS.length].id);

    useEffect(() => {
        closeButton.current?.focus();
    }, []);

    useEffect(() => {
        body.current?.scrollTo?.({ top: 0 });
    }, [paintingId]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') step(1);
            else if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    return (
        <div className="room-books-backdrop" onClick={onClose}>
            <div
                className="room-books room-album room-painting"
                role="dialog"
                aria-modal="true"
                aria-labelledby="room-painting-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="room-books-header">
                    <h2>
                        on the wall · {index + 1}/{PAINTINGS.length}
                    </h2>
                    <button ref={closeButton} className="room-books-close" onClick={onClose} aria-label="Close">
                        esc
                    </button>
                </div>
                <img className="room-painting-image" src={paintingUrl(painting)} alt={`${painting.title} by ${painting.artist}`} />
                <div id="room-painting-title" className="room-book-title">
                    {painting.title} <span className="room-painting-original">{painting.original}</span>
                </div>
                <div className="room-book-meta">
                    {painting.artist} · {painting.year}
                </div>
                <div className="room-book-meta">{painting.details}</div>
                <div ref={body} className="room-painting-body">
                    <h3>The painting</h3>
                    {painting.history.map((p) => (
                        <p key={p}>{p}</p>
                    ))}
                    <h3>
                        The artist · {painting.artistNative ?? painting.artist}, {painting.lifespan}
                    </h3>
                    {painting.about.map((p) => (
                        <p key={p}>{p}</p>
                    ))}
                    <a className="room-painting-link" href={painting.link} target="_blank" rel="noopener noreferrer">
                        read more on wikipedia ↗
                    </a>
                </div>
                <div className="room-album-nav">
                    <button className="room-books-close" onClick={() => step(-1)} aria-label="Previous painting">
                        ← prev
                    </button>
                    <button className="room-books-close" onClick={() => step(1)} aria-label="Next painting">
                        next →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaintingInfo;
