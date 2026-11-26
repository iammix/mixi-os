import * as THREE from 'three';

// Where the views outside the window sit, shared by WindowView and the weather drawn in them.

// The window in three's coordinates (Blender x, z, -y), and the rings the view is built on.
export const CENTER = new THREE.Vector2(-2.24, -0.85);
export const SKY_R = 3.15;
export const PHI_RANGE: [number, number] = [-12, 88];
// Height of the sky's horizon and top as seen through the window.
export const SKY_LOW = 0.6;
export const SKY_HIGH = 1.35;
// Height of the water and the ground in the views.
export const GROUND = 0.42;

// Only draw where the window opening wrote 1 into the stencil buffer.
export const STENCIL = {
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
};
