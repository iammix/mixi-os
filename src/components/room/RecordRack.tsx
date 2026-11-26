import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Album, RACK_ALBUMS, coverUrl } from './albums';
import { RACK_ALBUM_PREFIX, RACK_SLEEVE, getRackHover, setRackHover, setRevealedRecord } from './rackState';

// The record rack under the turntable. The collection's records (RACK_ALBUMS) are filed in among
// the modelled sleeves, and pointing at the rack slides the sleeves out like the macOS Dock
// magnifies its icons: the one under the cursor comes out furthest - turned to show its cover if
// it's one of the records - and its neighbours less the further away they are.

// The two compartments of the console, split by the middle divider (world x, metres).
const DIVIDER_X = 1.18;
// The rack's shelf and the front edge the sleeves are flush with.
const SHELF_Y = 0.225;
const FRONT_Z = -1.265;
// As deep as the modelled sleeves, so the records line up with them at the front.
const LP = 0.33;
const SLEEVE_THICKNESS = 0.008;
// Records are filed in the left compartment, spread over the part you can see past the floor lamp
// (as fractions along it), the first one a little right of the middle.
const FILE_FROM = 0.35;
const FILE_TO = 0.95;

// How far the dock effect reaches either side of the cursor (metres), and how quickly it follows.
const REACH = 0.024;
// Records are thin targets among taller sleeves, so the cursor this close to one picks the record.
const SNAP = 0.03;
const FOLLOW = 12;
// What the sleeve under the cursor does at full strength.
const PULL = 0.13;
const RISE = 0.05;
const TURN = 0.3;
const RECORD_PULL = 0.24;
const RECORD_RISE = 0.07;
const RECORD_TURN = 0.8;
const RECORD_GROW = 0.15;

type Slot = {
    object: THREE.Object3D;
    rest: THREE.Vector3;
    restRotation: THREE.Euler;
    left: boolean;
    record: boolean;
    amount: number;
};

/** A square LP sleeve with the cover on both faces and a spine coloured from the artwork. */
function makeRecordSleeve(album: Album) {
    const spine = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.7 });
    const cover = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    cover.map = new THREE.TextureLoader().load(coverUrl(album), (texture) => {
        // Average the artwork down to one colour for the edges you see in the rack.
        const image = texture.image as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        spine.color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    });
    cover.map.colorSpace = THREE.SRGBColorSpace;
    cover.map.anisotropy = 8;
    // Box faces in three's order: +x and -x (the covers), +y, -y, +z (the spine, facing the room), -z.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(SLEEVE_THICKNESS, LP, LP), [cover, cover, spine, spine, spine, spine]);
    mesh.name = `${RACK_ALBUM_PREFIX}${album.id}`;
    mesh.userData.albumId = album.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/** File the records into the rack, replacing modelled sleeves; returns every sleeve in the rack. */
function buildRack(scene: THREE.Object3D) {
    const modelled: THREE.Object3D[] = [];
    scene.traverse((o) => {
        if (RACK_SLEEVE.test(o.name)) modelled.push(o);
    });
    modelled.sort((a, b) => a.position.x - b.position.x);
    const left = modelled.filter((o) => o.position.x < DIVIDER_X);

    const removed: THREE.Object3D[] = [];
    const added: THREE.Mesh[] = [];
    const sleeves = [...modelled];
    // Spread the records out along the left compartment (golden-ratio steps, so each new record
    // lands in a gap between the earlier ones).
    const taken = new Set<number>();
    RACK_ALBUMS.forEach((album, i) => {
        const fraction = FILE_FROM + ((0.5 + i * 0.618) % 1) * (FILE_TO - FILE_FROM);
        let index = Math.round(fraction * (left.length - 1));
        while (taken.has(index) && taken.size < left.length) index = (index + 1) % left.length;
        taken.add(index);
        const replaced = left[index];
        if (!replaced?.parent) return;
        const sleeve = makeRecordSleeve(album);
        sleeve.position.set(replaced.position.x, SHELF_Y + LP / 2, FRONT_Z - LP / 2);
        replaced.parent.add(sleeve);
        replaced.removeFromParent();
        removed.push(replaced);
        added.push(sleeve);
        sleeves.splice(sleeves.indexOf(replaced), 1, sleeve);
    });

    const slots: Slot[] = sleeves.map((object) => ({
        object,
        rest: object.position.clone(),
        restRotation: object.rotation.clone(),
        left: object.position.x < DIVIDER_X,
        record: added.includes(object as THREE.Mesh),
        amount: 0,
    }));

    const dispose = () => {
        slots.forEach((s) => {
            s.object.position.copy(s.rest);
            s.object.rotation.copy(s.restRotation);
            s.object.scale.setScalar(1);
        });
        added.forEach((sleeve, i) => {
            const parent = sleeve.parent;
            sleeve.removeFromParent();
            if (parent) parent.add(removed[i]);
            sleeve.geometry.dispose();
            new Set(sleeve.material as THREE.MeshStandardMaterial[]).forEach((m) => {
                m.map?.dispose();
                m.dispose();
            });
        });
    };
    return { slots, dispose };
}

const RecordRack: React.FC<{ scene: THREE.Object3D; zoomed: boolean }> = ({ scene, zoomed }) => {
    const rackRef = useRef<ReturnType<typeof buildRack> | null>(null);
    // Built in an effect so it's torn down and rebuilt cleanly (StrictMode runs effects twice).
    useEffect(() => {
        const built = buildRack(scene);
        rackRef.current = built;
        return () => {
            setRackHover(null);
            setRevealedRecord(undefined);
            rackRef.current = null;
            built.dispose();
        };
    }, [scene]);

    useFrame((_, rawDelta) => {
        const rack = rackRef.current;
        if (!rack) return;
        const delta = Math.min(rawDelta, 0.1);
        const hovered = zoomed ? null : getRackHover();
        let focus = hovered ? rack.slots.find((s) => s.object === hovered) : undefined;
        if (focus && !focus.record) {
            const near = rack.slots
                .filter((s) => s.record && s.left === focus!.left && Math.abs(s.rest.x - focus!.rest.x) < SNAP)
                .sort((a, b) => Math.abs(a.rest.x - focus!.rest.x) - Math.abs(b.rest.x - focus!.rest.x))[0];
            if (near) focus = near;
        }
        setRevealedRecord(focus?.record ? (focus.object.userData.albumId as string) : undefined);

        rack.slots.forEach((slot) => {
            let target = 0;
            if (focus && focus.left === slot.left) {
                const dx = (slot.rest.x - focus.rest.x) / REACH;
                target = Math.exp(-dx * dx);
            }
            slot.amount = THREE.MathUtils.damp(slot.amount, target, FOLLOW, delta);
            const a = slot.amount;
            const { object, rest, restRotation } = slot;
            if (slot.record) {
                // Slide the record out, lift it and turn its cover towards the room.
                object.position.set(rest.x, rest.y + a * RECORD_RISE, rest.z + a * RECORD_PULL);
                object.rotation.set(restRotation.x, restRotation.y - a * RECORD_TURN, restRotation.z);
                object.scale.setScalar(1 + a * RECORD_GROW);
            } else {
                object.position.set(rest.x, rest.y + a * RISE, rest.z + a * PULL);
                object.rotation.set(restRotation.x, restRotation.y - a * TURN, restRotation.z);
            }
        });
    });

    return null;
};

export default RecordRack;
