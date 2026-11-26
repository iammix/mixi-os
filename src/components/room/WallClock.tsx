import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clockAngles, timeIn } from './clock';
import { WINDOW_PLACES, getWindowPlace } from './windowState';

// The clock on the back wall (scripts/build_wall_clock.py) keeps the time of wherever the window
// looks out on. Switching the window between Rotterdam and Thessaloniki sweeps the hour hand round
// by the hour between them.

// The hands, after GLTFLoader turns spaces into underscores. Each pivots on the clock's centre and
// points at 12 unrotated.
const HANDS = { hours: 'Clock_hour_hand', minutes: 'Clock_minute_hand', seconds: 'Clock_second_hand' } as const;
// How quickly the hour hand catches up after the window is switched.
const SWEEP = 5;
const TAU = Math.PI * 2;

/** The shortest signed turn from angle `a` to angle `b`. */
const turn = (a: number, b: number) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;

const WallClock: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const hands = useMemo(
        () => ({
            hours: scene.getObjectByName(HANDS.hours),
            minutes: scene.getObjectByName(HANDS.minutes),
            seconds: scene.getObjectByName(HANDS.seconds),
        }),
        [scene],
    );
    const hourShown = useRef<number | null>(null);

    useFrame((_, rawDelta) => {
        const delta = Math.min(rawDelta, 0.1);
        const angles = clockAngles(timeIn(new Date(), WINDOW_PLACES[getWindowPlace()].timeZone));
        // The hour hand eases round when the place changes; otherwise it is simply where it should be.
        const shown = hourShown.current ?? angles.hours;
        hourShown.current = shown + turn(shown, angles.hours) * (1 - Math.exp(-SWEEP * delta));
        // The clock faces the room (+z); clockwise as seen from there is a negative turn about z.
        if (hands.hours) hands.hours.rotation.z = -hourShown.current;
        if (hands.minutes) hands.minutes.rotation.z = -angles.minutes;
        if (hands.seconds) hands.seconds.rotation.z = -angles.seconds;
    });

    return null;
};

export default WallClock;
