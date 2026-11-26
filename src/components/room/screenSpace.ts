// The OS app is drawn onto the 3D monitor with a CSS transform. It always renders at the
// monitor's own resolution (a fixed width, with the height following the display's aspect ratio),
// whatever the size of the visitor's browser. Mouse coordinates have to be mapped back into that
// (untransformed) pixel space for dragging and resizing to line up.

// Width of the monitor's virtual display, in CSS pixels.
export const SCREEN_WIDTH = 1200;
// Until the room model loads, assume the modelled display's proportions (0.724 x 0.4).
let screenHeight = Math.round(SCREEN_WIDTH * (0.4 / 0.724));

let overlay: HTMLElement | null = null;

function applySize() {
    if (!overlay) return;
    overlay.style.width = `${SCREEN_WIDTH}px`;
    overlay.style.height = `${screenHeight}px`;
}

export function registerScreenOverlay(element: HTMLElement | null) {
    overlay = element;
    applySize();
}

/** Sets the display's aspect ratio (width / height) from the monitor mesh. */
export function setScreenAspect(aspect: number) {
    const height = Math.round(SCREEN_WIDTH / aspect);
    if (height === screenHeight) return;
    screenHeight = height;
    applySize();
}

/** The size of the monitor's display, in the app's CSS pixels. */
export function getScreenSize(): { width: number; height: number } {
    return { width: SCREEN_WIDTH, height: screenHeight };
}

export function clientToScreen(clientX: number, clientY: number): { x: number; y: number } {
    const transform = overlay ? getComputedStyle(overlay).transform : 'none';
    if (!transform || transform === 'none') return { x: clientX, y: clientY };
    const point = new DOMMatrix(transform).inverse().transformPoint(new DOMPoint(clientX, clientY));
    return { x: point.x, y: point.y };
}
