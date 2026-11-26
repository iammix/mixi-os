import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getNowPlaying, playNext } from './musicState';
import { paintingFor } from './paintings';
import { opensRaceCalendar } from './races';
import { isInWindowView, isWindow, toggleWindowPlace } from './windowState';
import WindowView from './WindowView';
import Books from './Books';
import { CoffeeSteam, RecordPlayerAndSpeakers } from './RoomAnimations';
import { getScreenSize, setScreenAspect } from './screenSpace';
import RecordRack from './RecordRack';
import RoomLights from './RoomLights';
import Vinyls from './Vinyls';
import { getRevealedRecord, isRackSleeve, rackAlbumOf, setRackHover } from './rackState';
import TrainingBoard from './TrainingBoard';
import { isTrainingBoard } from './training';
import WallClock from './WallClock';
import DrumPad from './DrumPad';
import { isDrumPad } from './beats';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/room.glb`;
const DRACO_URL = `${import.meta.env.BASE_URL}draco/`;

// Names of the Blender objects we rely on (GLTFLoader turns spaces into underscores).
const HERO_CAMERA_NAME = 'Hero_isometric';
const SCREEN_NAME = 'Monitor_display';
const STUDIO_GROUND_NAME = 'Studio_ground';
const SCREEN_CONTENT = /Code_editor_line|Editor_sidebar/;
// The Merida Reacto and its wall hanger are all parented to this empty (see scripts/build_reacto.py).
const BIKE_ROOT = 'Merida_Reacto_bike';
const BIKE_URL = 'https://www.strava.com/athletes/32111789';
// A press that moves further than this is a drag to look around, not a click.
const CLICK_TOLERANCE = 6;

// Stand-ins for Blender shader nodes that glTF can't carry (see scripts/export_room.py).
const MATERIAL_TWEAKS: [RegExp, (m: THREE.MeshStandardMaterial) => void][] = [
    // Hue/Saturation "Value" boost on the oak textures.
    [/oak floor tone/i, (m) => m.color.setScalar(1.5)],
    [/natural oak/i, (m) => m.color.setScalar(1.25)],
    // Display panel behind the app; kept black so nothing glows through at its edges.
    [/display dark editor/i, (m) => {
        m.color.set('#000000');
        m.emissive.set('#000000');
        m.roughness = 1;
        m.envMapIntensity = 0;
    }],
    [/lamp diffuser|backlit linen/i, (m) => {
        m.emissive.set('#ff9a45');
        m.emissiveIntensity = 2.2;
    }],
    // Window glass: plain see-through glass instead of transmission, which renders what's behind
    // it at low resolution and blurs the view outside.
    [/^window glass$/i, (m) => {
        (m as THREE.MeshPhysicalMaterial).transmission = 0;
        m.transparent = true;
        m.opacity = 0.1;
        m.depthWrite = false;
    }],
];

// Blender's ortho_scale for the hero camera.
const HERO_VIEW_SIZE = 6.65;
// How far in front of the monitor the camera ends up: close enough to keep the keyboard in
// frame, but in front of the desk chair so it doesn't block the screen.
const SCREEN_CAMERA_DISTANCE = 0.7;
// Breathing room around the monitor at full zoom, so it still reads as a monitor on a desk.
const SCREEN_MARGIN = 1.35;
const ZOOM_DURATION = 1.8;

// How far visitors can turn the room by dragging (radians), and how strongly a drag turns it.
const MAX_YAW = 0.45;
const MAX_PITCH = 0.12;
const DRAG_SPEED = 0.004;

const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Pose = {
    target: THREE.Vector3;
    quaternion: THREE.Quaternion;
    distance: number;
};

function findByName(root: THREE.Object3D, name: string) {
    let found: THREE.Object3D | undefined;
    root.traverse((o) => {
        if (!found && o.name.includes(name)) found = o;
    });
    return found;
}

function useRoomPoses(scene: THREE.Group) {
    return useMemo(() => {
        scene.updateMatrixWorld(true);

        // Hero pose: copy the isometric camera from the .blend file.
        const heroNode = findByName(scene, HERO_CAMERA_NAME);
        let heroCam: THREE.Object3D | undefined;
        heroNode?.traverse((o) => {
            if (!heroCam && (o as THREE.Camera).isCamera) heroCam = o;
        });
        const heroPos = new THREE.Vector3(6.7, 6.6, 8.9);
        const heroQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-0.4567, 0.5569, 0.2516, 'YXZ'),
        );
        if (heroCam) {
            heroCam.getWorldPosition(heroPos);
            heroCam.getWorldQuaternion(heroQuat);
        }
        const heroForward = new THREE.Vector3(0, 0, -1).applyQuaternion(heroQuat);
        // Aim at the point on the view ray closest to the room's origin.
        const heroDistance = -heroPos.dot(heroForward);
        const hero: Pose = {
            target: heroPos.clone().addScaledVector(heroForward, heroDistance),
            quaternion: heroQuat,
            distance: heroDistance,
        };

        // Screen pose: face the monitor display head-on (it faces +Z in three.js space).
        const screenMesh = findByName(scene, SCREEN_NAME);
        const box = screenMesh
            ? new THREE.Box3().setFromObject(screenMesh)
            : new THREE.Box3(
                  new THREE.Vector3(-1.392, 0.95, -1.598),
                  new THREE.Vector3(-0.668, 1.35, -1.594),
              );
        const screenSize = box.getSize(new THREE.Vector3());
        const screen: Pose = {
            target: box.getCenter(new THREE.Vector3()),
            quaternion: new THREE.Quaternion(),
            distance: SCREEN_CAMERA_DISTANCE,
        };

        return { hero, screen, screenSize };
    }, [scene]);
}

/** Gives the app the monitor's aspect ratio once the model has loaded. */
function useScreenAspect(screenSize: THREE.Vector3) {
    useEffect(() => {
        if (screenSize.x > 0 && screenSize.y > 0) setScreenAspect(screenSize.x / screenSize.y);
    }, [screenSize]);
}

type CameraRigProps = {
    zoomed: boolean;
    hero: Pose;
    screen: Pose;
    screenSize: THREE.Vector3;
    screenOverlay: React.RefObject<HTMLDivElement>;
    onArrive: (zoomed: boolean) => void;
};

const CameraRig: React.FC<CameraRigProps> = ({ zoomed, hero, screen, screenSize, screenOverlay, onArrive }) => {
    const camRef = useRef<THREE.OrthographicCamera>(null);
    const progress = useRef(0);
    const notified = useRef<boolean | null>(false);
    const size = useThree((s) => s.size);
    const gl = useThree((s) => s.gl);
    const orbit = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 });
    const zoomedRef = useRef(zoomed);
    zoomedRef.current = zoomed;

    // Drag to turn the room a little (only while zoomed out).
    useEffect(() => {
        const el = gl.domElement;
        let last: { x: number; y: number } | null = null;
        const down = (e: PointerEvent) => {
            if (zoomedRef.current) return;
            last = { x: e.clientX, y: e.clientY };
            el.setPointerCapture(e.pointerId);
            el.style.cursor = 'grabbing';
        };
        const move = (e: PointerEvent) => {
            if (!last) return;
            const o = orbit.current;
            o.targetYaw = THREE.MathUtils.clamp(o.targetYaw - (e.clientX - last.x) * DRAG_SPEED, -MAX_YAW, MAX_YAW);
            o.targetPitch = THREE.MathUtils.clamp(o.targetPitch - (e.clientY - last.y) * DRAG_SPEED, -MAX_PITCH, MAX_PITCH);
            last = { x: e.clientX, y: e.clientY };
        };
        const up = (e: PointerEvent) => {
            last = null;
            if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
            el.style.cursor = '';
        };
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        return () => {
            el.removeEventListener('pointerdown', down);
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
        };
    }, [gl]);

    const tmp = useMemo(
        () => ({
            target: new THREE.Vector3(),
            quat: new THREE.Quaternion(),
            back: new THREE.Vector3(),
            orbitQuat: new THREE.Quaternion(),
            yawAxis: new THREE.Vector3(0, 1, 0),
            pitchAxis: new THREE.Vector3(1, 0, 0),
            tl: new THREE.Vector3(),
            tr: new THREE.Vector3(),
            bl: new THREE.Vector3(),
        }),
        [],
    );

    useEffect(() => {
        notified.current = null;
    }, [zoomed]);

    useFrame((_, delta) => {
        const cam = camRef.current;
        if (!cam) return;

        const goal = zoomed ? 1 : 0;
        const step = Math.min(delta, 0.05) / ZOOM_DURATION;
        progress.current =
            goal > progress.current
                ? Math.min(goal, progress.current + step)
                : Math.max(goal, progress.current - step);
        if (progress.current === goal && notified.current !== zoomed) {
            notified.current = zoomed;
            onArrive(zoomed);
        }

        const e = easeInOutCubic(progress.current);
        const aspect = size.width / size.height;

        // Hero: fit the whole Blender frame. Screen: the monitor plus a margin around it.
        const heroH = aspect >= 1 ? HERO_VIEW_SIZE : HERO_VIEW_SIZE / aspect;
        const screenH = Math.max(screenSize.y, screenSize.x / aspect) * SCREEN_MARGIN;
        const viewH = Math.exp(THREE.MathUtils.lerp(Math.log(heroH), Math.log(screenH), e));

        // Ease the drag rotation, and fade it out as we zoom in.
        const o = orbit.current;
        if (zoomed) {
            o.targetYaw = 0;
            o.targetPitch = 0;
        }
        const damp = 1 - Math.exp(-Math.min(delta, 0.05) * 8);
        o.yaw += (o.targetYaw - o.yaw) * damp;
        o.pitch += (o.targetPitch - o.pitch) * damp;
        tmp.orbitQuat.setFromAxisAngle(tmp.yawAxis, o.yaw * (1 - e));
        tmp.quat.copy(hero.quaternion).premultiply(tmp.orbitQuat);
        tmp.orbitQuat.setFromAxisAngle(tmp.pitchAxis, o.pitch * (1 - e));
        tmp.quat.multiply(tmp.orbitQuat);

        tmp.target.lerpVectors(hero.target, screen.target, e);
        tmp.quat.slerp(screen.quaternion, e);
        const distance = THREE.MathUtils.lerp(hero.distance, screen.distance, e);
        tmp.back.set(0, 0, 1).applyQuaternion(tmp.quat);

        cam.position.copy(tmp.target).addScaledVector(tmp.back, distance);
        cam.quaternion.copy(tmp.quat);
        cam.left = (-viewH * aspect) / 2;
        cam.right = (viewH * aspect) / 2;
        cam.top = viewH / 2;
        cam.bottom = -viewH / 2;
        cam.zoom = 1;
        cam.near = 0.02;
        cam.far = distance + 30;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();

        // Pin the app's DOM element (rendered at the monitor's own resolution) onto the display.
        const overlay = screenOverlay.current;
        if (overlay) {
            const px = getScreenSize();
            const w = screenSize.x;
            const h = screenSize.y;
            const c = screen.target;
            const toPx = (v: THREE.Vector3) => {
                v.project(cam);
                v.set(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, 0);
                return v;
            };
            const tl = toPx(tmp.tl.set(c.x - w / 2, c.y + h / 2, c.z));
            const tr = toPx(tmp.tr.set(c.x + w / 2, c.y + h / 2, c.z));
            const bl = toPx(tmp.bl.set(c.x - w / 2, c.y - h / 2, c.z));
            overlay.style.transform = `matrix(${(tr.x - tl.x) / px.width}, ${(tr.y - tl.y) / px.width}, ${
                (bl.x - tl.x) / px.height
            }, ${(bl.y - tl.y) / px.height}, ${tl.x}, ${tl.y})`;
            overlay.style.visibility = 'visible';
        }
    });

    return <OrthographicCamera ref={camRef} makeDefault manual />;
};

type RoomSceneProps = {
    zoomed: boolean;
    screenOverlay: React.RefObject<HTMLDivElement>;
    onArrive: (zoomed: boolean) => void;
    onBooksClick: () => void;
    /** An album was clicked; `undefined` means the shelf as a whole (opens on what's playing). */
    onAlbumClick: (albumId?: string) => void;
    /** One of the paintings on the wall was clicked. */
    onPaintingClick: (paintingId: string) => void;
    /** The tri bag (or the goggles and cap on it) was clicked: open the race calendar. */
    onRacesClick: () => void;
    /** The cork board above the bike was clicked: show it up close. */
    onTrainingClick: () => void;
    /** The drum pad by the turntable was clicked: open it up close. */
    onPadClick: () => void;
};

type Clickable =
    | { kind: 'bike' }
    | { kind: 'album'; album?: string }
    | { kind: 'painting'; painting: string }
    | { kind: 'races' }
    | { kind: 'training' }
    | { kind: 'speaker' }
    | { kind: 'pad' }
    | { kind: 'window' };

/** What clicking this part of the room does, if anything. */
const clickableFor = (object: THREE.Object3D | null): Clickable | null => {
    for (let o = object; o; o = o.parent) {
        if (o.name === BIKE_ROOT) return { kind: 'bike' };
        if (opensRaceCalendar(o.name)) return { kind: 'races' };
        if (isTrainingBoard(o.name)) return { kind: 'training' };
        if (isDrumPad(o.name)) return { kind: 'pad' };
        // Either speaker (its parts, or the group RoomAnimations puts them in) skips to the next song.
        if (/^Speaker[ _]/.test(o.name)) return { kind: 'speaker' };
        if (isWindow(o.name)) return { kind: 'window' };
        const painting = paintingFor(o.name);
        if (painting) return { kind: 'painting', painting };
        // The records filed in the rack open their own tracklist; the other sleeves open the crate.
        const racked = rackAlbumOf(o);
        if (racked) return { kind: 'album', album: racked };
        if (isRackSleeve(o)) return { kind: 'album', album: getRevealedRecord() };
        // The record on the turntable (grouped in RoomAnimations) shows what's playing.
        if (o.name === 'Record disc') return { kind: 'album', album: getNowPlaying().albumId };
    }
    return null;
};

const RoomScene: React.FC<RoomSceneProps> = ({ zoomed, screenOverlay, onArrive, onBooksClick, onAlbumClick, onPaintingClick, onRacesClick, onTrainingClick, onPadClick }) => {
    const { scene } = useGLTF(MODEL_URL, DRACO_URL);
    const { hero, screen, screenSize } = useRoomPoses(scene);
    useScreenAspect(screenSize);
    const canvas = useThree((s) => s.gl.domElement);

    // While looking around the room, the bike links to Strava, the records open their tracklists,
    // the paintings open their stories, the tri bag unfolds the race calendar, the cork board
    // comes up close, the speakers skip to the next song, the drum pad opens up and the window
    // switches between home and Rotterdam.
    const onRoomHover = useCallback(
        (e: ThreeEvent<PointerEvent>) => {
            // Only the nearest hit counts, not whatever is behind it.
            e.stopPropagation();
            canvas.style.cursor = !zoomed && clickableFor(e.object) ? 'pointer' : '';
            // Pointing at the record rack slides its sleeves out (see RecordRack).
            setRackHover(!zoomed && isRackSleeve(e.object) ? e.object : null);
        },
        [canvas, zoomed],
    );
    const onRoomLeave = useCallback(() => {
        canvas.style.cursor = '';
        setRackHover(null);
    }, [canvas]);
    const onRoomClick = useCallback(
        (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (zoomed || e.delta > CLICK_TOLERANCE) return;
            const target = clickableFor(e.object);
            if (target?.kind === 'bike') window.open(BIKE_URL, '_blank', 'noopener,noreferrer');
            else if (target?.kind === 'album') onAlbumClick(target.album);
            else if (target?.kind === 'painting') onPaintingClick(target.painting);
            else if (target?.kind === 'races') onRacesClick();
            else if (target?.kind === 'training') onTrainingClick();
            else if (target?.kind === 'speaker') playNext();
            else if (target?.kind === 'pad') onPadClick();
            else if (target?.kind === 'window') toggleWindowPlace();
        },
        [zoomed, onAlbumClick, onPaintingClick, onRacesClick, onTrainingClick, onPadClick],
    );

    useEffect(() => {
        const shadowCatcher = new THREE.ShadowMaterial({ opacity: 0.35 });
        scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            // The app is shown on the monitor instead of the modelled code editor.
            if (SCREEN_CONTENT.test(mesh.name)) {
                mesh.visible = false;
                return;
            }
            // The view outside sits behind the wall: it neither casts nor catches the room's shadows.
            if (isInWindowView(mesh)) return;
            mesh.castShadow = !/glass/i.test(mesh.name);
            mesh.receiveShadow = true;

            // The studio floor becomes shadow-only so the CSS backdrop shows through.
            if (mesh.name.includes(STUDIO_GROUND_NAME)) {
                mesh.material = shadowCatcher;
                return;
            }
            const material = mesh.material as THREE.MeshStandardMaterial;
            const tweak = MATERIAL_TWEAKS.find(([pattern]) => pattern.test(material.name));
            tweak?.[1](material);
        });
        return () => shadowCatcher.dispose();
    }, [scene]);

    return (
        <>
            <RoomLights scene={scene} />
            <primitive object={scene} onPointerMove={onRoomHover} onPointerOut={onRoomLeave} onClick={onRoomClick} />
            <RecordPlayerAndSpeakers scene={scene} />
            <CoffeeSteam scene={scene} />
            <Books scene={scene} zoomed={zoomed} onSelect={onBooksClick} />
            <Vinyls zoomed={zoomed} onSelect={onAlbumClick} />
            <RecordRack scene={scene} zoomed={zoomed} />
            <WallClock scene={scene} />
            <TrainingBoard scene={scene} />
            <DrumPad scene={scene} />
            <WindowView scene={scene} />
            <CameraRig
                zoomed={zoomed}
                hero={hero}
                screen={screen}
                screenSize={screenSize}
                screenOverlay={screenOverlay}
                onArrive={onArrive}
            />
        </>
    );
};

useGLTF.preload(MODEL_URL, DRACO_URL);

export default RoomScene;
