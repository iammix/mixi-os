import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyWeather, lookAt } from './skyLook';
import { daylight, roomNow, sunPosition } from './sun';
import { getWeather } from './weather';
import { WINDOW_PLACES, getWindowPlace } from './windowState';

// The room's lights follow the sun over the place outside the window: by day the light comes in
// through the window and the lamps are off; as it gets dark outside the room dims, the floor lamp,
// desk lamp and picture lights come on and the window light turns to cool moonlight. Each light
// blends between a day and a night setting by how much daylight there is (sun.ts); switching the
// window to the other city fades over a couple of seconds. Try it with ?time=13:00 or ?time=22:00.

type Setting = { day: number; night: number };
const between = ({ day, night }: Setting, t: number) => night + (day - night) * t;

// Intensities by day and by night (approximations of the Blender lights; Blender Z-up -> three.js
// Y-up: x, z, -y).
const HEMI = { day: 0.6, night: 0.15 };
const KEY = { day: 2.6, night: 1.0 };
const FILL = { day: 1.1, night: 0.4 };
const WINDOW = { day: 2.0, night: 0.55 };
const BACK = { day: 0.5, night: 0.25 };
const FLOOR_LAMP = { day: 0, night: 4 };
const DESK_LAMP = { day: 0, night: 1.1 };
const PICTURE_LIGHT = { day: 0.05, night: 0.32 };
const LAMP_GLOW = { day: 0, night: 2.4 };
const ENVIRONMENT = { day: 0.45, night: 0.25 };

const COLORS = {
    hemiSky: { day: new THREE.Color('#fff4e6'), night: new THREE.Color('#aab6e6') },
    hemiGround: { day: new THREE.Color('#4a3a2c'), night: new THREE.Color('#2a1f18') },
    key: { day: new THREE.Color('#fff0dc'), night: new THREE.Color('#ffb877') },
    fill: { day: new THREE.Color('#fff2e0'), night: new THREE.Color('#ffd4a3') },
    moon: new THREE.Color('#6f8fff'),
};

// Lamp shades whose glow follows the lamps (set up in RoomScene's MATERIAL_TWEAKS).
const LAMP_MATERIALS = /lamp diffuser|backlit linen/i;
// How quickly the room catches up with the light outside (per second).
const EASE = 1.2;
// How often to look at the sun again, in seconds.
const CHECK_EVERY = 30;

const RoomLights: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const { gl, scene: root } = useThree();
    const hemi = useRef<THREE.HemisphereLight>(null);
    const key = useRef<THREE.DirectionalLight>(null);
    const fill = useRef<THREE.DirectionalLight>(null);
    const windowLight = useRef<THREE.DirectionalLight>(null);
    const back = useRef<THREE.DirectionalLight>(null);
    const floorLamp = useRef<THREE.PointLight>(null);
    const deskLamp = useRef<THREE.PointLight>(null);
    const pictureLights = useRef<(THREE.PointLight | null)[]>([]);
    const state = useRef({ shown: -1, target: 1, sunColor: new THREE.Color('#ffffff'), checked: -Infinity, place: getWindowPlace() });

    // Soft image-based light so metals and glossy surfaces have something to reflect.
    useEffect(() => {
        const pmrem = new THREE.PMREMGenerator(gl);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        root.environment = env;
        root.environmentIntensity = ENVIRONMENT.night;
        return () => {
            root.environment = null;
            env.dispose();
            pmrem.dispose();
        };
    }, [gl, root]);

    const lampMaterials = useMemo(() => {
        const found = new Set<THREE.MeshStandardMaterial>();
        scene.traverse((o) => {
            const material = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if ((o as THREE.Mesh).isMesh && material && LAMP_MATERIALS.test(material.name)) found.add(material);
        });
        return [...found];
    }, [scene]);

    useFrame(({ clock }, rawDelta) => {
        const s = state.current;
        const delta = Math.min(rawDelta, 0.1);
        const place = getWindowPlace();

        // Look at the sun now and then, and straight away when the window changes place.
        if (clock.elapsedTime - s.checked > CHECK_EVERY || place !== s.place) {
            s.checked = clock.elapsedTime;
            s.place = place;
            const { lat, lon } = WINDOW_PLACES[place];
            const weather = getWeather(place);
            const sun = sunPosition(roomNow(), lat, lon);
            s.target = daylight(sun.elevation, weather.cloud);
            // The light through the window takes the sky's colour: golden at sunset, white at noon.
            s.sunColor.set(applyWeather(lookAt(sun.elevation), weather).tint);
        }
        // The first frame jumps straight there; after that the room eases towards it.
        s.shown = s.shown < 0 ? s.target : s.shown + (s.target - s.shown) * (1 - Math.exp(-EASE * delta));
        const t = s.shown;

        if (hemi.current) {
            hemi.current.intensity = between(HEMI, t);
            hemi.current.color.lerpColors(COLORS.hemiSky.night, COLORS.hemiSky.day, t);
            hemi.current.groundColor.lerpColors(COLORS.hemiGround.night, COLORS.hemiGround.day, t);
        }
        if (key.current) {
            key.current.intensity = between(KEY, t);
            key.current.color.lerpColors(COLORS.key.night, COLORS.key.day, t);
        }
        if (fill.current) {
            fill.current.intensity = between(FILL, t);
            fill.current.color.lerpColors(COLORS.fill.night, COLORS.fill.day, t);
        }
        if (windowLight.current) {
            windowLight.current.intensity = between(WINDOW, t);
            windowLight.current.color.lerpColors(COLORS.moon, s.sunColor, t);
        }
        if (back.current) back.current.intensity = between(BACK, t);
        if (floorLamp.current) floorLamp.current.intensity = between(FLOOR_LAMP, t);
        if (deskLamp.current) deskLamp.current.intensity = between(DESK_LAMP, t);
        pictureLights.current.forEach((l) => l && (l.intensity = between(PICTURE_LIGHT, t)));
        lampMaterials.forEach((m) => (m.emissiveIntensity = between(LAMP_GLOW, t)));
        root.environmentIntensity = between(ENVIRONMENT, t);
    });

    return (
        <>
            <hemisphereLight ref={hemi} args={['#ffe9d2', '#3a2a20', HEMI.night]} />
            <directionalLight
                ref={key}
                position={[1, 6, 3]}
                color="#ffc78c"
                intensity={KEY.night}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0004}
                shadow-normalBias={0.02}
                shadow-camera-left={-4}
                shadow-camera-right={4}
                shadow-camera-top={4}
                shadow-camera-bottom={-4}
                shadow-camera-near={0.5}
                shadow-camera-far={15}
            />
            <directionalLight ref={fill} position={[2, 5, 4]} color="#ffd4a3" intensity={FILL.night} />
            <directionalLight ref={windowLight} position={[-3.8, 4, -0.6]} color="#7aa0ff" intensity={WINDOW.night} />
            <directionalLight ref={back} position={[4, 4, -2]} color="#b3c9ff" intensity={BACK.night} />
            <pointLight ref={floorLamp} position={[1.8, 1.49, 0.74]} color="#ff9138" intensity={FLOOR_LAMP.night} distance={4} decay={2} />
            <pointLight ref={deskLamp} position={[-0.36, 1.08, -1.52]} color="#ffa64d" intensity={DESK_LAMP.night} distance={1.5} decay={2} />
            {[0.64, 1.18, 1.72].map((x, i) => (
                <pointLight
                    key={x}
                    ref={(l) => (pictureLights.current[i] = l)}
                    position={[x, 1.86, -1.5]}
                    color="#ffa152"
                    intensity={PICTURE_LIGHT.night}
                    distance={1}
                    decay={2}
                />
            ))}
        </>
    );
};

export default RoomLights;
