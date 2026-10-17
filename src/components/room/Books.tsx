import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Sizes in metres (width, thickness, depth); the stack is listed bottom to top.
type Book = {
    size: [number, number, number];
    cloth: string;
    /** Rotation around the vertical axis, and a small nudge so the stack isn't perfectly square. */
    turn: number;
    offset: [number, number];
    cover?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
    spine?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

const HERO_CAMERA_NAME = 'Hero_isometric';
const PAGES = '#efe6d2';
const PIKETTY_RED = '#b3261e';

const pikettyCover = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#f6f2ea';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1b1b';
    ctx.font = `600 ${w * 0.085}px Georgia, serif`;
    ctx.fillText('THOMAS PIKETTY', w / 2, h * 0.16);
    ctx.fillStyle = PIKETTY_RED;
    ctx.fillRect(w * 0.12, h * 0.22, w * 0.76, h * 0.006);
    ctx.fillStyle = '#1b1b1b';
    ctx.font = `700 ${w * 0.2}px Georgia, serif`;
    ctx.fillText('CAPITAL', w / 2, h * 0.5);
    ctx.fillStyle = PIKETTY_RED;
    ctx.font = `italic ${w * 0.075}px Georgia, serif`;
    ctx.fillText('in the Twenty-First', w / 2, h * 0.6);
    ctx.fillText('Century', w / 2, h * 0.67);
};

const pikettySpine = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#f6f2ea';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PIKETTY_RED;
    ctx.fillRect(0, h * 0.42, w, h * 0.16);
    ctx.fillStyle = '#1b1b1b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${h * 0.34}px Georgia, serif`;
    ctx.fillText('CAPITAL', w * 0.4, h / 2);
    ctx.font = `600 ${h * 0.22}px Georgia, serif`;
    ctx.fillText('PIKETTY', w * 0.85, h / 2);
};

const STACK: Book[] = [
    { size: [0.175, 0.03, 0.25], cloth: '#2f4a3a', turn: 0.12, offset: [0.006, -0.004] },
    { size: [0.155, 0.026, 0.23], cloth: '#7a5a3c', turn: -0.18, offset: [-0.008, 0.006] },
    { size: [0.165, 0.052, 0.24], cloth: '#f6f2ea', turn: 0.32, offset: [0.004, 0.002], cover: pikettyCover, spine: pikettySpine },
];

const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) draw(ctx, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
};

/** One material per box face, in three's order: +x, -x, +y, -y, +z, -z. The spine is -x, the cover +y. */
const bookMaterials = (book: Book) => {
    const [width, thickness, depth] = book.size;
    const cloth = new THREE.MeshStandardMaterial({ color: book.cloth, roughness: 0.75 });
    const pages = new THREE.MeshStandardMaterial({ color: PAGES, roughness: 0.95 });
    const cover = book.cover
        ? new THREE.MeshStandardMaterial({ map: canvasTexture(512, Math.round((512 * depth) / width), book.cover), roughness: 0.6 })
        : cloth;
    const spine = book.spine
        ? new THREE.MeshStandardMaterial({ map: canvasTexture(1024, Math.round((1024 * thickness) / depth), book.spine), roughness: 0.6 })
        : cloth;
    return [pages, spine, cover, cloth, pages, pages];
};

/** A stack of books on the side table by the lounge chair, resting on the record sleeve if it's there. */
const Books: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const base = useMemo(() => {
        const table = scene.getObjectByName('Side_table_oak_top');
        if (!table) return null;
        const tableBox = new THREE.Box3().setFromObject(table);
        const sleeve = scene.getObjectByName('Now_playing_sleeve');
        const top = sleeve ? new THREE.Box3().setFromObject(sleeve).max.y : tableBox.max.y;
        const centre = tableBox.getCenter(new THREE.Vector3());
        // Turn the stack so the covers read the right way up from the default view.
        let heroNode: THREE.Object3D | undefined;
        scene.traverse((o) => {
            if (!heroNode && o.name.includes(HERO_CAMERA_NAME)) heroNode = o;
        });
        const camera = heroNode?.getWorldPosition(new THREE.Vector3());
        const facing = camera ? Math.atan2(camera.x - centre.x, camera.z - centre.z) : 0;
        return { position: new THREE.Vector3(centre.x, top, centre.z), facing };
    }, [scene]);

    const books = useMemo(() => STACK.map((book) => ({ book, materials: bookMaterials(book) })), []);
    useEffect(
        () => () =>
            books.forEach(({ materials }) =>
                new Set(materials).forEach((m) => {
                    m.map?.dispose();
                    m.dispose();
                }),
            ),
        [books],
    );

    if (!base) return null;
    let y = base.position.y;
    return (
        <group position={[base.position.x, 0, base.position.z]} rotation={[0, base.facing, 0]}>
            {books.map(({ book, materials }, i) => {
                const [width, thickness, depth] = book.size;
                const centreY = y + thickness / 2;
                y += thickness;
                return (
                    <mesh
                        key={i}
                        position={[book.offset[0], centreY, book.offset[1]]}
                        rotation={[0, book.turn, 0]}
                        material={materials}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[width, thickness, depth]} />
                    </mesh>
                );
            })}
        </group>
    );
};

export default Books;
