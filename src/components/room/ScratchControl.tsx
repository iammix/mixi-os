import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { angleBetween, endScratch, isScratching, scratchBy, setRecordGrabbed, startScratch } from './scratch';

// Grab the record on the turntable and turn it by hand (scratch.ts). A press on the turntable (the
// record, the platter or the deck round it: the record alone is small from across the room) takes
// hold of it (so the room doesn't turn instead); once the pointer moves a little it's a scratch, and
// every frame the record turns by however far the pointer has gone round the spindle. A quick press
// without moving is still a click, which opens the tracklist as before.

// How far (pixels) the pointer moves before a press on the record becomes a scratch.
const SCRATCH_AFTER = 5;

const ScratchControl: React.FC<{ scene: THREE.Object3D; zoomed: boolean }> = ({ scene, zoomed }) => {
    const { camera, gl } = useThree();
    const zoomedRef = useRef(zoomed);
    zoomedRef.current = zoomed;
    const tools = useMemo(() => ({ raycaster: new THREE.Raycaster(), ndc: new THREE.Vector2(), hit: new THREE.Vector3(), plane: new THREE.Plane() }), []);
    const grab = useRef<{ id: number; x: number; y: number; angle: number; latest: number } | null>(null);

    useEffect(() => {
        const el = gl.domElement;
        const disc = () => scene.getObjectByName('Record disc');
        // What can be grabbed: the record, the platter under it and the turntable's deck and plinth.
        const grabbable = () =>
            ['Record disc', 'Record spin', 'Turntable_top_deck', 'Turntable_walnut_plinth']
                .map((n) => scene.getObjectByName(n))
                .filter((o): o is THREE.Object3D => !!o);

        /** The pointer's angle round the spindle, on the plane of the record (null if it misses). */
        const angleAt = (e: PointerEvent) => {
            const record = disc();
            if (!record) return null;
            const rect = el.getBoundingClientRect();
            tools.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
            tools.raycaster.setFromCamera(tools.ndc, camera);
            const centre = record.getWorldPosition(new THREE.Vector3());
            tools.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), centre);
            if (!tools.raycaster.ray.intersectPlane(tools.plane, tools.hit)) return null;
            return Math.atan2(tools.hit.z - centre.z, tools.hit.x - centre.x);
        };

        const down = (e: PointerEvent) => {
            const record = disc();
            if (zoomedRef.current || !record || e.button !== 0) return;
            const rect = el.getBoundingClientRect();
            tools.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
            tools.raycaster.setFromCamera(tools.ndc, camera);
            if (!tools.raycaster.intersectObjects(grabbable(), true).length) return;
            const angle = angleAt(e);
            if (angle === null) return;
            grab.current = { id: e.pointerId, x: e.clientX, y: e.clientY, angle, latest: angle };
            // Runs before the room's own drag-to-look (capture phase), which checks this and stands aside.
            setRecordGrabbed(true);
        };
        const move = (e: PointerEvent) => {
            const g = grab.current;
            if (!g || e.pointerId !== g.id) return;
            const angle = angleAt(e);
            if (angle !== null) g.latest = angle;
            if (!isScratching() && Math.hypot(e.clientX - g.x, e.clientY - g.y) > SCRATCH_AFTER) {
                el.setPointerCapture(e.pointerId);
                el.style.cursor = 'grabbing';
                startScratch();
            }
        };
        const up = (e: PointerEvent) => {
            const g = grab.current;
            if (!g || e.pointerId !== g.id) return;
            grab.current = null;
            setRecordGrabbed(false);
            if (isScratching()) {
                endScratch();
                el.style.cursor = '';
                if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
            }
        };
        el.addEventListener('pointerdown', down, true);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        return () => {
            el.removeEventListener('pointerdown', down, true);
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            setRecordGrabbed(false);
            if (isScratching()) endScratch();
        };
    }, [camera, gl, scene, tools]);

    // Every frame, turn the record by however far the hand has gone round the spindle since the last
    // (nothing, if it's holding still: that stops the record).
    useFrame((_, delta) => {
        const g = grab.current;
        if (!g || !isScratching()) return;
        // Increasing angle (in three.js, from +x towards +z) is clockwise seen from above: forwards.
        const turn = angleBetween(g.angle, g.latest);
        g.angle = g.latest;
        scratchBy(turn, Math.max(delta, 1 / 240));
    });

    return null;
};

export default ScratchControl;
