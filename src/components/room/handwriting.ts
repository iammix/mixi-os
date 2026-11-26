// The handwriting used on paper in the room: the race calendar and the training board.
//
// Loaded the first time something needs it, appended at the end of <head>: IntroPage writes its
// keyframes into document.styleSheets[0], which must stay a same-origin sheet.

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap';
export const HAND = "Caveat, 'Bradley Hand', 'Segoe Print', cursive";
export const INK = '#1f2f6b';
export const RED = '#b8322b';

let handwriting: Promise<unknown> | null = null;

/** Add the font's stylesheet once; resolves when both weights are ready to draw with (or failed). */
export function loadHandwriting() {
    if (!handwriting) {
        handwriting = new Promise<void>((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = FONT_URL;
            link.onload = () => resolve();
            link.onerror = () => resolve();
            document.head.appendChild(link);
        }).then(() => Promise.all([document.fonts?.load(`700 36px ${HAND}`), document.fonts?.load(`400 23px ${HAND}`)]).catch(() => undefined));
    }
    return handwriting;
}
