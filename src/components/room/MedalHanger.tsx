import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_RIBBON, HOOK_PREFIX, MEDAL_PREFIX, engraving, finishedRaces, fitEngraving, hangMedals } from './medals';
import { getMedalHover } from './medalState';
import { RACES, Race, publicUrl } from './races';

// The medals on the SWIM · BIKE · RUN hanger above the tri bag: a gold disc on a ribbon for every
// race that's done, hung from the hooks modelled in Blender (scripts/build_medal_hanger.py).
// The face is engraved with the race's name and year, or shows a photo of the real medal when the
// race has one. Pointing at a medal sets it swinging along the wall.

// The hanger is on the left wall, which faces +x; "along the wall" is z.
const RADIUS = 0.03;
const DEPTH = 0.004;
const RIBBON_LENGTH = 0.09;
const RIBBON_WIDTH = 0.02;
// Medals that share the last hook hang a little lower and further out, so they stay visible.
const STACK_DROP = 0.02;
const STACK_OUT = 0.006;

const GOLD = '#c9a227';
const ENGRAVED = '#6e5210';

// The swing: amplitude (radians) while pointed at, how often it swings, and how fast it dies away.
const SWING = 0.12;
const SWING_HZ = 1.6;
const SWING_GROW = 6;
const SWING_DECAY = 1.5;

type Medal = { group: THREE.Group; amplitude: number; phase: number; raceId: string };

const FONT = "Georgia, 'Times New Roman', serif";

/** The engraved face: the race's name and year in darker gold on gold, inside a ring. */
function engravedFace(race: Race) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    if (!ctx) return texture;
    const c = size / 2;
    const shine = ctx.createRadialGradient(c * 0.7, c * 0.6, 10, c, c, c);
    shine.addColorStop(0, '#f0d77a');
    shine.addColorStop(1, '#b08a2a');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = ENGRAVED;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(c, c, c - 30, 0, Math.PI * 2);
    ctx.stroke();

    const { title, year } = engraving(race);
    ctx.fillStyle = ENGRAVED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const measure = (text: string, size: number) => {
        ctx.font = `bold ${size}px ${FONT}`;
        return ctx.measureText(text).width;
    };
    const { size: fontSize, lines } = fitEngraving(title.toUpperCase(), measure, 330, 3, [52, 46, 40, 34]);
    ctx.font = `bold ${fontSize}px ${FONT}`;
    const lineHeight = fontSize * 1.15;
    const top = c - 40 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, c, top + i * lineHeight));
    ctx.fillRect(c - 60, top + lines.length * lineHeight - 18, 120, 5);
    ctx.font = `bold 72px ${FONT}`;
    ctx.fillText(year, c, top + lines.length * lineHeight + 50);
    return texture;
}

/** A ribbon in its colour with a thin white stripe down the middle. */
function ribbonTexture(colour: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 16, 1);
        ctx.fillStyle = '#f4f1ea';
        ctx.fillRect(7, 0, 2, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/** The face texture as it sits on the disc's cap, turned upright and reading left to right. */
function onFace(texture: THREE.Texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI;
    texture.anisotropy = 4;
    return texture;
}

function makeMedal(race: Race, stack: number) {
    const group = new THREE.Group();
    group.name = `${MEDAL_PREFIX}${race.id}`;
    group.position.set(stack * STACK_OUT, -stack * STACK_DROP, 0);

    const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(RIBBON_WIDTH, RIBBON_LENGTH).rotateY(Math.PI / 2).translate(0, -RIBBON_LENGTH / 2, 0),
        new THREE.MeshStandardMaterial({ map: ribbonTexture(race.medal?.ribbon ?? DEFAULT_RIBBON), roughness: 0.8, side: THREE.DoubleSide }),
    );
    group.add(ribbon);

    // A cylinder's cap faces +y; turned so the top cap faces into the room (+x).
    const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(RADIUS, RADIUS, DEPTH, 48).rotateZ(-Math.PI / 2).translate(0, -RIBBON_LENGTH - RADIUS, 0),
        [
            new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: onFace(engravedFace(race)), metalness: 0.6, roughness: 0.35 }),
            new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.4 }),
        ],
    );
    group.add(disc);

    // The real medal's face, once (and only if) its photo loads.
    const photo = race.medal?.photo;
    if (photo) {
        new THREE.TextureLoader().load(publicUrl(photo), (texture) => {
            const face = (disc.material as THREE.MeshStandardMaterial[])[1];
            face.map?.dispose();
            face.map = onFace(texture);
            face.metalness = 0.2;
            face.needsUpdate = true;
        });
    }
    return group;
}

function disposeMedal(group: THREE.Group) {
    group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
            m.map?.dispose();
            m.dispose();
        }
    });
}

const MedalHanger: React.FC<{ scene: THREE.Object3D; zoomed: boolean }> = ({ scene, zoomed }) => {
    const medals = useRef<Medal[]>([]);

    useEffect(() => {
        const hooks: THREE.Object3D[] = [];
        scene.traverse((o) => {
            if (o.name.startsWith(HOOK_PREFIX)) hooks.push(o);
        });
        hooks.sort((a, b) => a.name.localeCompare(b.name));
        const built = hangMedals(finishedRaces(RACES), hooks.length).map(({ race, hook, stack }) => {
            const group = makeMedal(race, stack);
            hooks[hook].add(group);
            return { group, amplitude: 0, phase: 0, raceId: race.id };
        });
        medals.current = built;
        return () => {
            for (const { group } of built) {
                group.removeFromParent();
                disposeMedal(group);
            }
            medals.current = [];
        };
    }, [scene]);

    useFrame((_, rawDelta) => {
        const delta = Math.min(rawDelta, 0.1);
        const hovered = zoomed ? null : getMedalHover();
        for (const medal of medals.current) {
            if (medal.raceId === hovered) medal.amplitude = THREE.MathUtils.damp(medal.amplitude, SWING, SWING_GROW, delta);
            else medal.amplitude = THREE.MathUtils.damp(medal.amplitude, 0, SWING_DECAY, delta);
            medal.phase += delta * SWING_HZ * Math.PI * 2;
            if (medal.amplitude < 1e-4) medal.phase = 0;
            // Swinging along the wall is turning about the wall's normal (x).
            medal.group.rotation.x = medal.amplitude * Math.sin(medal.phase);
        }
    });

    return null;
};

export default MedalHanger;
