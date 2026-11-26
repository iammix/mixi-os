import { Race, isDone } from './races';

// The medals on the SWIM · BIKE · RUN hanger above the tri bag (see MedalHanger): one for every race
// that's done, hung left to right in date order from the hooks modelled in Blender
// (scripts/build_medal_hanger.py).

/** The hooks' empties in the loaded model ("Medal hook 00" in Blender). */
export const HOOK_PREFIX = 'Medal_hook_';
/** Each medal's group is named `Medal_<race id>`. */
export const MEDAL_PREFIX = 'Medal_';
export const DEFAULT_RIBBON = '#1f4fa8';

/** Races that are done (the day after race day on), in date order. */
export const finishedRaces = (races: Race[], now = new Date()) =>
    races.filter((race) => isDone(race, now)).sort((a, b) => a.date.localeCompare(b.date));

export type HungMedal = { race: Race; hook: number; stack: number };

/** One medal per hook, left to right; once the hooks run out the rest go on the last one. */
export const hangMedals = (races: Race[], hookCount: number): HungMedal[] => {
    if (hookCount <= 0) return [];
    return races.map((race, i) => {
        const hook = Math.min(i, hookCount - 1);
        return { race, hook, stack: i - hook };
    });
};

/** What's engraved on the face of a medal. */
export const engraving = (race: Race) => ({ title: race.name, year: race.date.slice(0, 4) });

/** The race a medal object belongs to, from its name; null for anything else, the hanger included. */
export const medalRaceId = (objectName: string): string | null => {
    if (!objectName.startsWith(MEDAL_PREFIX)) return null;
    if (objectName.startsWith(HOOK_PREFIX) || objectName.startsWith('Medal_hanger')) return null;
    return objectName.slice(MEDAL_PREFIX.length) || null;
};

/** Split text into lines no wider than `width` at this font size. */
const wrapAt = (text: string, size: number, measure: (text: string, size: number) => number, width: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure(next, size) > width) {
            lines.push(line);
            line = word;
        } else line = next;
    }
    if (line) lines.push(line);
    return lines;
};

/**
 * The biggest of `sizes` (largest first) at which the engraved title fits on `maxLines` lines of
 * `width`; if none does, the smallest size with the last line cut off with an ellipsis.
 */
export const fitEngraving = (
    title: string,
    measure: (text: string, size: number) => number,
    width: number,
    maxLines: number,
    sizes: number[],
): { size: number; lines: string[] } => {
    for (const size of sizes) {
        const lines = wrapAt(title, size, measure, width);
        if (lines.length <= maxLines) return { size, lines };
    }
    const size = sizes[sizes.length - 1];
    const lines = wrapAt(title, size, measure, width).slice(0, maxLines);
    lines[maxLines - 1] += '…';
    return { size, lines };
};
