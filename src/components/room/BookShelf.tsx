import React, { useEffect, useRef } from 'react';

// The books stacked on the side table, top to bottom.
const BOOKS = [
    {
        title: 'Capital in the Twenty-First Century',
        author: 'Thomas Piketty',
        year: '2013',
        note: 'Two centuries of data on wealth and inequality, and why returns on capital tend to outpace growth.',
        spine: '#f6f2ea',
        ink: '#b3261e',
    },
    {
        title: 'The Right to Be Lazy',
        author: 'Paul Lafargue',
        year: '1883',
        note: "A short, sharp polemic against the worship of work - an argument for leisure that still lands.",
        spine: '#7a5a3c',
        ink: '#d8c08a',
    },
    {
        title: 'In Search of Lost Time',
        author: 'Marcel Proust',
        year: '1913-1927',
        note: 'Seven volumes on memory, time and desire - the madeleine, and everything that follows it.',
        spine: '#2f4a3a',
        ink: '#d8c08a',
    },
];

type BookShelfProps = {
    onClose: () => void;
};

const BookShelf: React.FC<BookShelfProps> = ({ onClose }) => {
    const closeButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeButton.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="room-books-backdrop" onClick={onClose}>
            <div
                className="room-books"
                role="dialog"
                aria-modal="true"
                aria-labelledby="room-books-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="room-books-header">
                    <h2 id="room-books-title">on the side table</h2>
                    <button ref={closeButton} className="room-books-close" onClick={onClose} aria-label="Close">
                        esc
                    </button>
                </div>
                <p className="room-books-intro">three books i'd recommend</p>
                <ol className="room-books-list">
                    {BOOKS.map((book) => (
                        <li key={book.title} className="room-book">
                            <span className="room-book-spine" style={{ background: book.spine, boxShadow: `inset 0 6px 0 ${book.ink}, inset 0 -6px 0 ${book.ink}` }} aria-hidden />
                            <div className="room-book-body">
                                <div className="room-book-title">{book.title}</div>
                                <div className="room-book-meta">
                                    {book.author} · {book.year}
                                </div>
                                <p className="room-book-note">{book.note}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
};

export default BookShelf;
