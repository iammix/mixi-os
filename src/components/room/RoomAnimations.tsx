import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { isMusicPlaying, musicProgress, musicTime } from './musicState';

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

    // A plain disc doesn't look like it's spinning, so print a small mark on the label.
    const labelBox = new THREE.Box3().setFromObject(label);
    const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.0008, 0.006),
        new THREE.MeshStandardMaterial({ color: '#f1e3c8', roughness: 0.6 }),
    );
    mark.position.set(recordCentre.x + 0.021, labelBox.max.y + 0.0003, recordCentre.z);
    scene.add(mark);
    const record = makePivot(scene, [...recordParts, mark], recordCentre, 'Record spin');

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
        tonearm,
        tonearmOuter: tonearmAngleFor(stylus, pivot, recordCentre, OUTER_GROOVE_RADIUS),
        tonearmInner: tonearmAngleFor(stylus, pivot, recordCentre, INNER_GROOVE_RADIUS),
        speakers,
        drivers,
    };
    scene.userData.animationRig = rig;
    return rig;
}

export const RecordPlayerAndSpeakers: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const rig = useMemo(() => buildRig(scene), [scene]);
    const motion = useRef({ spin: 0, arm: 0, level: 0 });

    useFrame(({ clock }, rawDelta) => {
        if (!rig) return;
        const delta = Math.min(rawDelta, 0.1);
        const t = clock.getElapsedTime();
        const m = motion.current;
        const playing = isMusicPlaying();

        // The platter spins up when the song starts and coasts to a stop when it's paused.
        m.spin = THREE.MathUtils.damp(m.spin, playing ? 1 : 0, playing ? SPIN_UP : SPIN_DOWN, delta);
        rig.record.rotation.y -= RPM_33 * m.spin * delta;

        // Cue the arm onto the record and track inwards with the song; lift it back to rest on pause.
        const armGoal = playing ? THREE.MathUtils.lerp(rig.tonearmOuter, rig.tonearmInner, musicProgress()) : 0;
        m.arm = THREE.MathUtils.damp(m.arm, armGoal, TONEARM_SPEED, delta);
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

const steamVertex = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        vec3 p = position;
        // Let the column drift and twist as it rises.
        float rise = uv.y;
        p.x += sin(uv.y * 6.0 - uTime * 1.3) * 0.012 * rise + sin(uv.y * 13.0 - uTime * 2.1) * 0.004 * rise;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const steamFragment = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
    }

    void main() {
        vec2 uv = vUv;
        float smoke = fbm(vec2(uv.x * 3.0, uv.y * 2.2 - uTime * 0.45));
        smoke = smoothstep(0.38, 0.8, smoke);
        // Fade at the sides, near the coffee and towards the top.
        smoke *= smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);
        smoke *= smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.45, uv.y);
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), smoke * 0.85);
    }
`;

export const CoffeeSteam: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const position = useMemo(() => {
        const surface = scene.getObjectByName('Coffee_surface') ?? scene.getObjectByName('Coffee_cup');
        if (!surface) return null;
        const box = new THREE.Box3().setFromObject(surface);
        return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    }, [scene]);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

    useFrame(({ clock }) => {
        uniforms.uTime.value = clock.getElapsedTime();
    });

    if (!position) return null;
    const height = 0.24;
    return (
        <Billboard position={[position.x, position.y + height / 2 + 0.004, position.z]} lockX lockZ>
            <mesh renderOrder={10}>
                <planeGeometry args={[0.09, height, 16, 32]} />
                <shaderMaterial
                    vertexShader={steamVertex}
                    fragmentShader={steamFragment}
                    uniforms={uniforms}
                    transparent
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </Billboard>
    );
};
