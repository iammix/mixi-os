import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { ALBUMS, coverUrl } from './albums';
import { SWAP_SECONDS, getNowPlaying, isMusicPlaying, musicProgress, musicTime, secondsSinceSwap } from './musicState';

const RPM_33 = (33.333 * Math.PI * 2) / 60;
const BPM = 92;
// How quickly (per second) the platter spins up / coasts down, the arm swings and the speakers react.
const SPIN_UP = 2.5;
const SPIN_DOWN = 1.2;
const TONEARM_SPEED = 3;
const SPEAKER_SPEED = 6;
const OUTER_GROOVE_RADIUS = 0.138;
const INNER_GROOVE_RADIUS = 0.065;

const RECORD_PARTS = /Aluminum_platter|Rubber_platter_mat|Playing_record|Record_center_label|Record_spindle|Vinyl_groove/;
// The parts of that which are the record itself, which comes off when it's changed.
const DISC_PARTS = /Playing_record|Record_center_label|Vinyl_groove/;

// Changing the record (seconds since it started; see SWAP_SECONDS): the arm returns and the platter
// stops, the old record lifts off and away, then the new one drops onto the spindle.
const SWAP_SPIN_DOWN = 5;
const SWAP_TONEARM_SPEED = 7;
const LIFT_START = 0.6;
const LIFT_TIME = 0.75;
const LABEL_SWAP_AT = LIFT_START + LIFT_TIME;
const DROP_START = 1.45;
const DROP_TIME = 0.95;
/** When the new record settles onto the platter (seconds into the change), for its sound. */
export const RECORD_LANDS_AT = DROP_START + DROP_TIME * 0.72;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** Overshoots 1 by about 1% near the end, which reads as a small bounce on landing. */
const easeOutBack = (t: number) => 1 + 1.6 * Math.pow(t - 1, 3) + 0.6 * Math.pow(t - 1, 2);

const coverTextures = new Map<string, THREE.Texture>();
const coverTexture = (albumId: string) => {
    let texture = coverTextures.get(albumId);
    const album = ALBUMS.find((a) => a.id === albumId);
    if (!texture && album) {
        texture = new THREE.TextureLoader().load(coverUrl(album));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        coverTextures.set(albumId, texture);
    }
    return texture ?? null;
};
const TONEARM_PARTS = /^(Tonearm|Stylus_cartridge)$/;
const SPEAKER_PARTS = /^Speaker_/;
const DRIVER_PARTS = /^Speaker_(cone|dustcap|rubber_surround)/;

const worldCenter = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
const worldBox = (objects: THREE.Object3D[]) =>
    objects.reduce((box, o) => box.union(new THREE.Box3().setFromObject(o)), new THREE.Box3());

/** Wrap objects in a group whose origin sits at `pivot`, keeping their world transforms. */
function makePivot(parent: THREE.Object3D, objects: THREE.Object3D[], pivot: THREE.Vector3, name: string) {
    const group = new THREE.Group();
    group.name = name;
    parent.updateMatrixWorld(true);
    group.position.copy(parent.worldToLocal(pivot.clone()));
    parent.add(group);
    group.updateMatrixWorld(true);
    objects.forEach((o) => group.attach(o));
    return group;
}

type Driver = { group: THREE.Group; woofer: boolean };
type Rig = {
    record: THREE.Group;
    /** The vinyl and its label, spun with `record` but able to lift off it. */
    disc: THREE.Group;
    discRest: THREE.Vector3;
    label: THREE.MeshStandardMaterial;
    labelAlbum: string | null;
    tonearm: THREE.Group;
    tonearmOuter: number;
    tonearmInner: number;
    speakers: THREE.Group[];
    drivers: Driver[];
};

/** Angle (around Y) that puts the stylus `radius` away from the record's centre. */
function tonearmAngleFor(stylus: THREE.Vector3, pivot: THREE.Vector3, centre: THREE.Vector3, radius: number) {
    const v = new THREE.Vector3().subVectors(stylus, pivot);
    let best = 0;
    let bestError = Infinity;
    for (let a = -1.2; a <= 1.2; a += 0.0005) {
        const p = v.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, a).add(pivot);
        const error = Math.abs(Math.hypot(p.x - centre.x, p.z - centre.z) - radius);
        if (error < bestError - 1e-6 || (Math.abs(error - bestError) < 1e-4 && Math.abs(a) < Math.abs(best))) {
            best = a;
            bestError = error;
        }
    }
    return best;
}

function buildRig(scene: THREE.Object3D): Rig | null {
    if (scene.userData.animationRig) return scene.userData.animationRig as Rig;

    const find = (pattern: RegExp) => {
        const found: THREE.Object3D[] = [];
        scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && pattern.test(o.name)) found.push(o);
        });
        return found;
    };
    const recordParts = find(RECORD_PARTS);
    const tonearmParts = find(TONEARM_PARTS);
    const pivotMesh = find(/^Tonearm_pivot$/)[0];
    const label = find(/^Record_center_label$/)[0];
    if (!recordParts.length || !tonearmParts.length || !pivotMesh || !label) return null;

    scene.updateMatrixWorld(true);
    const recordCentre = worldCenter(recordParts[0]);

    // The grooves and label sit almost exactly on the vinyl; pull them forward in the depth test
    // so they don't flicker against it.
    recordParts
        .filter((o) => /Vinyl_groove|Record_center_label/.test(o.name))
        .forEach((o) => {
            const mesh = o as THREE.Mesh;
            const material = (mesh.material as THREE.Material).clone();
            material.polygonOffset = true;
            material.polygonOffsetFactor = -2;
            material.polygonOffsetUnits = -2;
            mesh.material = material;
        });

    // Print the album's cover on the centre label; it also shows the record spinning.
    const labelBox = new THREE.Box3().setFromObject(label);
    const labelRadius = (labelBox.max.x - labelBox.min.x) / 2;
    const labelMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
    });
    const coverLabel = new THREE.Mesh(new THREE.CircleGeometry(labelRadius * 0.97, 64), labelMaterial);
    coverLabel.name = 'Record cover label';
    // Lie flat with the top of the artwork towards the back of the turntable.
    coverLabel.rotation.x = -Math.PI / 2;
    coverLabel.position.set(recordCentre.x, labelBox.max.y + 0.0004, recordCentre.z);
    scene.add(coverLabel);

    const discParts = recordParts.filter((o) => DISC_PARTS.test(o.name));
    const record = makePivot(
        scene,
        recordParts.filter((o) => !DISC_PARTS.test(o.name)),
        recordCentre,
        'Record spin',
    );
    const disc = makePivot(scene, [...discParts, coverLabel], recordCentre, 'Record disc');

    const pivot = worldCenter(pivotMesh);
    const stylus = worldCenter(tonearmParts.find((o) => o.name.startsWith('Stylus')) ?? tonearmParts[0]);
    const tonearm = makePivot(scene, tonearmParts, pivot, 'Tonearm swing');

    // Group each speaker (split by which side of the console it's on), then each driver inside it.
    const speakerMeshes = find(SPEAKER_PARTS);
    const sides = [speakerMeshes.filter((o) => worldCenter(o).x < recordCentre.x), speakerMeshes.filter((o) => worldCenter(o).x >= recordCentre.x)];
    const speakers: THREE.Group[] = [];
    const drivers: Driver[] = [];
    sides.forEach((meshes, i) => {
        if (!meshes.length) return;
        const box = worldBox(meshes);
        const base = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
        const speaker = makePivot(scene, meshes, base, `Speaker ${i}`);
        speakers.push(speaker);

        const driverMeshes = meshes.filter((o) => DRIVER_PARTS.test(o.name));
        const cones = driverMeshes.filter((o) => o.name.startsWith('Speaker_cone'));
        cones.forEach((cone, j) => {
            const c = worldCenter(cone);
            const parts = driverMeshes.filter((o) => {
                const p = worldCenter(o);
                return Math.abs(p.x - c.x) < 0.01 && Math.abs(p.y - c.y) < 0.01;
            });
            const size = new THREE.Box3().setFromObject(cone).getSize(new THREE.Vector3());
            drivers.push({ group: makePivot(speaker, parts, c, `Driver ${i}.${j}`), woofer: size.x > 0.08 });
        });
    });

    const rig: Rig = {
        record,
        disc,
        discRest: disc.position.clone(),
        label: labelMaterial,
        labelAlbum: null,
        tonearm,
        tonearmOuter: tonearmAngleFor(stylus, pivot, recordCentre, OUTER_GROOVE_RADIUS),
        tonearmInner: tonearmAngleFor(stylus, pivot, recordCentre, INNER_GROOVE_RADIUS),
        speakers,
        drivers,
    };
    scene.userData.animationRig = rig;
    return rig;
}

/** Keep the record on the platter, or lift the old one off and drop the new one on while changing it. */
function animateDisc(rig: Rig, swapTime: number) {
    const { disc, discRest, record } = rig;
    const albumId = getNowPlaying().albumId;
    // The new record's label goes on once the old record is out of sight.
    if (rig.labelAlbum !== albumId && swapTime >= LABEL_SWAP_AT) {
        rig.labelAlbum = albumId;
        rig.label.map = coverTexture(albumId);
        rig.label.needsUpdate = true;
    }

    let lift = 0;
    let forward = 0;
    let tilt = 0;
    let scale = 1;
    let twist = 0;
    if (swapTime < DROP_START) {
        // Lift the old record straight up off the spindle, then tip it towards the room and away.
        const u = clamp01((swapTime - LIFT_START) / LIFT_TIME);
        lift = easeInOut(clamp01(u / 0.5)) * 0.07 + easeInOut(clamp01((u - 0.4) / 0.6)) * 0.12;
        forward = easeInOut(clamp01((u - 0.35) / 0.65)) * 0.3;
        tilt = easeInOut(clamp01((u - 0.2) / 0.6)) * 0.55;
        scale = 1 - easeInOut(clamp01((u - 0.65) / 0.35));
    } else if (swapTime < DROP_START + DROP_TIME) {
        // The new record comes down from above, levels out and settles onto the platter.
        const v = clamp01((swapTime - DROP_START) / DROP_TIME);
        scale = easeInOut(clamp01(v / 0.3));
        lift = Math.abs(1 - easeOutBack(v)) * 0.2;
        tilt = -(1 - easeInOut(clamp01(v / 0.8))) * 0.35;
        twist = (1 - easeInOut(v)) * 1.4;
    }

    disc.position.set(discRest.x, discRest.y + lift, discRest.z + forward);
    disc.rotation.set(tilt, record.rotation.y + twist, 0);
    disc.scale.setScalar(Math.max(scale, 0.0001));
}

export const RecordPlayerAndSpeakers: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const rig = useMemo(() => buildRig(scene), [scene]);
    const motion = useRef({ spin: 0, arm: 0, level: 0 });

    useFrame(({ clock }, rawDelta) => {
        if (!rig) return;
        const delta = Math.min(rawDelta, 0.1);
        const t = clock.getElapsedTime();
        const m = motion.current;
        const swapTime = secondsSinceSwap();
        const swapping = swapTime < SWAP_SECONDS;
        const playing = isMusicPlaying() && !swapping;

        // The platter spins up when the song starts and coasts to a stop when it's paused
        // (quicker when the record is being changed).
        m.spin = THREE.MathUtils.damp(m.spin, playing ? 1 : 0, playing ? SPIN_UP : swapping ? SWAP_SPIN_DOWN : SPIN_DOWN, delta);
        rig.record.rotation.y -= RPM_33 * m.spin * delta;
        animateDisc(rig, swapTime);

        // Cue the arm onto the record and track inwards with the song; lift it back to rest on pause.
        const armGoal = playing ? THREE.MathUtils.lerp(rig.tonearmOuter, rig.tonearmInner, musicProgress()) : 0;
        m.arm = THREE.MathUtils.damp(m.arm, armGoal, swapping ? SWAP_TONEARM_SPEED : TONEARM_SPEED, delta);
        // The speakers only kick in once the stylus has settled into the groove.
        const onRecord = playing && Math.abs(m.arm - armGoal) < Math.abs(rig.tonearmOuter) * 0.05;
        m.level = THREE.MathUtils.damp(m.level, onRecord ? 1 : 0, SPEAKER_SPEED, delta);

        // A little wow-and-flutter wobble while the stylus rides the groove.
        rig.tonearm.rotation.y = m.arm + m.level * Math.sin(t * RPM_33) * 0.0015;

        // Keep the beat locked to the song so it freezes on pause and resumes in time.
        const songTime = musicTime();
        const beat = (songTime * BPM) / 60;
        const phase = beat % 1;
        const kick = Math.exp(-phase * 7) * (0.75 + 0.25 * Math.sin(beat * 0.5));
        const snare = Math.floor(beat) % 2 === 1 ? Math.exp(-Math.abs(phase - 0.02) * 10) * 0.5 : 0;
        rig.drivers.forEach(({ group, woofer }) => {
            const pulse = woofer
                ? m.level * kick
                : m.level * (snare + 0.25 * Math.abs(Math.sin(songTime * 37)) * Math.abs(Math.sin(songTime * 5.3)));
            group.scale.setScalar(1 + pulse * (woofer ? 0.16 : 0.12));
            group.position.z = group.userData.restZ ??= group.position.z;
            group.position.z += pulse * 0.006;
        });
        rig.speakers.forEach((speaker) => {
            const bump = 1 + m.level * kick * 0.018;
            speaker.scale.set(bump, 1 + m.level * kick * 0.025, bump);
        });
    });

    return null;
};

// The mug used to sit inside the desk lamp's base; nudge it towards the front of the desk (+z, metres).
const COFFEE_PARTS = ['Coffee_cup', 'Coffee_surface', 'Cup_handle'];
const COFFEE_NUDGE = new THREE.Vector3(0.02, 0, 0.18);

// Three wisps, each with its own seed, size and offset so they drift apart and cross over.
const WISPS = [
    { seed: 0.0, width: 0.13, height: 0.27, offset: 0.0, strength: 0.6 },
    { seed: 3.7, width: 0.11, height: 0.22, offset: -0.008, strength: 0.45 },
    { seed: 7.3, width: 0.12, height: 0.3, offset: 0.009, strength: 0.35 },
];

const steamVertex = /* glsl */ `
    uniform float uTime;
    uniform float uSeed;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        vec3 p = position;
        // Sway more the higher it gets, like warm air caught by a draught.
        float rise = pow(uv.y, 1.6);
        float t = uTime + uSeed;
        p.x += (sin(t * 0.55) * 0.6 + sin(uv.y * 5.0 - t * 1.1) * 0.4) * 0.02 * rise;
        p.z += sin(uv.y * 3.0 - t * 0.8) * 0.01 * rise;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const steamFragment = /* glsl */ `
    uniform float uTime;
    uniform float uSeed;
    uniform float uStrength;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
    }

    void main() {
        vec2 uv = vUv;
        float t = uTime * 0.6;
        vec2 s = vec2(uSeed * 1.37, uSeed * 2.11);

        // A thin column off the coffee that wanders sideways and spreads out as it rises.
        float centre = 0.5 + (fbm(vec2(uv.y * 1.8 - t * 0.5, 0.0) + s) - 0.5) * 0.55 * uv.y;
        float width = mix(0.07, 0.38, smoothstep(0.0, 0.9, uv.y));
        float column = 1.0 - smoothstep(width * 0.35, width, abs(uv.x - centre));

        // Domain-warped noise scrolling upwards gives curling, breaking wisps instead of a flat smear.
        vec2 q = vec2(uv.x * 2.2, uv.y * 1.6 - t * 0.7) + s;
        vec2 warp = vec2(fbm(q), fbm(q + vec2(5.2, 1.3)));
        float wisp = fbm(vec2(uv.x * 3.2, uv.y * 2.6 - t * 1.1) + warp * 1.6 + s);
        float steam = smoothstep(0.42, 0.78, wisp) * column;

        // Appear just above the coffee, thin out and vanish towards the top.
        steam *= smoothstep(0.0, 0.1, uv.y) * (1.0 - smoothstep(0.3, 1.0, uv.y));
        // Puffs come and go rather than streaming at a constant rate.
        steam *= 0.6 + 0.4 * smoothstep(0.2, 0.8, noise(vec2(uv.y * 2.0 - uTime * 0.9, uSeed)));

        gl_FragColor = vec4(vec3(1.0, 0.97, 0.93), steam * uStrength);
    }
`;

export const CoffeeSteam: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const position = useMemo(() => {
        // Move the mug once; the model is cached, so don't nudge it again if this remounts.
        if (!scene.userData.coffeeNudged) {
            scene.userData.coffeeNudged = true;
            COFFEE_PARTS.forEach((name) => {
                const part = scene.getObjectByName(name);
                if (!part?.parent) return;
                part.parent.updateMatrixWorld(true);
                const world = part.getWorldPosition(new THREE.Vector3()).add(COFFEE_NUDGE);
                part.position.copy(part.parent.worldToLocal(world));
            });
            scene.updateMatrixWorld(true);
        }
        const surface = scene.getObjectByName('Coffee_surface') ?? scene.getObjectByName('Coffee_cup');
        if (!surface) return null;
        const box = new THREE.Box3().setFromObject(surface);
        return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    }, [scene]);
    const wisps = useMemo(
        () => WISPS.map((w) => ({ ...w, uniforms: { uTime: { value: 0 }, uSeed: { value: w.seed }, uStrength: { value: w.strength } } })),
        [],
    );

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        wisps.forEach((w) => (w.uniforms.uTime.value = time));
    });

    if (!position) return null;
    return (
        <>
            {wisps.map((w, i) => (
                <Billboard
                    key={i}
                    position={[position.x + w.offset, position.y + w.height / 2 + 0.002, position.z]}
                    lockX
                    lockZ
                >
                    <mesh renderOrder={10 + i}>
                        <planeGeometry args={[w.width, w.height, 24, 48]} />
                        <shaderMaterial
                            vertexShader={steamVertex}
                            fragmentShader={steamFragment}
                            uniforms={w.uniforms}
                            transparent
                            depthWrite={false}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </Billboard>
            ))}
        </>
    );
};
