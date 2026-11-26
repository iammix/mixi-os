// When the Christmas lights round the window are up: from 1 December to 6 January (Theofania, the
// Epiphany, when Christmas ends in Greece), by the date in Rotterdam. `?christmas=on` or
// `?christmas=off` puts them up or takes them down whatever the date, for trying them out.

const ZONE = 'Europe/Amsterdam';
const format = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, month: 'numeric', day: 'numeric' });

/** Whether `date` falls in the Christmas season (1 December – 6 January, Rotterdam time). */
export function isChristmas(date: Date) {
    const parts = format.formatToParts(date);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    return month === 12 || (month === 1 && day <= 6);
}

/** `?christmas=on|off` → true/false; null to go by the date. */
export function christmasOverride(search: string): boolean | null {
    const value = new URLSearchParams(search).get('christmas');
    return value === 'on' ? true : value === 'off' ? false : null;
}
