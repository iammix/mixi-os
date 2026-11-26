// Where the sun is over a place, how much daylight that makes in the room, and the room's "now".
//
// The window view (WindowView) draws its sky from the sun's position and the room's lights
// (RoomLights) follow the same sun, so the lamps come on as it gets dark outside the window.
// `?time=21:30` sets the room's clock to that time in Rotterdam (and the hour after it in
// Thessaloniki), for trying out day and night; the clock then runs on from there.

import { timeIn } from './clock';

/** Sun elevation and azimuth (degrees; azimuth clockwise from north) for a place and time. */
export function sunPosition(date: Date, lat: number, lon: number) {
    const rad = Math.PI / 180;
    const d = date.getTime() / 86400000 - 10957.5; // days since J2000
    const g = (357.529 + 0.98560028 * d) * rad;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
    const e = (23.439 - 0.00000036 * d) * rad;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
    const ha = (gmst * 15 + lon) * rad - ra;
    const phi = lat * rad;
    const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
    const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
    return { elevation: elevation / rad, azimuth: ((azimuth / rad) % 360 + 360) % 360 };
}

// The sun's elevation (degrees) where the room is fully night, and where it's full day.
const NIGHT_BELOW = -6;
const DAY_ABOVE = 8;

/**
 * How much daylight is in the room, 0 (night: lamps on) to 1 (full day: lamps off), from the sun's
 * elevation; a heavy sky takes some of it away.
 */
export function daylight(elevation: number, cloud = 0) {
    const t = Math.min(1, Math.max(0, (elevation - NIGHT_BELOW) / (DAY_ABOVE - NIGHT_BELOW)));
    const smooth = t * t * (3 - 2 * t);
    return smooth * (1 - 0.3 * Math.min(1, Math.max(0, cloud)));
}

const OVERRIDE_ZONE = 'Europe/Amsterdam';

/** `?time=HH:MM` → how many ms to shift the real clock by so it's that time in Rotterdam; 0 if none. */
export function timeOffset(search: string, now = new Date()) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(search).get('time') ?? '');
    if (!match) return 0;
    const [h, m] = [Number(match[1]), Number(match[2])];
    if (h > 23 || m > 59) return 0;
    const t = timeIn(now, OVERRIDE_ZONE);
    let minutes = h * 60 + m - (t.hours * 60 + t.minutes);
    // The nearest way round: 23:00 asked for at 01:00 is two hours back, not 22 ahead.
    if (minutes > 720) minutes -= 1440;
    if (minutes < -720) minutes += 1440;
    return (minutes * 60 - t.seconds) * 1000;
}

const offset = typeof location !== 'undefined' ? timeOffset(location.search) : 0;

/** The time in the room: now, unless `?time=` moved it. */
export const roomNow = () => new Date(Date.now() + offset);
