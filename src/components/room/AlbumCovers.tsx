import React, { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ALBUMS, FRAMED_COVERS, coverUrl } from './albums';

// Each modelled cover keeps its frame and picture light; only the artwork is swapped.
const ART_URLS = FRAMED_COVERS.map((c) => coverUrl(ALBUMS.find((a) => a.id === c.album)!));

const AlbumCovers: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const textures = useTexture(ART_URLS);

    useEffect(() => {
        const restore: (() => void)[] = [];
        FRAMED_COVERS.forEach(({ mesh: name }, i) => {
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
