import * as THREE from 'three';

// The room's pointer handler (RoomScene) reports which sleeve in the record rack is under the
// cursor; the rack (RecordRack) reads it every frame to slide the sleeves out dock-style.

/** Model sleeves in the console rack ("LP sleeve 00", "LP sleeve B12"... after GLTFLoader renaming). */
export const RACK_SLEEVE = /^LP_sleeve_/;
/** Names of the album sleeves the rack adds itself (see RecordRack). */
export const RACK_ALBUM_PREFIX = 'Rack album ';

let hovered: THREE.Object3D | null = null;

export function setRackHover(object: THREE.Object3D | null) {
    hovered = object;
}

export const getRackHover = () => hovered;

// The record the rack has pulled out for the cursor (it snaps to records near the cursor), so a
// click opens the record you can see rather than the plain sleeve technically under the pointer.
let revealed: string | undefined;

export function setRevealedRecord(albumId: string | undefined) {
    revealed = albumId;
}

export const getRevealedRecord = () => revealed;

/** The album a rack sleeve holds, if it's one of the collection's (not a decorative sleeve). */
export const rackAlbumOf = (object: THREE.Object3D): string | undefined =>
    object.name.startsWith(RACK_ALBUM_PREFIX) ? (object.userData.albumId as string) : undefined;

export const isRackSleeve = (object: THREE.Object3D) => RACK_SLEEVE.test(object.name) || rackAlbumOf(object) !== undefined;
