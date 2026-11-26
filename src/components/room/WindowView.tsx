import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROTTERDAM_PHOTO, VIEW_MASK, VIEW_ROOT, getWindowPlace, subscribeWindowPlace } from './windowState';

// The view of Nea Redestos outside the window (built by scripts/build_window_view.py).
//
// It's a miniature diorama behind the wall, so it is drawn only where the window opening is seen:
// the opening writes 1 into the stencil buffer and every part of the view only draws where it's 1.
// The sky and the light on the village follow where the sun really is over Nea Redestos right now
// (lit windows and stars at night), and now and then a cyclist rides along the valley road.

const LAT = 40.48;
const LON = 23.07;

// The window in three's coordinates (Blender x, z, -y), and the rings the view is built on.
const CENTER = new THREE.Vector2(-2.24, -0.85);
const SKY_R = 3.15;
const ROAD_R = 2.4;
const ROAD_Y = 0.534;
const PHI_RANGE: [number, number] = [-12, 88];
// Height of the sky's horizon and top as seen through the window.
const SKY_LOW = 0.6;
const SKY_HIGH = 1.35;

const RIDE_S = 48;
const PAUSE_S = 30;

/** Sun elevation and azimuth (degrees; azimuth clockwise from north) for a place and time. */
function sunPosition(date: Date, lat = LAT, lon = LON) {
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

type Tinted = { material: THREE.MeshStandardMaterial; base: THREE.Color; window: boolean };

const WindowView: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const place = useSyncExternalStore(subscribeWindowPlace, getWindowPlace);
    const parts = useMemo(() => {
        const root = scene.getObjectByName(VIEW_ROOT);
        const mask = scene.getObjectByName(VIEW_MASK) as THREE.Mesh | undefined;
        const photo = scene.getObjectByName(ROTTERDAM_PHOTO);
        const cyclist = scene.getObjectByName('View_cyclist');
        return { root, mask, photo, cyclist };
    }, [scene]);
    const state = useRef<{ tinted: Tinted[]; sky: THREE.ShaderMaterial | null; lastUpdate: number }>({
        tinted: [],
        sky: null,
        lastUpdate: -Infinity,
    });

    // Set up the stencil mask and give the view its own materials.
    useEffect(() => {
        const { root, mask } = parts;
        if (!root || !mask) return;
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
            const window = m.name === 'View lit window';
            if (window) copy.emissive = new THREE.Color('#ffb860');
            tinted.push({ material: copy, base: copy.color.clone(), window });
            return copy;
        };
        root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            originals.push([mesh, mesh.material]);
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
            mesh.renderOrder = 2;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
        });
        state.current = { tinted, sky, lastUpdate: -Infinity };
        return () => {
            originals.forEach(([mesh, material]) => (mesh.material = material));
            maskMaterial.dispose();
            sky.dispose();
            tinted.forEach((t) => t.material.dispose());
            state.current = { tinted: [], sky: null, lastUpdate: -Infinity };
        };
    }, [parts]);

    // Home or Rotterdam.
    useEffect(() => {
        if (parts.root) parts.root.visible = place === 'home';
        if (parts.photo) parts.photo.visible = place === 'rotterdam';
    }, [parts, place]);

    useFrame(({ clock }) => {
        const s = state.current;
        const now = clock.elapsedTime;
        // Light and sky: follow the sun, checked twice a minute.
        if (s.sky && now - s.lastUpdate > 30) {
            s.lastUpdate = now;
            const sun = sunPosition(new Date());
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
            s.tinted.forEach(({ material, base, window }) => {
                material.color.copy(base).multiply(tint);
                if (window) material.emissiveIntensity = look.windows * 2.6;
            });
        }
        // The cyclist rides along the valley road, then waits a while before the next one.
        const cyclist = parts.cyclist;
        if (cyclist) {
            const t = (now % (RIDE_S + PAUSE_S)) / RIDE_S;
            cyclist.visible = t <= 1;
            if (t <= 1) {
                const phi = THREE.MathUtils.degToRad(PHI_RANGE[0] + t * (PHI_RANGE[1] - PHI_RANGE[0]));
                cyclist.position.set(CENTER.x - ROAD_R * Math.cos(phi), ROAD_Y, CENTER.y - ROAD_R * Math.sin(phi));
                cyclist.rotation.set(0, Math.atan2(Math.cos(phi), Math.sin(phi)), 0);
            }
        }
    });

    return null;
};

export default WindowView;
