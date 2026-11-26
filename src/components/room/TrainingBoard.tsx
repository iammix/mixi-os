import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { loadHandwriting } from './handwriting';
import { BOARD_HEIGHT, BOARD_WIDTH, drawTrainingBoard } from './trainingBoardDraw';
import { getTraining, nextRace, startTraining, subscribeTraining } from './training';

// The cork board above the bike (scripts/build_training_board.py) shows this month's swim, bike
// and run from Garmin and counts down to the next race. Its cork is one quad with UVs across it;
// the board is drawn onto a canvas and used as that quad's texture. It's redrawn when new totals
// arrive, once the handwriting has loaded, and whenever the day changes, so the countdown stays
// right on a page left open overnight.

const CORK = 'Training_board_cork';

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const TrainingBoard: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_WIDTH;
        canvas.height = BOARD_HEIGHT;
        const t = new THREE.CanvasTexture(canvas);
        // glTF UVs have v = 0 at the top of the image, so the canvas goes on unflipped.
        t.flipY = false;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
    }, []);

    useEffect(() => {
        const cork = scene.getObjectByName(CORK) as THREE.Mesh | undefined;
        if (!cork) return;
        const material = (cork.material as THREE.MeshStandardMaterial).clone();
        material.map = texture;
        material.color.set('#ffffff');
        const original = cork.material;
        cork.material = material;

        const canvas = texture.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        let drawnFor = '';
        const draw = () => {
            if (!ctx) return;
            drawnFor = dayKey(new Date());
            drawTrainingBoard(ctx, canvas.width, canvas.height, getTraining(), nextRace());
            texture.needsUpdate = true;
        };
        draw();
        const unsubscribe = subscribeTraining(draw);
        const stopTraining = startTraining();
        let alive = true;
        loadHandwriting().then(() => alive && draw());
        const timer = window.setInterval(() => {
            if (dayKey(new Date()) !== drawnFor) draw();
        }, 60_000);

        return () => {
            alive = false;
            unsubscribe();
            stopTraining();
            clearInterval(timer);
            cork.material = original;
            material.dispose();
        };
    }, [scene, texture]);

    useEffect(() => () => texture.dispose(), [texture]);

    return null;
};

export default TrainingBoard;
