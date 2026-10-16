// The OS app is drawn onto the 3D monitor with a CSS transform, so mouse coordinates have to be
// mapped back into the app's own (untransformed) pixel space for dragging and resizing to line up.

let overlay: HTMLElement | null = null;

export function registerScreenOverlay(element: HTMLElement | null) {
    overlay = element;
}

export function clientToScreen(clientX: number, clientY: number): { x: number; y: number } {
    const transform = overlay ? getComputedStyle(overlay).transform : 'none';
    if (!transform || transform === 'none') return { x: clientX, y: clientY };
    const point = new DOMMatrix(transform).inverse().transformPoint(new DOMPoint(clientX, clientY));
    return { x: point.x, y: point.y };
}
