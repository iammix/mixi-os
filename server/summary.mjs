// Turns a month of Garmin activities into what the training board shows: for swim, bike and run,
// how far, how long and how many sessions. Anything else (strength, yoga, walks...) is left out.

/** Which board column a Garmin activity type belongs to, or null. */
export function sportOf(typeKey) {
    const t = String(typeKey ?? '').toLowerCase();
    if (t.includes('swim')) return 'swim';
    if (t.includes('cycl') || t.includes('biking') || t.includes('ride') || t === 'bmx') return 'bike';
    if (t.includes('run')) return 'run';
    return null;
}

const empty = () => ({ km: 0, seconds: 0, sessions: 0 });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** The calendar month containing `now`, in `timeZone`: { month: 'YYYY-MM', start, end } as YYYY-MM-DD. */
export function monthIn(now, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(now)
            .map((p) => [p.type, p.value]),
    );
    const month = `${parts.year}-${parts.month}`;
    return { month, start: `${month}-01`, end: `${month}-${parts.day}` };
}

/** Sum activities (Garmin activity-list rows) that started in `month` (YYYY-MM, local time). */
export function summarise(activities, month) {
    const out = { swim: empty(), bike: empty(), run: empty() };
    for (const a of activities ?? []) {
        if (!String(a?.startTimeLocal ?? '').startsWith(month)) continue;
        const sport = sportOf(a?.activityType?.typeKey);
        if (!sport) continue;
        out[sport].km += num(a.distance) / 1000;
        out[sport].seconds += num(a.movingDuration) || num(a.duration);
        out[sport].sessions += 1;
    }
    for (const s of Object.values(out)) {
        s.km = Math.round(s.km * 100) / 100;
        s.seconds = Math.round(s.seconds);
    }
    return out;
}
