// The training board's data: this month's swim, bike and run from Garmin Connect, summed.
//
// GET /training/month -> { month, updated, swim, bike, run }, each { km, seconds, sessions }.
// GET /health          -> ok
//
// The Garmin Connect Personal API key stays here, in the GARMIN_API_KEY environment variable; the
// site only ever sees the totals. The key is traded for a bearer token that lasts 24 hours (Garmin
// has no refresh tokens, so a new one is requested when it runs out), the same way as
// training-planner/garmin.py. Totals are cached for CACHE_MINUTES so visitors don't hit Garmin.
//
// No dependencies: run with `node server/index.mjs` (Node 18+).

import http from 'node:http';
import { monthIn, summarise } from './summary.mjs';

const PORT = Number(process.env.PORT) || 8787;
const BASE = process.env.GARMIN_PERSONAL_API_BASE_URL || 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const ACTIVITIES_PATH = '/activitylist-service/activities/search/activities';
const TIME_ZONE = process.env.TRAINING_TIME_ZONE || 'Europe/Amsterdam';
const CACHE_MS = (Number(process.env.CACHE_MINUTES) || 15) * 60 * 1000;
const PAGE = 100;
// The board is public, read-only data, so any page may read it.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

let token = null; // { value, exp } with exp in ms

const jwtExp = (t) => {
    try {
        const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
        return payload.exp * 1000;
    } catch {
        return Date.now() + 23 * 60 * 60 * 1000;
    }
};

async function getToken(force = false) {
    if (!force && token && token.exp - 60_000 > Date.now()) return token.value;
    const key = process.env.GARMIN_API_KEY;
    if (!key) throw new Error('GARMIN_API_KEY is not set');
    const res = await fetch(BASE + TOKEN_PATH, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${key}` } });
    if (!res.ok) throw new Error(`token request failed: HTTP ${res.status}`);
    const text = await res.text();
    let value = text.trim();
    try {
        const j = JSON.parse(text);
        value = j.access_token || j.accessToken || j.token || value;
    } catch {
        // A bare token.
    }
    token = { value, exp: jwtExp(value) };
    return value;
}

async function garmin(path, params) {
    const url = `${BASE}${path}?${new URLSearchParams(params)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${await getToken(attempt > 0)}` } });
        if (res.status === 401 && attempt === 0) continue;
        if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`);
        const text = await res.text();
        return text.trim() ? JSON.parse(text) : null;
    }
}

async function monthTotals(now = new Date()) {
    const { month, start, end } = monthIn(now, TIME_ZONE);
    const activities = [];
    for (let from = 0; ; from += PAGE) {
        const page = await garmin(ACTIVITIES_PATH, { start: from, limit: PAGE, startDate: start, endDate: end });
        if (!Array.isArray(page) || page.length === 0) break;
        activities.push(...page);
        if (page.length < PAGE) break;
    }
    return { month, updated: now.toISOString(), ...summarise(activities, month) };
}

let cache = null; // { at, body }
let pending = null;

async function cachedTotals() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.body;
    // Visitors arriving together share one request to Garmin.
    pending ??= monthTotals()
        .then((totals) => {
            cache = { at: Date.now(), body: JSON.stringify(totals) };
            return cache.body;
        })
        .finally(() => {
            pending = null;
        });
    return pending;
}

const server = http.createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS).end();
        return;
    }
    if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' }).end('ok');
        return;
    }
    if (req.method === 'GET' && path === '/training/month') {
        try {
            const body = await cachedTotals();
            res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }).end(body);
        } catch (e) {
            console.error('training/month:', e.message);
            // Serve the last good totals if Garmin is down, rather than an empty board.
            if (cache) res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(cache.body);
            else res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'garmin unavailable' }));
        }
        return;
    }
    res.writeHead(404, CORS).end();
});

server.listen(PORT, () => console.log(`training api on :${PORT}`));
