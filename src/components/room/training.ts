// What's pinned to the cork board above the bike (see TrainingBoard): this month's swim, bike and
// run from Garmin, and a race bib counting down to the next race in races.ts.
//
// The totals come from the small training API in server/ (it holds the Garmin key; the site only
// sees the sums), at VITE_TRAINING_API_URL. `?training=demo` shows made-up numbers instead, for
// trying the board out without Garmin.

import { Race, daysUntil, racesInOrder } from './races';

export type Sport = 'swim' | 'bike' | 'run';
export const SPORTS: Sport[] = ['swim', 'bike', 'run'];

/** One sport's month: distance, moving time and how many sessions. */
export type SportMonth = { km: number; seconds: number; sessions: number };

export type MonthTotals = { month: string; swim: SportMonth; bike: SportMonth; run: SportMonth };

/** off: no API configured. loading: first fetch on its way. error: it failed and there's nothing yet. */
export type TrainingState = { status: 'off' | 'loading' | 'ready' | 'error'; totals: MonthTotals | null };

const DEMO: MonthTotals = {
    month: '2026-11',
    swim: { km: 9.6, seconds: 4 * 3600 + 35 * 60, sessions: 5 },
    bike: { km: 412.5, seconds: 15 * 3600 + 20 * 60, sessions: 9 },
    run: { km: 86.3, seconds: 7 * 3600 + 55 * 60, sessions: 10 },
};

// --- Reading the API ---

const isSportMonth = (v: unknown): v is SportMonth => {
    const s = v as SportMonth | null;
    return !!s && [s.km, s.seconds, s.sessions].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
};

/** The API's response as MonthTotals, or null if it isn't one. */
export function fromApi(json: unknown): MonthTotals | null {
    const j = json as Partial<MonthTotals> | null;
    if (!j || typeof j.month !== 'string' || !/^\d{4}-\d{2}$/.test(j.month)) return null;
    if (!SPORTS.every((s) => isSportMonth(j[s]))) return null;
    return { month: j.month, swim: j.swim!, bike: j.bike!, run: j.run! };
}

// --- Writing it on the board ---

/** "November 2026" */
export function monthLabel(month: string) {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** This month as YYYY-MM, for the heading before anything has loaded. */
export const currentMonth = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

/** Swims in metres ("2,400 m"), rides and runs in kilometres ("85 km", "12.5 km"). */
export function distance(sport: Sport, km: number) {
    if (sport === 'swim') return `${Math.round(km * 1000).toLocaleString('en-GB')} m`;
    return `${Math.round(km * 10) / 10} km`;
}

/** "4h 35m", or just "45m" under an hour. */
export function duration(seconds: number) {
    const minutes = Math.round(seconds / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const NOUN: Record<Sport, string> = { swim: 'swim', bike: 'ride', run: 'run' };

/** "1 ride", "6 swims" */
export const sessions = (sport: Sport, n: number) => `${n} ${NOUN[sport]}${n === 1 ? '' : 's'}`;

/** The first race that's today or still to come, with how many days away it is. */
export function nextRace(now = new Date()): { race: Race; days: number } | null {
    for (const race of racesInOrder()) {
        const days = daysUntil(race, now);
        if (days >= 0) return { race, days };
    }
    return null;
}

/** What's written under the bib's number. */
export const daysToGo = (days: number) => (days === 0 ? 'race day!' : days === 1 ? 'day to go' : 'days to go');

/** The board's root in the model: clicking anything on it (frame, cork, backing) opens its close-up. */
export const isTrainingBoard = (name: string) => name === 'Training_board';

// --- Keeping it up to date ---

export const REFRESH_MS = 15 * 60 * 1000;
const API_URL: string = (import.meta.env.VITE_TRAINING_API_URL ?? '').replace(/\/$/, '');

let state: TrainingState = { status: API_URL ? 'loading' : 'off', totals: null };
const listeners = new Set<() => void>();
let running: { count: number; stop: () => void } | null = null;

export const getTraining = () => state;

export function subscribeTraining(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function set(next: TrainingState) {
    state = next;
    listeners.forEach((l) => l());
}

async function load(url: string, fetcher: typeof fetch) {
    try {
        const res = await fetcher(`${url}/training/month`);
        const totals = res.ok ? fromApi(await res.json()) : null;
        if (totals) set({ status: 'ready', totals });
        else if (!state.totals) set({ status: 'error', totals: null });
    } catch {
        // Offline or the API is down: keep what we had and try again next time.
        if (!state.totals) set({ status: 'error', totals: null });
    }
}

/** Start keeping the totals up to date (or apply `?training=demo`); returns a function that stops it. */
export function startTraining(opts: { fetch?: typeof fetch; search?: string; url?: string } = {}): () => void {
    if (!running) {
        const search = opts.search ?? (typeof location !== 'undefined' ? location.search : '');
        const url = opts.url ?? API_URL;
        if (new URLSearchParams(search).get('training') === 'demo') {
            set({ status: 'ready', totals: DEMO });
            running = { count: 0, stop: () => {} };
        } else if (!url) {
            set({ status: 'off', totals: null });
            running = { count: 0, stop: () => {} };
        } else {
            if (!state.totals) set({ status: 'loading', totals: null });
            const fetcher = opts.fetch ?? fetch.bind(globalThis);
            void load(url, fetcher);
            const timer = setInterval(() => void load(url, fetcher), REFRESH_MS);
            running = { count: 0, stop: () => clearInterval(timer) };
        }
    }
    running.count++;
    let stopped = false;
    return () => {
        if (stopped || !running) return;
        stopped = true;
        if (--running.count === 0) {
            running.stop();
            running = null;
        }
    };
}
