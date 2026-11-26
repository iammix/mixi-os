import * as THREE from 'three';

// A sheet of paper as a grid of particles held together by distance constraints (Verlet
// integration, like a cloth simulation). It is crumpled into a ball by pulling every particle
// towards the middle (the constraints keep the sheet from stretching, so it buckles and creases),
// then opened out: the corners are pulled back to where they belong on the flat sheet, the rest
// follows through the constraints, and stiffness and a pull towards flat grow until it lies flat.

const COLS = 22;
const ROWS = 30;

/** Small seeded random so the ball crumples the same way every time. */
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class PaperSheet {
    readonly count = COLS * ROWS;
    readonly pos: Float32Array;
    private prev: Float32Array;
    readonly flat: Float32Array;
    private links: Int32Array;
    private lengths: Float32Array;
    private bends: Int32Array;
    private bendLengths: Float32Array;
    private corners: number[];
    private cornerStart: Float32Array;

    constructor(readonly width: number, readonly height: number) {
        const n = this.count;
        this.flat = new Float32Array(n * 3);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const i = (r * COLS + c) * 3;
                this.flat[i] = (c / (COLS - 1) - 0.5) * width;
                this.flat[i + 1] = (0.5 - r / (ROWS - 1)) * height;
            }
        }
        const links: number[] = [];
        const bends: number[] = [];
        const at = (r: number, c: number) => r * COLS + c;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (c + 1 < COLS) links.push(at(r, c), at(r, c + 1));
                if (r + 1 < ROWS) links.push(at(r, c), at(r + 1, c));
                if (c + 1 < COLS && r + 1 < ROWS) links.push(at(r, c), at(r + 1, c + 1), at(r, c + 1), at(r + 1, c));
                if (c + 2 < COLS) bends.push(at(r, c), at(r, c + 2));
                if (r + 2 < ROWS) bends.push(at(r, c), at(r + 2, c));
            }
        }
        this.links = Int32Array.from(links);
        this.bends = Int32Array.from(bends);
        this.lengths = this.restLengths(this.links);
        this.bendLengths = this.restLengths(this.bends);
        this.corners = [at(0, 0), at(0, COLS - 1), at(ROWS - 1, 0), at(ROWS - 1, COLS - 1)];
        this.pos = this.flat.slice();
        this.crumple();
        this.prev = this.pos.slice();
        this.cornerStart = Float32Array.from(this.corners.flatMap((i) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]));
    }

    private restLengths(pairs: Int32Array) {
        const out = new Float32Array(pairs.length / 2);
        for (let k = 0; k < out.length; k++) {
            const a = pairs[k * 2] * 3;
            const b = pairs[k * 2 + 1] * 3;
            out[k] = Math.hypot(this.flat[a] - this.flat[b], this.flat[a + 1] - this.flat[b + 1]);
        }
        return out;
    }

    private satisfy(pairs: Int32Array, lengths: Float32Array, stiffness: number) {
        const p = this.pos;
        for (let k = 0; k < lengths.length; k++) {
            const a = pairs[k * 2] * 3;
            const b = pairs[k * 2 + 1] * 3;
            const dx = p[b] - p[a];
            const dy = p[b + 1] - p[a + 1];
            const dz = p[b + 2] - p[a + 2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
            const f = ((d - lengths[k]) / d) * 0.5 * stiffness;
            p[a] += dx * f;
            p[a + 1] += dy * f;
            p[a + 2] += dz * f;
            p[b] -= dx * f;
            p[b + 1] -= dy * f;
            p[b + 2] -= dz * f;
        }
    }

    /** Scrunch the flat sheet into a ball. */
    private crumple() {
        const rand = seeded(1871);
        const p = this.pos;
        const radius = 0.085 * (this.width + this.height);
        // Each particle settles at its own depth inside the ball, so it ends up tightly packed.
        const depth = Float32Array.from({ length: this.count }, () => 0.3 + 0.7 * rand());
        for (let i = 0; i < this.count; i++) p[i * 3 + 2] = (rand() - 0.5) * 6;
        for (let step = 0; step < 320; step++) {
            for (let i = 0; i < this.count; i++) {
                const j = i * 3;
                p[j] += (rand() - 0.5) * 1.6;
                p[j + 1] += (rand() - 0.5) * 1.6;
                p[j + 2] += (rand() - 0.5) * 1.6;
                const d = Math.hypot(p[j], p[j + 1], p[j + 2]);
                const target = radius * depth[i];
                if (d > target) {
                    const k = 1 - 0.06 * (1 - target / d);
                    p[j] *= k;
                    p[j + 1] *= k;
                    p[j + 2] *= k;
                }
            }
            for (let it = 0; it < 3; it++) this.satisfy(this.links, this.lengths, 1);
        }
    }

    /** Advance the opening, `t` from 0 (ball) to 1 (flat). */
    open(t: number) {
        const p = this.pos;
        const prev = this.prev;
        const damping = 0.9;
        const toFlat = 0.002 + 0.07 * smooth(t) * smooth(t);
        for (let j = 0; j < p.length; j++) {
            const v = (p[j] - prev[j]) * damping;
            prev[j] = p[j];
            p[j] += v + (this.flat[j] - p[j]) * toFlat;
        }
        // Hands pull the corners out to where they belong.
        const pull = easeOut(Math.min(1, t * 1.5));
        this.corners.forEach((i, k) => {
            for (let a = 0; a < 3; a++) {
                const value = this.cornerStart[k * 3 + a] + (this.flat[i * 3 + a] - this.cornerStart[k * 3 + a]) * pull;
                p[i * 3 + a] = value;
                prev[i * 3 + a] = value;
            }
        });
        const bend = 0.02 + 0.6 * smooth(t);
        for (let it = 0; it < 6; it++) {
            this.satisfy(this.links, this.lengths, 1);
            this.satisfy(this.bends, this.bendLengths, bend);
        }
        // The last stretch irons it out exactly flat, ready to hand over to the page.
        if (t > 0.78) {
            const s = smooth((t - 0.78) / 0.22);
            for (let j = 0; j < p.length; j++) p[j] += (this.flat[j] - p[j]) * s;
        }
    }

    /** Triangle indices and UVs for rendering the grid. */
    geometry() {
        const geometry = new THREE.BufferGeometry();
        const uv = new Float32Array(this.count * 2);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                uv[(r * COLS + c) * 2] = c / (COLS - 1);
                uv[(r * COLS + c) * 2 + 1] = 1 - r / (ROWS - 1);
            }
        }
        const index: number[] = [];
        for (let r = 0; r + 1 < ROWS; r++) {
            for (let c = 0; c + 1 < COLS; c++) {
                const a = r * COLS + c;
                index.push(a, a + COLS, a + 1, a + 1, a + COLS, a + COLS + 1);
            }
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geometry.setIndex(index);
        geometry.computeVertexNormals();
        return geometry;
    }
}
