import { Race, isDone } from './races';

// The medals on the SWIM · BIKE · RUN hanger above the tri bag (see Medals): one for every race
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
