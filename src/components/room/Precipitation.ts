import * as THREE from 'three';
import { CENTER, GROUND, PHI_RANGE, SKY_HIGH, STENCIL } from './viewGeometry';
import type { Weather } from './weather';

// Rain or snow falling in the view outside the window: one cloud of points spread between the
// window and the sky, drawn only inside the window opening. All the motion is in the shader.

const R_RANGE: [number, number] = [0.35, 2.6];

export function createPrecipitation(count: number) {
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geometry = new THREE.BufferGeometry();
    // position is unused (the shader places each point from its seed) but three needs it for the count.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(CENTER.x, 0.9, CENTER.y), 4);

    const material = new THREE.ShaderMaterial({
        ...STENCIL,
        transparent: true,
        depthWrite: false,
        uniforms: {
            time: { value: 0 },
            snow: { value: 0 }, // 0 rain, 1 snow
            density: { value: 0 }, // share of the points that show
            slant: { value: 0 }, // sideways drift per unit fallen
            height: { value: 800 }, // drawing buffer height, for point sizes
            light: { value: 1 },
        },
        vertexShader: /* glsl */ `
            attribute vec4 seed;
            uniform float time;
            uniform float snow;
            uniform float density;
            uniform float slant;
            uniform float height;
            varying float vShow;
            const float LOW = ${GROUND.toFixed(3)};
            const float SPAN = ${(SKY_HIGH - GROUND).toFixed(3)};
            void main() {
                vShow = step(seed.w, density);
                float speed = mix(1.6, 0.12, snow) * (0.8 + 0.4 * seed.z);
                float fallen = mod(seed.z * SPAN + time * speed, SPAN);
                float r = mix(${R_RANGE[0].toFixed(2)}, ${R_RANGE[1].toFixed(2)}, sqrt(seed.x));
                float phi = radians(mix(${PHI_RANGE[0].toFixed(1)}, ${PHI_RANGE[1].toFixed(1)}, seed.y));
                phi += (slant * fallen + snow * 0.015 * sin(time * 1.3 + seed.w * 40.0)) / r;
                vec3 p = vec3(${CENTER.x.toFixed(2)} - r * cos(phi), LOW + SPAN - fallen, ${CENTER.y.toFixed(2)} - r * sin(phi));
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                float size = mix(0.07, 0.022, snow) * (0.7 + 0.6 * seed.x);
                // Orthographic (the room's camera) has no perspective divide.
                float depth = projectionMatrix[3][3] > 0.5 ? 1.0 : -mv.z;
                gl_PointSize = vShow * size * projectionMatrix[1][1] * height * 0.5 / depth;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float snow;
            uniform float slant;
            uniform float light;
            varying float vShow;
            void main() {
                if (vShow < 0.5) discard;
                vec2 c = gl_PointCoord - 0.5;
                float alpha;
                vec3 color;
                if (snow > 0.5) {
                    alpha = smoothstep(0.5, 0.15, length(c)) * 0.95;
                    color = vec3(1.0);
                } else {
                    // A thin streak, leaning with the wind.
                    float x = c.x + c.y * slant * 0.6;
                    alpha = smoothstep(0.09, 0.02, abs(x)) * smoothstep(0.5, 0.15, abs(c.y)) * 0.7;
                    color = vec3(0.78, 0.84, 0.92);
                }
                if (alpha < 0.01) discard;
                gl_FragColor = vec4(color * light, alpha);
                #include <colorspace_fragment>
            }
        `,
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'View_precipitation';
    points.frustumCulled = false;
    points.renderOrder = 3;
    points.visible = false;

    return {
        points,
        /** Show the weather's rain or snow; light dims it at night. */
        update(w: Weather, time: number, bufferHeight: number, light: number) {
            const falling = w.sky === 'rain' || w.sky === 'snow';
            points.visible = falling && w.intensity > 0;
            if (!points.visible) return;
            const u = material.uniforms;
            u.time.value = time;
            u.snow.value = w.sky === 'snow' ? 1 : 0;
            u.density.value = 0.25 + 0.75 * w.intensity;
            u.slant.value = w.windy ? 0.6 : 0.15;
            u.height.value = bufferHeight;
            u.light.value = Math.max(light, 0.35);
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
