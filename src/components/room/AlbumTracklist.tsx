import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { ALBUMS, coverUrl } from './albums';
import { getNowPlaying, playTrack, subscribeNowPlaying } from './musicState';

type AlbumTracklistProps = {
    albumId: string;
    /** Flip through the other records without closing the pop-up. */
    onChange: (albumId: string) => void;
    onClose: () => void;
};

const AlbumTracklist: React.FC<AlbumTracklistProps> = ({ albumId, onChange, onClose }) => {
    const closeButton = useRef<HTMLButtonElement>(null);
    const list = useRef<HTMLOListElement>(null);
    const index = Math.max(0, ALBUMS.findIndex((a) => a.id === albumId));
    const album = ALBUMS[index];
    const nowPlaying = useSyncExternalStore(subscribeNowPlaying, getNowPlaying);
    const onTurntable = nowPlaying.albumId === album.id;
    // Close so the record change on the turntable can be seen.
    const play = (track: number) => {
        playTrack(album.id, track);
        onClose();
    };
    const step = (by: number) => onChange(ALBUMS[(index + by + ALBUMS.length) % ALBUMS.length].id);

    useEffect(() => {
        closeButton.current?.focus();
    }, []);

    useEffect(() => {
        list.current?.scrollTo?.({ top: 0 });
    }, [albumId]);

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
                className="room-books room-album"
                role="dialog"
                aria-modal="true"
                aria-labelledby="room-album-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="room-books-header">
                    <h2>
                        from the crate · {index + 1}/{ALBUMS.length}
                    </h2>
                    <button ref={closeButton} className="room-books-close" onClick={onClose} aria-label="Close">
                        esc
                    </button>
                </div>
                <div className="room-album-head">
                    <img className="room-album-cover" src={coverUrl(album)} alt={`${album.title} cover`} width={96} height={96} />
                    <div className="room-album-info">
                        <div id="room-album-title" className="room-book-title">
                            {album.title}
                        </div>
                        <div className="room-book-meta">
                            {album.artist} · {album.year} · {album.tracks.length} tracks
                        </div>
                        <div className="room-album-hint">{onTurntable ? 'on the turntable' : 'pick a track to put it on'}</div>
                    </div>
                </div>
                <ol ref={list} className="room-album-tracks">
                    {album.tracks.map((track, i) => {
                        const current = onTurntable && nowPlaying.track === i;
                        return (
                            <li key={`${album.id}-${i}`}>
                                <button
                                    className={`room-album-track ${current ? 'current' : ''}`}
                                    onClick={() => play(i)}
                                    aria-current={current ? 'true' : undefined}
                                    aria-label={`Play ${track.title}`}
                                >
                                    <span className="room-album-no" aria-hidden>
                                        {current ? '♪' : String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="room-album-name">{track.title}</span>
                                    <span className="room-album-play" aria-hidden>
                                        ▶
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
                <div className="room-album-nav">
                    <button className="room-books-close" onClick={() => step(-1)} aria-label="Previous record">
                        ← prev
                    </button>
                    <button className="room-books-close" onClick={() => step(1)} aria-label="Next record">
                        next →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlbumTracklist;
