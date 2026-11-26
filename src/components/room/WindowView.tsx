import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW_MASK, WINDOW_PLACES, WindowPlace, getWindowPlace, subscribeWindowPlace } from './windowState';

// The views outside the window, Thessaloniki and Rotterdam (built by scripts/build_window_view.py).
//
// Each is a miniature diorama behind the wall, so it's drawn only where the window opening is seen:
// the opening writes 1 into the stencil buffer and every part of the views only draws where it's 1.
// The sky and the light follow where the sun really is over that place right now (lit windows,
// street lamps, the floodlit White Tower and stars at night), and now and then something passes: a
// cyclist on the promenade and a sailboat in Thessaloniki, a water taxi crossing the Maas in Rotterdam.

// The window in three's coordinates (Blender x, z, -y), and the rings the view is built on.
const CENTER = new THREE.Vector2(-2.24, -0.85);
const SKY_R = 3.15;
const PHI_RANGE: [number, number] = [-12, 88];
// Height of the sky's horizon and top as seen through the window.
const SKY_LOW = 0.6;
const SKY_HIGH = 1.35;

/** Something that now and then goes by along one of the rings: name, radius, height, seconds. */
/**
 * Something that now and then goes by: either along one of the rings (radius, height and the arc
 * of directions it covers) or in a straight line between two markers placed in Blender.
 */
type Mover = { name: string; travel: number; pause: number; offset: number } & (
    | { r: number; y: number; arc: [number, number] }
    | { from: string; to: string }
);
const MOVERS: Mover[] = [
    // Along the Thessaloniki promenade.
    { name: 'View_cyclist', from: 'View_cyclist_from', to: 'View_cyclist_to', travel: 40, pause: 26, offset: 0 },
    // Out on the gulf, clear of the shore.
    { name: 'View_sailboat', r: 2.2, y: 0.422, arc: [58, 88], travel: 60, pause: 30, offset: 20 },
    // Across the Maas.
    { name: 'View_water_taxi', r: 1.95, y: 0.422, arc: PHI_RANGE, travel: 26, pause: 22, offset: 9 },
];

// Materials that light up after dark: their light and how bright it gets.
const NIGHT_GLOW: Record<string, [string, number]> = {
    'View lit window': ['#ffb860', 2.6],
    'View lamp glow': ['#ffcf8a', 3],
    'View bridge cable': ['#cfe2ff', 0.9],
    'View white tower': ['#ffcf8f', 0.55],
};

/** Sun elevation and azimuth (degrees; azimuth clockwise from north) for a place and time. */
function sunPosition(date: Date, lat: number, lon: number) {
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

type Look = { top: string; horizon: string; tint: string; light: number; windows: number; stars: number };

// What the view looks like at a few sun elevations (degrees); in between it blends.
const LOOKS: [number, Look][] = [
    [-18, { top: '#070c1f', horizon: '#141f3c', tint: '#2a3358', light: 0.28, windows: 1, stars: 1 }],
    [-10, { top: '#101c40', horizon: '#3a3f6e', tint: '#3d4672', light: 0.4, windows: 1, stars: 0.6 }],
    [-4, { top: '#24396f', horizon: '#9a6a86', tint: '#7d6a8a', light: 0.6, windows: 0.9, stars: 0 }],
    [1, { top: '#3e5c9c', horizon: '#f2925a', tint: '#f0a070', light: 0.85, windows: 0.5, stars: 0 }],
    [6, { top: '#4f7cc4', horizon: '#f6c891', tint: '#ffd9b0', light: 0.95, windows: 0, stars: 0 }],
    [18, { top: '#4f8bdc', horizon: '#c2dcf2', tint: '#fff4e6', light: 1, windows: 0, stars: 0 }],
    [40, { top: '#3f84de', horizon: '#b6d6f4', tint: '#ffffff', light: 1.04, windows: 0, stars: 0 }],
];

function lookAt(elevation: number) {
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

const STENCIL = {
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
};

const skyMaterial = () =>
    new THREE.ShaderMaterial({
        ...STENCIL,
        side: THREE.DoubleSide,
        uniforms: {
            top: { value: new THREE.Color() },
            horizon: { value: new THREE.Color() },
            sun: { value: new THREE.Vector3() }, // phi (rad), height, visibility
            stars: { value: 0 },
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 top;
            uniform vec3 horizon;
            uniform vec3 sun;
            uniform float stars;
            varying vec3 vWorld;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            void main() {
                float h = clamp((vWorld.y - ${SKY_LOW.toFixed(2)}) / ${(SKY_HIGH - SKY_LOW).toFixed(2)}, 0.0, 1.0);
                vec3 color = mix(horizon, top, smoothstep(0.0, 1.0, h));
                float phi = atan(-(vWorld.z - ${CENTER.y.toFixed(2)}), -(vWorld.x - ${CENTER.x.toFixed(2)}));
                vec2 d = vec2((phi - sun.x) * ${SKY_R.toFixed(2)}, vWorld.y - sun.y);
                float r = length(d);
                color += sun.z * (vec3(1.0, 0.85, 0.6) * smoothstep(0.05, 0.035, r) + vec3(1.0, 0.6, 0.3) * 0.35 * exp(-r * 9.0));
                vec2 cell = floor(vec2(phi * 420.0, vWorld.y * 140.0));
                float star = step(0.993, hash(cell)) * stars * smoothstep(0.15, 0.6, h);
                color += vec3(star);
                gl_FragColor = vec4(color, 1.0);
                #include <colorspace_fragment>
            }
        `,
    });

type Tinted = { material: THREE.MeshStandardMaterial; base: THREE.Color; glow: number };

const WindowView: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const place = useSyncExternalStore(subscribeWindowPlace, getWindowPlace);
    const parts = useMemo(() => {
        const roots = Object.fromEntries(
            (Object.keys(WINDOW_PLACES) as WindowPlace[]).map((p) => [p, scene.getObjectByName(WINDOW_PLACES[p].root)]),
        ) as Record<WindowPlace, THREE.Object3D | undefined>;
        const mask = scene.getObjectByName(VIEW_MASK) as THREE.Mesh | undefined;
        const movers = MOVERS.map((m) => {
            const object = scene.getObjectByName(m.name);
            if (!object || !('from' in m)) return { ...m, object };
            // Markers are siblings of the mover under the same root, so their positions are in its space.
            const from = scene.getObjectByName(m.from)?.position.clone();
            const to = scene.getObjectByName(m.to)?.position.clone();
            return { ...m, object, line: from && to ? ([from, to] as const) : undefined };
        }).filter((m) => m.object);
        return { roots, mask, movers };
    }, [scene]);
    const state = useRef<{ tinted: Tinted[]; sky: THREE.ShaderMaterial | null; lastUpdate: number }>({
        tinted: [],
        sky: null,
        lastUpdate: -Infinity,
    });

    // Set up the stencil mask and give the view its own materials.
    useEffect(() => {
        const { roots, mask } = parts;
        if (!mask) return;
        const originals: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
        const maskMaterial = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
        });
        originals.push([mask, mask.material]);
        mask.material = maskMaterial;
        mask.renderOrder = 1;
        mask.castShadow = false;
        mask.receiveShadow = false;

        const sky = skyMaterial();
        const tinted: Tinted[] = [];
        const swap = (m: THREE.Material) => {
            if (m.name === 'View sky') return sky;
            const copy = (m as THREE.MeshStandardMaterial).clone();
            Object.assign(copy, STENCIL);
            const [light, glow] = NIGHT_GLOW[m.name] ?? ['#000000', 0];
            if (glow) {
                copy.emissive = new THREE.Color(light);
                copy.emissiveIntensity = 0;
            }
            tinted.push({ material: copy, base: copy.color.clone(), glow });
            return copy;
        };
        Object.values(roots).forEach((root) => root?.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            originals.push([mesh, mesh.material]);
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
            mesh.renderOrder = 2;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
        }));
        state.current = { tinted, sky, lastUpdate: -Infinity };
        return () => {
            originals.forEach(([mesh, material]) => (mesh.material = material));
            maskMaterial.dispose();
            sky.dispose();
            tinted.forEach((t) => t.material.dispose());
            state.current = { tinted: [], sky: null, lastUpdate: -Infinity };
        };
    }, [parts]);

    // Home or Rotterdam; re-light straight away for the new place.
    useEffect(() => {
        (Object.keys(parts.roots) as WindowPlace[]).forEach((p) => {
            const root = parts.roots[p];
            if (root) root.visible = p === place;
        });
        state.current.lastUpdate = -Infinity;
    }, [parts, place]);

    useFrame(({ clock }) => {
        const s = state.current;
        const now = clock.elapsedTime;
        // Light and sky: follow the sun, checked twice a minute.
        if (s.sky && now - s.lastUpdate > 30) {
            s.lastUpdate = now;
            const { lat, lon } = WINDOW_PLACES[getWindowPlace()];
            const sun = sunPosition(new Date(), lat, lon);
            const look = lookAt(sun.elevation);
            s.sky.uniforms.top.value.set(look.top);
            s.sky.uniforms.horizon.value.set(look.horizon);
            s.sky.uniforms.stars.value = look.stars;
            // Spread the sun's path from east to west across the visible sky.
            const across = THREE.MathUtils.clamp((sun.azimuth - 90) / 180, 0, 1);
            const phi = THREE.MathUtils.degToRad(PHI_RANGE[0] + 8 + across * (PHI_RANGE[1] - PHI_RANGE[0] - 16));
            const height = SKY_LOW + 0.04 + THREE.MathUtils.clamp(sun.elevation / 60, -0.2, 1) * (SKY_HIGH - SKY_LOW);
            s.sky.uniforms.sun.value.set(phi, height, sun.elevation > -2 ? 1 : 0);
            const tint = new THREE.Color(look.tint).multiplyScalar(look.light);
            s.tinted.forEach(({ material, base, glow }) => {
                material.color.copy(base).multiply(tint);
                if (glow) material.emissiveIntensity = look.windows * glow;
            });
        }
        // A cyclist on the valley road, a water taxi on the river: each goes by, then waits a while.
        parts.movers.forEach((m) => {
            const object = m.object!;
            const t = ((now + m.offset) % (m.travel + m.pause)) / m.travel;
            object.visible = t <= 1;
            if (t > 1) return;
            if ('line' in m) {
                if (!m.line) return;
                const [from, to] = m.line;
                object.position.lerpVectors(from, to, t);
                object.rotation.set(0, Math.atan2(-(to.z - from.z), to.x - from.x), 0);
                return;
            }
            if (!('arc' in m)) return;
            const phi = THREE.MathUtils.degToRad(m.arc[0] + t * (m.arc[1] - m.arc[0]));
            object.position.set(CENTER.x - m.r * Math.cos(phi), m.y, CENTER.y - m.r * Math.sin(phi));
            object.rotation.set(0, Math.atan2(Math.cos(phi), Math.sin(phi)), 0);
        });
    });

    return null;
};

export default WindowView;
