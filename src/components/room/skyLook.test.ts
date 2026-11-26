import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyWeather, lookAt } from './skyLook';
import { CLEAR } from './weather';

const saturation = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).s;

describe('applyWeather', () => {
    const night = lookAt(-18);
    const day = lookAt(30);

    it('leaves a clear look unchanged', () => {
        expect(applyWeather(day, CLEAR)).toEqual(day);
        expect(applyWeather(night, CLEAR)).toEqual(night);
    });

    it('overcast dims, greys and hides the stars', () => {
        const overcast = { ...CLEAR, sky: 'cloudy' as const, cloud: 1 };
        const d = applyWeather(day, overcast);
        expect(d.light).toBeLessThanOrEqual(day.light * 0.7);
        expect(saturation(d.top)).toBeLessThan(saturation(day.top));
        expect(saturation(d.horizon)).toBeLessThan(saturation(day.horizon));
        expect(applyWeather(night, overcast).stars).toBe(0);
    });
});
