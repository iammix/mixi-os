import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPrecipitation } from './Precipitation';

describe('createPrecipitation', () => {
    it('never catches pointer rays, so room clicks go through it', () => {
        const { points, dispose } = createPrecipitation(100);
        points.updateMatrixWorld();
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 5), new THREE.Vector3(0, -1, -1).normalize());
        expect(ray.intersectObject(points)).toHaveLength(0);
        dispose();
    });
});
