import React, { useEffect, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ALBUMS, coverUrl } from './albums';

// A few records left out on the floor in front of the record console, under the turntable.
// Positions are in metres, in three.js world space (see the console/floor bounds in room.glb).
const FLOOR_Y = 0.021;
const SLEEVE = 0.315;
const SLEEVE_THICKNESS = 0.004;
const DISC_RADIUS = 0.149;
const DISC_THICKNESS = 0.002;
const LABEL_RADIUS = 0.05;
// The front edge of the console's base, which the leaning sleeves rest against.
const CONSOLE_FRONT_Z = -1.205;
const CONSOLE_BASE_TOP = 0.205;
const LEAN = THREE.MathUtils.degToRad(13);
const CARDBOARD = '#d9d2c3';
// A press that moves further than this is a drag to look around, not a click.
const CLICK_TOLERANCE = 6;

type Leaning = { kind: 'leaning'; album: string; x: number; turn: number; /** How many sleeves sit behind it. */ depth: number };
type Flat = { kind: 'flat'; album: string; x: number; z: number; turn: number };
type Disc = { kind: 'disc'; album: string; x: number; z: number; label: string };
type LooseRecord = Leaning | Flat | Disc;

const RECORDS: LooseRecord[] = [
    { kind: 'leaning', album: '2001', x: 1.6, turn: -0.03, depth: 0 },
    { kind: 'leaning', album: 'compton', x: 1.67, turn: 0.04, depth: 1 },
    { kind: 'flat', album: 'gkmc', x: 1.16, z: -0.94, turn: 0.38 },
    // The record from that sleeve, half slid out on top of it.
    { kind: 'disc', album: 'gkmc', x: 1.27, z: -0.88, label: '#c9b48a' },
];

const SLEEVE_ALBUMS = [...new Set(RECORDS.filter((r) => r.kind !== 'disc').map((r) => r.album))];
const albumById = (id: string) => ALBUMS.find((a) => a.id === id)!;

type VinylsProps = {
    /** Clicks only count while looking around the room, not while using the computer. */
    zoomed: boolean;
    onSelect: (albumId: string) => void;
};

const Vinyls: React.FC<VinylsProps> = ({ zoomed, onSelect }) => {
    const canvas = useThree((s) => s.gl.domElement);
    const textures = useTexture(SLEEVE_ALBUMS.map((id) => coverUrl(albumById(id))));

    const materials = useMemo(() => {
        const cardboard = new THREE.MeshStandardMaterial({ color: CARDBOARD, roughness: 0.9 });
        const covers = new Map<string, THREE.MeshStandardMaterial>();
        SLEEVE_ALBUMS.forEach((id, i) => {
            const texture = textures[i];
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            covers.set(id, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }));
        });
        const vinyl = new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.28, metalness: 0.1 });
        // Box faces in three's order: +x, -x, +y, -y, +z (the cover), -z (the back).
        const sleeve = (id: string) => [cardboard, cardboard, cardboard, cardboard, covers.get(id)!, cardboard];
        return { cardboard, covers, vinyl, sleeve };
    }, [textures]);

    useEffect(
        () => () => {
            materials.cardboard.dispose();
            materials.vinyl.dispose();
            materials.covers.forEach((m) => m.dispose());
        },
        [materials],
    );

    const labels = useMemo(
        () => new Map(RECORDS.filter((r): r is Disc => r.kind === 'disc').map((r) => [r, new THREE.MeshStandardMaterial({ color: r.label, roughness: 0.7 })])),
        [],
    );
    useEffect(() => () => labels.forEach((m) => m.dispose()), [labels]);

    const onHover = (e: ThreeEvent<PointerEvent>) => {
        // Stop here so the room underneath doesn't reset the cursor.
        e.stopPropagation();
        canvas.style.cursor = zoomed ? '' : 'pointer';
    };
    const onLeave = () => {
        canvas.style.cursor = '';
    };
    const clickFor = (album: string) => (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (zoomed || e.delta > CLICK_TOLERANCE) return;
        onSelect(album);
    };

    return (
        <group onPointerMove={onHover} onPointerOut={onLeave}>
            {RECORDS.map((record, i) => {
                const onClick = clickFor(record.album);
                if (record.kind === 'leaning') {
                    // Bottom edge on the floor, back face resting on the console base (or the sleeve behind).
                    const backZ = CONSOLE_FRONT_Z + (CONSOLE_BASE_TOP - FLOOR_Y) * Math.tan(LEAN) + record.depth * 0.014;
                    const half = SLEEVE / 2;
                    const position: [number, number, number] = [
                        record.x,
                        FLOOR_Y + half * Math.cos(LEAN),
                        backZ + SLEEVE_THICKNESS / 2 - half * Math.sin(LEAN),
                    ];
                    return (
                        <mesh
                            key={i}
                            position={position}
                            rotation={new THREE.Euler(-LEAN, record.turn, 0, 'YXZ')}
                            material={materials.sleeve(record.album)}
                            castShadow
                            receiveShadow
                            onClick={onClick}
                        >
                            <boxGeometry args={[SLEEVE, SLEEVE, SLEEVE_THICKNESS]} />
                        </mesh>
                    );
                }
                if (record.kind === 'flat') {
                    return (
                        <mesh
                            key={i}
                            position={[record.x, FLOOR_Y + SLEEVE_THICKNESS / 2, record.z]}
                            rotation={new THREE.Euler(-Math.PI / 2, record.turn, 0, 'YXZ')}
                            material={materials.sleeve(record.album)}
                            castShadow
                            receiveShadow
                            onClick={onClick}
                        >
                            <boxGeometry args={[SLEEVE, SLEEVE, SLEEVE_THICKNESS]} />
                        </mesh>
                    );
                }
                const y = FLOOR_Y + SLEEVE_THICKNESS + DISC_THICKNESS / 2;
                return (
                    <group key={i} position={[record.x, y, record.z]} onClick={onClick}>
                        <mesh material={materials.vinyl} castShadow receiveShadow>
                            <cylinderGeometry args={[DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS, 96]} />
                        </mesh>
                        <mesh position={[0, DISC_THICKNESS / 2 + 0.0003, 0]} material={labels.get(record)}>
                            <cylinderGeometry args={[LABEL_RADIUS, LABEL_RADIUS, 0.0006, 64]} />
                        </mesh>
                        <mesh position={[0, DISC_THICKNESS / 2 + 0.0008, 0]} material={materials.vinyl}>
                            <cylinderGeometry args={[0.004, 0.004, 0.0008, 16]} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
};

export default Vinyls;
