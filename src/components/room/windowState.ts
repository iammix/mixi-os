// Which view is outside the window: home (Nea Redestos) or Rotterdam. Clicking the window
// (RoomScene) switches it; WindowView shows it and RoomExperience notes the change.

export type WindowPlace = 'home' | 'rotterdam';

export const WINDOW_PLACES: Record<WindowPlace, { name: string; note: string }> = {
    home: { name: 'Νέα Ραιδεστός', note: 'where I’m from' },
    rotterdam: { name: 'Rotterdam', note: 'where I live' },
};

let place: WindowPlace = 'home';
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

// Blender names after GLTFLoader turns spaces into underscores.
export const VIEW_ROOT = 'Window_view_Nea_Redestos';
export const VIEW_MASK = 'Window_view_mask';
export const ROTTERDAM_PHOTO = 'View_through_window';
const WINDOW_PARTS = new Set([VIEW_ROOT, VIEW_MASK, ROTTERDAM_PHOTO]);
// The glass and the frame around it ("Window jamb.001" becomes "Window_jamb001").
const WINDOW_FRAME = /^Window_(glazing|mullion|jamb|transom)/;

/** Whether this object is part of the view outside (which handles its own shadows and materials). */
export function isInWindowView(object: { name: string; parent: unknown } | null): boolean {
    for (let o = object as { name: string; parent: unknown } | null; o; o = o.parent as typeof o) {
        if (o.name === VIEW_ROOT || o.name === VIEW_MASK) return true;
    }
    return false;
}

/** Whether clicking this object should switch the view. */
export const isWindow = (name: string) => WINDOW_PARTS.has(name) || WINDOW_FRAME.test(name);
