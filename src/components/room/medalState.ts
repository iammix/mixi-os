import * as THREE from 'three';
import { medalRaceId } from './medals';

// The room's pointer handler (RoomScene) reports which medal is under the cursor; the medals
// (MedalHanger) read it every frame to set that one swinging.

let hovered: string | null = null;

export function setMedalHover(raceId: string | null) {
    hovered = raceId;
}

export const getMedalHover = () => hovered;

/** The race of the medal this object is part of (the object or one of its parents), if any. */
export const medalRaceIdOf = (object: THREE.Object3D | null): string | null => {
    for (let o = object; o; o = o.parent) {
        const id = medalRaceId(o.name);
        if (id) return id;
    }
    return null;
};
