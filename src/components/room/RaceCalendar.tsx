import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PaperSheet } from './paperSim';
import { Race, RaceRoute, daysUntil, isDone, publicUrl, raceDay, racesInOrder } from './races';

// The race calendar that comes out of the tri bag: a sheet of ruled notebook paper squished into
// a ball that flies up and is pulled open (a small paper simulation, see paperSim), with the race
// days handwritten on it. Once it's flat the simulated sheet hands over to the real page, where
// races that are done open a one-page story of how they went.

type Phase = 'sim' | 'reveal' | 'open';

// The ball flies up, then is pulled open; the real page then fades in over the simulated one.
const FLY_MS = 520;
const OPEN_MS = 1650;
const REVEAL_MS = 260;

// The handwriting. Loaded the first time the calendar opens, appended at the end of <head>:
// IntroPage writes its keyframes into document.styleSheets[0], which must stay a same-origin sheet.
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap';
const HAND = "Caveat, 'Bradley Hand', 'Segoe Print', cursive";
const INK = '#1f2f6b';
const RED = '#b8322b';

let handwriting: Promise<unknown> | null = null;

/** Add the font's stylesheet once; resolves when both weights are ready to draw with (or failed). */
function loadHandwriting() {
    if (!handwriting) {
        handwriting = new Promise<void>((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = FONT_URL;
            link.onload = () => resolve();
            link.onerror = () => resolve();
            document.head.appendChild(link);
        }).then(() => Promise.all([document.fonts?.load(`700 36px ${HAND}`), document.fonts?.load(`400 23px ${HAND}`)]).catch(() => undefined));
    }
    return handwriting;
}

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The sheet's size, as the page's CSS sizes it (.race-paper). */
const sheetSize = (viewport: { width: number; height: number }) => ({
    width: Math.min(440, viewport.width - 32),
    height: Math.min(600, viewport.height - 48),
});

const countdown = (days: number) => (days === 0 ? 'race day!' : days === 1 ? 'tomorrow' : `in ${days} days`);

const RaceList: React.FC<{ onOpen: (race: Race) => void }> = ({ onOpen }) => {
    const races = racesInOrder();
    return (
        <>
            <h2 className="race-title">my race days</h2>
            <ol className="race-list">
                {races.map((race) => {
                    const done = isDone(race);
                    const days = daysUntil(race);
                    const line = (
                        <>
                            <span className="race-box" aria-hidden>
                                {done ? '☑' : '☐'}
                            </span>
                            <span className="race-day">{raceDay(race)}</span>
                            <span className={`race-name ${done ? 'done' : ''}`}>{race.name}</span>
                            <span className="race-note">
                                {race.kind} · {race.location}
                                {' · '}
                                {race.post ? <span className="race-read">read how it went →</span> : done ? 'story coming soon' : countdown(days)}
                            </span>
                        </>
                    );
                    return (
                        <li key={race.id}>
                            {race.post ? (
                                <button className="race-row race-row-link" onClick={() => onOpen(race)}>
                                    {line}
                                </button>
                            ) : (
                                <div className="race-row">{line}</div>
                            )}
                        </li>
                    );
                })}
            </ol>
            <p className="race-footnote">more to come…</p>
        </>
    );
};

type Sketch = { path: string; profile: string; places: { label: string; x: number; y: number; left: boolean }[]; km: number; top: number };

const MAP_W = 320;
const MAP_H = 230;
const PROFILE_H = 46;

/** Read a GPX course and sketch it: the route as seen from above, and its elevation profile. */
function sketchRoute(gpx: string, route: RaceRoute): Sketch | null {
    const doc = new DOMParser().parseFromString(gpx, 'application/xml');
    const points = Array.from(doc.getElementsByTagName('trkpt')).map((p) => ({
        lat: Number(p.getAttribute('lat')),
        lon: Number(p.getAttribute('lon')),
        ele: Number(p.getElementsByTagName('ele')[0]?.textContent ?? 0),
    }));
    if (points.length < 2) return null;
    // Flat projection, squeezing longitude by the latitude so the shape isn't stretched.
    const midLat = (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xs = points.map((p) => p.lon * k);
    const ys = points.map((p) => -p.lat);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 14;
    const scale = Math.min((MAP_W - 2 * pad) / (x1 - x0), (MAP_H - 2 * pad) / (y1 - y0));
    const ox = (MAP_W - (x1 - x0) * scale) / 2;
    const oy = (MAP_H - (y1 - y0) * scale) / 2;
    const project = (lat: number, lon: number) => ({ x: ox + (lon * k - x0) * scale, y: oy + (-lat - y0) * scale });
    const step = Math.max(1, Math.floor(points.length / 500));
    const kept = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    const path = kept
        .map((p, i) => {
            const { x, y } = project(p.lat, p.lon);
            return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join('');

    // Distance along the course for the profile.
    const rad = Math.PI / 180;
    let km = 0;
    const along = kept.map((p, i) => {
        if (i) {
            const q = kept[i - 1];
            const a = Math.sin(((p.lat - q.lat) * rad) / 2) ** 2 + Math.cos(q.lat * rad) * Math.cos(p.lat * rad) * Math.sin(((p.lon - q.lon) * rad) / 2) ** 2;
            km += 12742 * Math.asin(Math.sqrt(a));
        }
        return km;
    });
    const top = Math.max(...kept.map((p) => p.ele));
    const profile =
        `M0 ${PROFILE_H}` +
        kept.map((p, i) => `L${((along[i] / km) * MAP_W).toFixed(1)} ${(PROFILE_H - 4 - (p.ele / top) * (PROFILE_H - 10)).toFixed(1)}`).join('') +
        `L${MAP_W} ${PROFILE_H}Z`;
    const places = (route.places ?? []).map((pl) => ({ label: pl.label, left: pl.side === 'left', ...project(pl.lat, pl.lon) }));
    return { path, profile, places, km, top };
}

/** The course drawn in red pen on the page, from the race's GPX file. */
const RouteSketch: React.FC<{ route: RaceRoute }> = ({ route }) => {
    const [sketch, setSketch] = useState<Sketch | null>(null);
    useEffect(() => {
        let alive = true;
        fetch(publicUrl(route.gpx))
            .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
            .then((gpx) => alive && setSketch(sketchRoute(gpx, route)))
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [route]);
    return (
        <figure className="race-route">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Map of the route">
                {sketch && (
                    <>
                        <path className="race-route-line" d={sketch.path} />
                        {sketch.places.map((p, i) => (
                            <g key={p.label}>
                                <circle cx={p.x} cy={p.y} r={i === 0 ? 4.5 : 3} className="race-route-dot" />
                                <text x={p.x + (p.left ? -8 : 8)} y={p.y + 5} textAnchor={p.left ? 'end' : 'start'}>
                                    {p.label}
                                </text>
                            </g>
                        ))}
                    </>
                )}
            </svg>
            {sketch && (
                <svg className="race-route-profile" viewBox={`0 0 ${MAP_W} ${PROFILE_H}`} preserveAspectRatio="none" aria-hidden>
                    <path d={sketch.profile} />
                </svg>
            )}
            <figcaption>
                {sketch ? `${Math.round(sketch.km)} km · highest point ${Math.round(sketch.top)} m · ` : ''}
                <a href={publicUrl(route.gpx)} download>
                    download the GPX
                </a>
            </figcaption>
        </figure>
    );
};

const RacePostPage: React.FC<{ race: Race; onBack: () => void }> = ({ race, onBack }) => {
    const post = race.post;
    const body = post?.body ?? [];
    return (
        <article className="race-post">
            <button className="race-return" onClick={onBack}>
                ← back to the list
            </button>
            <h2 className="race-title">{race.name}</h2>
            <p className="race-note">
                {raceDay(race)} · {race.kind} · {race.location}
            </p>
            {post?.result && <p className="race-result">{post.result}</p>}
            {body.slice(0, 2).map((p) => (
                <p key={p}>{p}</p>
            ))}
            {post?.route && <RouteSketch route={post.route} />}
            {body.slice(2).map((p) => (
                <p key={p}>{p}</p>
            ))}
            {post?.photos?.map((photo, i) => (
                <figure key={photo.src} className={`race-photo ${i % 2 ? 'tilt-right' : 'tilt-left'}`}>
                    <a href={publicUrl(photo.src)} target="_blank" rel="noopener noreferrer">
                        <img src={publicUrl(photo.src)} alt={photo.alt} loading="lazy" />
                    </a>
                    <figcaption>{photo.caption}</figcaption>
                </figure>
            ))}
        </article>
    );
};

/** The page's content: the list, or one race's story. */
const Sheet: React.FC<{ race: Race | null; setRace: (race: Race | null) => void }> = ({ race, setRace }) =>
    race ? <RacePostPage race={race} onBack={() => setRace(null)} /> : <RaceList onOpen={setRace} />;


type Span = { text: string; size: number; bold?: boolean; color?: string; alpha?: number; strike?: boolean };

/**
 * Paint the list page onto a canvas for the simulated sheet, laid out like the page's CSS
 * (30px rules, 62px left margin, words wrapping at the right edge).
 */
function paintPage(width: number, height: number) {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    const line = 30;
    ctx.fillStyle = '#fbf7ea';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(70, 110, 180, 0.33)';
    for (let y = line - 1; y < height; y += line) ctx.fillRect(0, y, width, 1);
    ctx.fillStyle = 'rgba(200, 60, 60, 0.45)';
    ctx.fillRect(46, 0, 2, height);

    const left = 62;
    const right = width - 22;
    const font = (s: Span) => `${s.bold ? 700 : 400} ${s.size}px ${HAND}`;
    /** Write spans from the top of a line, wrapping words; returns the top of the next line. */
    const write = (spans: Span[], top: number, lineHeight = line) => {
        let x = left;
        for (const span of spans) {
            ctx.font = font(span);
            ctx.fillStyle = span.color ?? INK;
            ctx.globalAlpha = span.alpha ?? 1;
            for (const word of span.text.split(/(?<= )/)) {
                const w = ctx.measureText(word).width;
                if (x + w > right && x > left && word.trim()) {
                    x = left;
                    top += lineHeight;
                }
                const baseline = top + lineHeight * 0.7;
                ctx.fillText(word, x, baseline);
                if (span.strike) ctx.fillRect(x, baseline - span.size * 0.3, ctx.measureText(word.trimEnd()).width, 1.5);
                x += w;
            }
        }
        ctx.globalAlpha = 1;
        return top + lineHeight;
    };

    ctx.font = `400 30px ${HAND}`;
    ctx.fillStyle = RED;
    ctx.fillText('×', width - 30, 25);

    let top = write([{ text: 'my race days', size: 36, bold: true }], line, 2 * line);
    ctx.font = `700 36px ${HAND}`;
    ctx.fillStyle = RED;
    ctx.fillRect(left, line + 2 * line * 0.7 + 6, ctx.measureText('my race days').width, 2);

    for (const race of racesInOrder()) {
        const done = isDone(race);
        ctx.font = `400 23px ${HAND}`;
        ctx.fillStyle = RED;
        ctx.fillText(done ? '☑' : '☐', left - 30, top + line * 0.7);
        top = write(
            [
                { text: `${raceDay(race)} — `, size: 23, bold: true },
                { text: race.name, size: 23, strike: done, color: INK },
            ],
            top,
        );
        const status = race.post ? 'read how it went →' : done ? 'story coming soon' : countdown(daysUntil(race));
        top = write(
            [
                { text: `${race.kind} · ${race.location} · `, size: 19, alpha: 0.8 },
                { text: status, size: 19, color: race.post ? RED : INK, alpha: race.post ? 1 : 0.8 },
            ],
            top,
        );
        top += line;
    }
    write([{ text: 'more to come…', size: 20, alpha: 0.6 }], top);
    return canvas;
}

/** The simulated sheet: a crumpled ball that flies up and is pulled open, drawn with three.js. */
const PaperUnwrap: React.FC<{ onFlat: () => void }> = ({ onFlat }) => {
    const host = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = host.current;
        if (!el) return;
        const view = { width: el.clientWidth, height: el.clientHeight };
        const { width, height } = sheetSize(view);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(view.width, view.height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);

        // A camera where one unit is one CSS pixel on the z = 0 plane.
        const fov = 30;
        const camera = new THREE.PerspectiveCamera(fov, view.width / view.height, 10, 10000);
        camera.position.z = view.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight('#ffffff', 1.1));
        const sun = new THREE.DirectionalLight('#fff6e8', 2.4);
        sun.position.set(-0.5, 0.7, 1);
        scene.add(sun);

        const sheet = new PaperSheet(width, height);
        const geometry = sheet.geometry();
        const texture = new THREE.CanvasTexture(paintPage(width, height));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const front = new THREE.MeshLambertMaterial({ map: texture, side: THREE.FrontSide });
        const back = new THREE.MeshLambertMaterial({ color: '#efe7d2', side: THREE.BackSide });
        const paper = new THREE.Group();
        paper.add(new THREE.Mesh(geometry, front), new THREE.Mesh(geometry, back));
        scene.add(paper);

        // The handwriting may still be loading: repaint the page once it's in.
        let alive = true;
        loadHandwriting().then(() => {
            if (!alive) return;
            texture.image = paintPage(width, height);
            texture.needsUpdate = true;
        });

        // Where the ball flies in from, and how it tumbles on the way.
        const startY = -(view.height / 2 + 160);
        const tumble = new THREE.Euler(2.6, -1.9, 3.4);
        const landed = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.35, -0.25));
        const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, THREE.MathUtils.degToRad(1)));

        const start = performance.now();
        let opened = 0;
        let frame = 0;
        let done = false;
        const tick = (now: number) => {
            const elapsed = now - start;
            if (elapsed < FLY_MS) {
                // Fly up with a little overshoot, spinning, growing to full size.
                const t = elapsed / FLY_MS;
                const rise = 1 - Math.pow(1 - t, 3) + Math.sin(Math.PI * t) * 0.06;
                paper.position.y = startY * (1 - rise);
                paper.scale.setScalar(0.55 + 0.45 * t);
                const spin = new THREE.Euler(tumble.x * (1 - t), tumble.y * (1 - t), tumble.z * (1 - t));
                paper.quaternion.setFromEuler(spin).multiply(landed);
            } else {
                paper.position.y = 0;
                paper.scale.setScalar(1);
                const t = Math.min(1, (elapsed - FLY_MS) / OPEN_MS);
                // Run the simulation at a fixed rate, catching up to where it should be.
                const steps = Math.round(t * OPEN_MS / (1000 / 120));
                while (opened < steps) {
                    opened++;
                    sheet.open(Math.min(1, opened / (OPEN_MS / (1000 / 120))));
                }
                paper.quaternion.slerpQuaternions(landed, flat, Math.min(1, t * 1.6));
                geometry.attributes.position.needsUpdate = true;
                geometry.computeVertexNormals();
                if (t >= 1 && !done) {
                    done = true;
                    onFlat();
                }
            }
            renderer.render(scene, camera);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => {
            alive = false;
            cancelAnimationFrame(frame);
            geometry.dispose();
            texture.dispose();
            front.dispose();
            back.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        };
        // Runs once; onFlat is only called when it's done.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={host} className="race-sim" aria-hidden />;
};

const RaceCalendar: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'open' : 'sim'));
    const [race, setRace] = useState<Race | null>(null);
    const sheet = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadHandwriting();
    }, []);

    // Once the simulated sheet is flat, fade the real page in over it, then drop the simulation.
    useEffect(() => {
        if (phase !== 'reveal') return;
        const timer = window.setTimeout(() => setPhase('open'), REVEAL_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    // Focus the page once it's open so keyboard users land on it.
    useEffect(() => {
        if (phase === 'open') sheet.current?.focus();
    }, [phase]);

    // Start each page (the list or a story) at the top.
    useEffect(() => {
        sheet.current?.scrollTo?.({ top: 0 });
    }, [race]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (race) setRace(null);
            else onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [race, onClose]);

    return (
        <div className="room-books-backdrop race-backdrop" onClick={onClose}>
            {phase !== 'open' && <PaperUnwrap onFlat={() => setPhase('reveal')} />}
            {phase !== 'sim' && (
                <div
                    className={`race-paper ${phase === 'reveal' ? 'race-reveal' : ''}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label="My race days"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div ref={sheet} className="race-sheet race-sheet-open" tabIndex={-1}>
                        <span className="race-wrinkles" aria-hidden />
                        <button className="race-close" onClick={onClose} aria-label="Close">
                            ×
                        </button>
                        <Sheet race={race} setRace={setRace} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RaceCalendar;
