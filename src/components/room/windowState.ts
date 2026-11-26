// Which view is outside the window: home (Thessaloniki) or Rotterdam. Clicking the window
// (RoomScene) switches it; WindowView shows it and RoomExperience notes the change.

export type WindowPlace = 'home' | 'rotterdam';

export const WINDOW_PLACES: Record<WindowPlace, { name: string; note: string; root: string; lat: number; lon: number }> = {
    // Blender names after GLTFLoader turns spaces into underscores (see scripts/build_window_view.py).
    rotterdam: { name: 'Rotterdam', note: 'where I live', root: 'Window_view_Rotterdam', lat: 51.92, lon: 4.48 },
    home: { name: 'Thessaloniki', note: 'where I’m from', root: 'Window_view_Thessaloniki', lat: 40.63, lon: 22.94 },
};

// Rotterdam is outside first; a click switches to Thessaloniki.
let place: WindowPlace = 'rotterdam';
const listeners = new Set<() => void>();

export const getWindowPlace = () => place;

export function toggleWindowPlace() {
    place = place === 'home' ? 'rotterdam' : 'home';
    listeners.forEach((l) => l());
}

export function subscribeWindowPlace(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export const VIEW_MASK = 'Window_view_mask';
const VIEW_ROOTS = new Set(Object.values(WINDOW_PLACES).map((p) => p.root));
// The glass and the frame around it ("Window jamb.001" becomes "Window_jamb001").
const WINDOW_FRAME = /^Window_(glazing|mullion|jamb|transom)/;

/** Whether this object is part of a view outside (which handles its own shadows and materials). */
export function isInWindowView(object: { name: string; parent: unknown } | null): boolean {
    for (let o = object as { name: string; parent: unknown } | null; o; o = o.parent as typeof o) {
        if (VIEW_ROOTS.has(o.name) || o.name === VIEW_MASK) return true;
    }
    return false;
}

/** Whether clicking this object should switch the view. */
export const isWindow = (name: string) => VIEW_ROOTS.has(name) || name === VIEW_MASK || WINDOW_FRAME.test(name);
