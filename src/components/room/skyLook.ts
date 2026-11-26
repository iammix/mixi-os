import * as THREE from 'three';
import type { Weather } from './weather';

// How the view outside the window looks: by sun elevation, then greyed and dimmed by clouds.

export type Look = { top: string; horizon: string; tint: string; light: number; windows: number; stars: number };

// What the view looks like at a few sun elevations (degrees); in between it blends.
export const LOOKS: [number, Look][] = [
    [-18, { top: '#070c1f', horizon: '#141f3c', tint: '#2a3358', light: 0.28, windows: 1, stars: 1 }],
    [-10, { top: '#101c40', horizon: '#3a3f6e', tint: '#3d4672', light: 0.4, windows: 1, stars: 0.6 }],
    [-4, { top: '#24396f', horizon: '#9a6a86', tint: '#7d6a8a', light: 0.6, windows: 0.9, stars: 0 }],
    [1, { top: '#3e5c9c', horizon: '#f2925a', tint: '#f0a070', light: 0.85, windows: 0.5, stars: 0 }],
    [6, { top: '#4f7cc4', horizon: '#f6c891', tint: '#ffd9b0', light: 0.95, windows: 0, stars: 0 }],
    [18, { top: '#4f8bdc', horizon: '#c2dcf2', tint: '#fff4e6', light: 1, windows: 0, stars: 0 }],
    [40, { top: '#3f84de', horizon: '#b6d6f4', tint: '#ffffff', light: 1.04, windows: 0, stars: 0 }],
];

export function lookAt(elevation: number) {
    const i = LOOKS.findIndex(([e]) => e > elevation);
    if (i === 0) return LOOKS[0][1];
    if (i === -1) return LOOKS[LOOKS.length - 1][1];
    const [e0, a] = LOOKS[i - 1];
    const [e1, b] = LOOKS[i];
    const t = (elevation - e0) / (e1 - e0);
    const mix = (x: string, y: string) => '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
    return {
        top: mix(a.top, b.top),
        horizon: mix(a.horizon, b.horizon),
        tint: mix(a.tint, b.tint),
        light: a.light + (b.light - a.light) * t,
        windows: a.windows + (b.windows - a.windows) * t,
        stars: a.stars + (b.stars - a.stars) * t,
    };
}

/** The look under this weather: clouds grey the sky and light, dim it and hide the stars. */
export function applyWeather(look: Look, w: Weather): Look {
    const c = w.cloud;
    if (c <= 0) return look;
    const grey = (hex: string, amount: number, darken: number) => {
        const color = new THREE.Color(hex);
        const hsl = color.getHSL({ h: 0, s: 0, l: 0 });
        color.setHSL(hsl.h, hsl.s * (1 - amount * c), hsl.l * (1 - darken * c));
        return '#' + color.getHexString();
    };
    return {
        top: grey(look.top, 0.75, 0.25),
        horizon: grey(look.horizon, 0.75, 0.15),
        tint: grey(look.tint, 0.6, 0),
        light: look.light * (1 - 0.35 * c),
        windows: look.windows,
        stars: look.stars * (1 - c),
    };
}
