import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BEATS } from './beats';
import { getPad, padBeatPhase } from './padPlayer';

// The drum pad on the record console (scripts/build_drum_pad.py). Each of its four pads glows faintly
// in its beat's colour; the one that's playing lights up and pulses on every beat, and one that's
// loading blinks. Clicking the pad opens it up close (DrumPadPanel), where the loops are played.

const IDLE = 0.12;
const LIT = 2.6;
const PULSE = 3.5;

const DrumPad: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const pads = useMemo(
        () =>
            BEATS.map((beat, i) => {
                const mesh = scene.getObjectByName(`Drum_pad_${i + 1}`) as THREE.Mesh | undefined;
                if (!mesh) return null;
                const original = mesh.material as THREE.MeshStandardMaterial;
                const material = original.clone();
                material.emissive.set(beat.color);
                material.emissiveIntensity = IDLE;
                mesh.material = material;
                return { beat, mesh, material, original };
            }).filter((p): p is NonNullable<typeof p> => p !== null),
        [scene],
    );

    useEffect(
        () => () =>
            pads.forEach(({ mesh, material, original }) => {
                mesh.material = original;
                material.dispose();
            }),
        [pads],
    );

    useFrame(({ clock }) => {
        const { playing, loading } = getPad();
        const pulse = Math.exp(-padBeatPhase() * 6);
        pads.forEach(({ beat, material }) => {
            if (beat.id === playing) material.emissiveIntensity = LIT + PULSE * pulse;
            else if (beat.id === loading) material.emissiveIntensity = IDLE + (Math.sin(clock.elapsedTime * 12) > 0 ? 0.8 : 0);
            else material.emissiveIntensity = IDLE;
        });
    });

    return null;
};

export default DrumPad;
