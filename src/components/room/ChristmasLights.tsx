import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { christmasOverride, isChristmas } from './christmas';
import { daylight, roomNow, sunPosition } from './sun';
import { WINDOW_PLACES, getWindowPlace } from './windowState';

// The Christmas lights round the window (scripts/build_christmas_lights.py). They're only up over
// Christmas (christmas.ts). By day they glow faintly; as it gets dark outside they come on properly
// and twinkle, one colour after another, and throw a little coloured light into the room.

const COLOURS = ['red', 'green', 'blue', 'amber', 'white'] as const;
const DAY_GLOW = 0.35;
const NIGHT_GLOW = 4;
// How fast the twinkle runs round the colours (cycles per second).
const TWINKLE = 0.35;

const ChristmasLights: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const parts = useMemo(() => {
        const root = scene.getObjectByName('Christmas_lights');
        const bulbs = COLOURS.map((name) => {
            const mesh = scene.getObjectByName(`Christmas_lights_${name}`) as THREE.Mesh | undefined;
            if (!mesh) return null;
            const material = (mesh.material as THREE.MeshStandardMaterial).clone();
            const color = material.color.clone();
            // The colour comes from the glow: a dark, matte bulb with no reflections keeps it from
            // washing out to pastel under the room's lights.
            material.emissive.copy(color);
            material.color.copy(color).multiplyScalar(0.15);
            material.roughness = 0.7;
            material.envMapIntensity = 0;
            mesh.material = material;
            return { material, color };
        }).filter((b): b is NonNullable<typeof b> => b !== null);
        return { root, bulbs };
    }, [scene]);

    const glow = useRef<THREE.PointLight>(null);
    const state = useRef({ up: false, light: 1, checked: -Infinity });
    const override = useMemo(() => christmasOverride(typeof location !== 'undefined' ? location.search : ''), []);
    const mixed = useMemo(() => new THREE.Color(), []);

    useFrame(({ clock }) => {
        const s = state.current;
        const t = clock.elapsedTime;
        // Whether they're up, and how dark it is outside: checked every half minute.
        if (t - s.checked > 30) {
            s.checked = t;
            const now = roomNow();
            s.up = override ?? isChristmas(now);
            const { lat, lon } = WINDOW_PLACES[getWindowPlace()];
            s.light = daylight(sunPosition(now, lat, lon).elevation);
        }
        if (parts.root) parts.root.visible = s.up;
        if (glow.current) glow.current.visible = s.up;
        if (!s.up) return;

        const level = THREE.MathUtils.lerp(NIGHT_GLOW, DAY_GLOW, s.light);
        mixed.setRGB(0, 0, 0);
        parts.bulbs.forEach(({ material, color }, i) => {
            // Each colour swells and dims in turn, so the twinkle runs along the string.
            const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (TWINKLE * t - i / parts.bulbs.length));
            const brightness = level * (0.45 + 0.55 * wave * wave);
            material.emissiveIntensity = brightness;
            mixed.r += color.r * brightness;
            mixed.g += color.g * brightness;
            mixed.b += color.b * brightness;
        });
        if (glow.current) {
            const total = Math.max(mixed.r, mixed.g, mixed.b, 1e-3);
            glow.current.color.setRGB(mixed.r / total, mixed.g / total, mixed.b / total);
            glow.current.intensity = 0.9 * (1 - s.light);
        }
    });

    // A soft glow on the wall and the floor round the window (Blender x, y, z -> three.js x, z, -y).
    return <pointLight ref={glow} position={[-1.9, 1.9, -0.85]} intensity={0} distance={2.4} decay={2} />;
};

export default ChristmasLights;
