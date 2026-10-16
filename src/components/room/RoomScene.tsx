import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CoffeeSteam, RecordPlayerAndSpeakers } from './RoomAnimations';

export const MODEL_URL = '/models/room.glb';
const DRACO_URL = '/draco/';

// Names of the Blender objects we rely on (GLTFLoader turns spaces into underscores).
const HERO_CAMERA_NAME = 'Hero_isometric';
const SCREEN_NAME = 'Monitor_display';
const STUDIO_GROUND_NAME = 'Studio_ground';
const SCREEN_CONTENT = /Code_editor_line|Editor_sidebar/;

// Stand-ins for Blender shader nodes that glTF can't carry (see scripts/export_room.py).
const MATERIAL_TWEAKS: [RegExp, (m: THREE.MeshStandardMaterial) => void][] = [
    // Hue/Saturation "Value" boost on the oak textures.
    [/oak floor tone/i, (m) => m.color.setScalar(1.5)],
    [/natural oak/i, (m) => m.color.setScalar(1.25)],
    // Turned-off panel around the app (visible when the browser's aspect differs from the monitor's).
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

        // Pin the app's DOM element (viewport-sized) onto the monitor, fitted inside the display
        // with the viewport's aspect ratio so the app's layout isn't stretched.
        const overlay = screenOverlay.current;
        if (overlay) {
            const h = Math.min(screenSize.y, screenSize.x / aspect);
            const w = h * aspect;
            const c = screen.target;
            const toPx = (v: THREE.Vector3) => {
                v.project(cam);
                v.set(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, 0);
                return v;
            };
            const tl = toPx(tmp.tl.set(c.x - w / 2, c.y + h / 2, c.z));
            const tr = toPx(tmp.tr.set(c.x + w / 2, c.y + h / 2, c.z));
            const bl = toPx(tmp.bl.set(c.x - w / 2, c.y - h / 2, c.z));
            overlay.style.transform = `matrix(${(tr.x - tl.x) / size.width}, ${(tr.y - tl.y) / size.width}, ${
                (bl.x - tl.x) / size.height
            }, ${(bl.y - tl.y) / size.height}, ${tl.x}, ${tl.y})`;
            overlay.style.visibility = 'visible';
        }
    });

    return <OrthographicCamera ref={camRef} makeDefault manual />;
};

const Lights: React.FC = () => {
    const { gl, scene } = useThree();

    // Soft image-based light so metals and glossy surfaces have something to reflect.
    useEffect(() => {
        const pmrem = new THREE.PMREMGenerator(gl);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.35;
        return () => {
            scene.environment = null;
            env.dispose();
            pmrem.dispose();
        };
    }, [gl, scene]);

    // Approximations of the Blender lights (Blender Z-up -> three.js Y-up: x, z, -y).
    return (
        <>
            <hemisphereLight args={['#ffe9d2', '#3a2a20', 0.35]} />
            <directionalLight
                position={[1, 6, 3]}
                color="#ffc78c"
                intensity={2.4}
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
            <directionalLight position={[2, 5, 4]} color="#ffd4a3" intensity={1.0} />
            <directionalLight position={[-3.8, 4, -0.6]} color="#7aa0ff" intensity={0.7} />
            <directionalLight position={[4, 4, -2]} color="#b3c9ff" intensity={0.35} />
            <pointLight position={[1.8, 1.49, 0.74]} color="#ff9138" intensity={3} distance={4} decay={2} />
            <pointLight position={[-0.36, 1.08, -1.52]} color="#ffa64d" intensity={0.8} distance={1.5} decay={2} />
            {[0.64, 1.18, 1.72].map((x) => (
                <pointLight key={x} position={[x, 1.86, -1.5]} color="#ffa152" intensity={0.25} distance={1} decay={2} />
            ))}
        </>
    );
};

type RoomSceneProps = {
    zoomed: boolean;
    screenOverlay: React.RefObject<HTMLDivElement>;
    onArrive: (zoomed: boolean) => void;
};

const RoomScene: React.FC<RoomSceneProps> = ({ zoomed, screenOverlay, onArrive }) => {
    const { scene } = useGLTF(MODEL_URL, DRACO_URL);
    const { hero, screen, screenSize } = useRoomPoses(scene);

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
            <Lights />
            <primitive object={scene} />
            <RecordPlayerAndSpeakers scene={scene} />
            <CoffeeSteam scene={scene} />
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
