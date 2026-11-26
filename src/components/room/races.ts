// The race calendar that unfolds from the tri bag in the corner (see RaceCalendar).
//
// Add a race with its day; once it's done, add a `post` and it becomes clickable, opening
// a one-page write-up of how it went (races with a post are clickable whatever the date; the tick
// and crossing-out come with the date). Races are listed in date order automatically.

export type RacePhoto = {
    /** Path under public/, e.g. "races/<race>/finish.jpg". */
    src: string;
    /** Handwritten under the print. */
    caption: string;
    alt: string;
};

/** A labelled place on the drawn route; `side` is where the label goes (right by default). */
export type RacePlace = { label: string; lat: number; lon: number; side?: 'left' | 'right' };

export type RaceRoute = {
    /** The course as a GPX file under public/, drawn on the page and offered for download. */
    gpx: string;
    /** Places to label on the drawn route. */
    places?: RacePlace[];
};

export type RacePost = {
    /** Finish time, placing... shown under the title, e.g. "2:14:37 · 12th in AG". */
    result?: string;
    /** The write-up, one string per paragraph. */
    body: string[];
    photos?: RacePhoto[];
    route?: RaceRoute;
};

export type Race = {
    id: string;
    name: string;
    /** Race day, YYYY-MM-DD. */
    date: string;
    location: string;
    /** The format, e.g. "Standard duathlon", "Olympic triathlon", "70.3". */
    kind: string;
    post?: RacePost;
};

export const RACES: Race[] = [
    {
        id: 'letape-greece-2026',
        name: 'L’Étape Greece by Tour de France',
        date: '2026-04-04',
        location: 'Sparta',
        kind: 'Road race · 140 km',
        post: {
            result: '140 km · 1,700 m climbing · finished!',
            body: [
                'My first official bike race, and it was tough. L’Étape Greece came to Sparta for the first time: one big loop of 140 km with about 1,700 m of climbing, starting and finishing right under the statue of Leonidas.',
                'The road went up almost straight away, climbing towards Mystras with snow still sitting on Taygetos. From there it ran south through the Evrotas valley all the way down to the sea at Gytheio, and then turned back north for the long way home to Sparta.',
                'The second half was the hard part. The legs were empty well before the end, and the feed stations and the people handing out bottles at the roadside made a real difference.',
                'Rolling back into Sparta, crossing the line in front of Leonidas and getting the medal made all of it worth it. A lot to learn for the next one, but I want more of this.',
            ],
            photos: [
                {
                    src: 'races/letape-greece-2026/taygetos.jpg',
                    caption: 'early kms, snow on Taygetos',
                    alt: 'Riding in a blue jacket on an empty road, with snow-capped mountains behind',
                },
                {
                    src: 'races/letape-greece-2026/feed-zone.jpg',
                    caption: 'grabbing a bottle on the go',
                    alt: 'Taking a water bottle from a volunteer while riding, race number 322',
                },
                {
                    src: 'races/letape-greece-2026/finish-leonidas.jpg',
                    caption: 'done! medal + Leonidas',
                    alt: 'Standing with the Merida Reacto and the finisher medal in front of the Leonidas statue in Sparta',
                },
            ],
            route: {
                // The organiser's official course file for The Race (L'Étape Greece 2026).
                gpx: 'races/letape-greece-2026/route.gpx',
                places: [
                    { label: 'Sparta', lat: 37.0784, lon: 22.4286 },
                    { label: 'Mystras climb', lat: 37.0782, lon: 22.3573, side: 'left' },
                    { label: 'Gytheio', lat: 36.7584, lon: 22.5539 },
                ],
            },
        },
    },
    {
        id: 'rbr-rotterdam-2027',
        name: 'RBR Rotterdam',
        date: '2027-04-03',
        location: 'Rotterdam',
        kind: 'Standard duathlon',
    },
];

const DAY = 24 * 60 * 60 * 1000;

export const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** Midnight at the start of a YYYY-MM-DD day, local time. */
const dayStart = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const racesInOrder = () => [...RACES].sort((a, b) => a.date.localeCompare(b.date));

/** Whole days from today to race day: negative once it's past, 0 on the day. */
export const daysUntil = (race: Race, now = new Date()) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((dayStart(race.date).getTime() - today.getTime()) / DAY);
};

export const isDone = (race: Race, now = new Date()) => daysUntil(race, now) < 0;

/** "Sat 3 Apr 2027" */
export const raceDay = (race: Race) =>
    dayStart(race.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Objects in the room that open the calendar: the bag and what hangs off it. */
const CALENDAR_OBJECTS = new Set(['Triathlon_bag', 'Swim_goggles', 'Swim_cap']);

export const opensRaceCalendar = (name: string) => CALENDAR_OBJECTS.has(name);
