import React, { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// The framed sleeves on the wall above the record shelf, left to right. Each modelled cover keeps its
// frame and picture light; only the artwork is swapped. Art from the Cover Art Archive (coverartarchive.org).
const COVERS = [
    { mesh: 'Illmatic_framed_cover', art: 'covers/blueprint.jpg' }, // JAY-Z - The Blueprint
    { mesh: 'All_Eyez_On_Me_framed_cover', art: 'covers/its-been-awful.jpg' }, // Isaiah Rashad - IT'S BEEN AWFUL
    { mesh: '36_Chambers_framed_cover', art: 'covers/damn.jpg' }, // Kendrick Lamar - DAMN.
];

const ART_URLS = COVERS.map((c) => `${import.meta.env.BASE_URL}${c.art}`);

const AlbumCovers: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const textures = useTexture(ART_URLS);

    useEffect(() => {
        const restore: (() => void)[] = [];
        COVERS.forEach(({ mesh: name }, i) => {
            const mesh = scene.getObjectByName(name) as THREE.Mesh | undefined;
            if (!mesh?.isMesh) return;
            const original = mesh.material as THREE.MeshStandardMaterial;
            const texture = textures[i];
            // Match how glTF textures are sampled so the art lands on the existing UVs the right way up.
            texture.flipY = false;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            texture.needsUpdate = true;
            const material = original.clone();
            material.map = texture;
            mesh.material = material;
            restore.push(() => {
                mesh.material = original;
                material.dispose();
            });
        });
        return () => restore.forEach((r) => r());
    }, [scene, textures]);

    return null;
};

export default AlbumCovers;
