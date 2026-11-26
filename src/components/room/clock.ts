// The wall clock (see WallClock) shows the time wherever the window looks out on: Rotterdam or
// Thessaloniki (windowState). They're always an hour apart, so switching places only moves the
// hour hand.

export type ClockTime = { hours: number; minutes: number; seconds: number };

const formats = new Map<string, Intl.DateTimeFormat>();

/** The wall-clock time in an IANA time zone, e.g. "Europe/Amsterdam" (24-hour, midnight is 0). */
export function timeIn(date: Date, timeZone: string): ClockTime {
    let format = formats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
        formats.set(timeZone, format);
    }
    const parts = format.formatToParts(date);
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { hours: part('hour') % 24, minutes: part('minute'), seconds: part('second') };
}

const TAU = Math.PI * 2;

/**
 * Each hand's angle in radians, clockwise from 12. The second hand ticks once a second; the minute
 * and hour hands move on smoothly.
 */
export function clockAngles({ hours, minutes, seconds }: ClockTime) {
    const tick = Math.floor(seconds);
    return {
        seconds: (tick / 60) * TAU,
        minutes: ((minutes + tick / 60) / 60) * TAU,
        hours: (((hours % 12) + (minutes + tick / 60) / 60) / 12) * TAU,
    };
}
