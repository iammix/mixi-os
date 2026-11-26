// Draws the cork training board: a note with the month on it, an index card each for swim, bike
// and run (distance, sessions and moving time this month, from Garmin), a race bib whose number
// is the days to the next race, and a sticky note with the month's total time. Used for the
// board's texture in the room (TrainingBoard) and for its close-up (TrainingBoardCloseUp).

import { HAND, INK, RED } from './handwriting';
import { Race, raceDay } from './races';
import { SPORTS, Sport, TrainingState, currentMonth, daysToGo, distance, duration, monthLabel, sessions } from './training';

/** The board is laid out on a 1536 x 1024 sheet (3:2, like the cork in the model) and scaled to fit. */
export const BOARD_WIDTH = 1536;
export const BOARD_HEIGHT = 1024;

const SPORT_STYLE: Record<Sport, { label: string; ink: string; pin: string }> = {
    swim: { label: 'SWIM', ink: '#2463a6', pin: '#2f7fd1' },
    bike: { label: 'BIKE', ink: '#c4511a', pin: '#e0662a' },
    run: { label: 'RUN', ink: '#2c7a4b', pin: '#38a160' },
};
const FADED = 'rgba(31, 47, 107, 0.8)';

/** What a card says instead of numbers when there are none to show. */
const NO_NUMBERS: Record<Exclude<TrainingState['status'], 'ready'>, string> = {
    off: 'not hooked up yet',
    loading: 'asking garmin…',
    error: "garmin's not answering",
};
const BIB_FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

type Ctx = CanvasRenderingContext2D;

/** A small seeded random number generator, so the cork looks the same every time. */
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function cork(ctx: Ctx) {
    ctx.fillStyle = '#b5875a';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    const random = seeded(7);
    for (let i = 0; i < 9000; i++) {
        const dark = random() < 0.6;
        ctx.fillStyle = dark ? `rgba(110, 70, 38, ${0.25 + random() * 0.35})` : `rgba(225, 184, 136, ${0.25 + random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(random() * BOARD_WIDTH, random() * BOARD_HEIGHT, 1 + random() * 2.6, 0, Math.PI * 2);
        ctx.fill();
    }
    const shade = ctx.createRadialGradient(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_HEIGHT * 0.35, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.62);
    shade.addColorStop(0, 'rgba(60, 35, 15, 0)');
    shade.addColorStop(1, 'rgba(60, 35, 15, 0.28)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
}

/** A push pin with a little shine and a shadow. */
function pin(ctx: Ctx, x: number, y: number, color: string) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x - 5, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
}

/** A safety pin, as on a race bib: a thin silver loop lying at an angle. */
function safetyPin(ctx: Ctx, x: number, y: number, angle: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c9cdd1';
    ctx.fillRect(18, -8, 12, 16);
    ctx.restore();
}

/** Lay out a piece of paper at (x, y), turned by `angle` about its middle, then draw on it. */
function paper(ctx: Ctx, x: number, y: number, w: number, h: number, angle: number, color: string, content: (ctx: Ctx) => void) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    ctx.translate(-w / 2, -h / 2);
    ctx.save();
    ctx.shadowColor = 'rgba(30, 15, 5, 0.4)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    content(ctx);
    ctx.restore();
}

/** Write `text` centred at `x`, shrinking it until it fits `maxWidth`. */
function write(ctx: Ctx, text: string, x: number, y: number, size: number, opts: { maxWidth?: number; bold?: boolean; color?: string; family?: string; align?: CanvasTextAlign } = {}) {
    const family = opts.family ?? HAND;
    let px = size;
    const font = () => `${opts.bold ? 700 : 400} ${px}px ${family}`;
    ctx.font = font();
    while (opts.maxWidth && px > 12 && ctx.measureText(text).width > opts.maxWidth) {
        px -= 2;
        ctx.font = font();
    }
    ctx.fillStyle = opts.color ?? INK;
    ctx.textAlign = opts.align ?? 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
}

function monthNote(ctx: Ctx, training: TrainingState) {
    const x = 70, y = 40, w = 560, h = 200;
    paper(ctx, x, y, w, h, -0.025, '#fffdf6', (c) => {
        write(c, 'this month', w / 2, 122, 96, { bold: true, maxWidth: w - 60 });
        write(c, monthLabel(training.totals?.month ?? currentMonth()), w / 2, 178, 58, { color: RED, maxWidth: w - 60 });
    });
    pin(ctx, x + w / 2, y + 16, '#d23a32');
}

const CARD = { y: 285, w: 300, h: 580 };
const CARD_X = [70, 405, 740];
const CARD_TILT = [-0.022, 0.016, -0.012];

function sportCard(ctx: Ctx, sport: Sport, training: TrainingState, i: number) {
    const style = SPORT_STYLE[sport];
    const month = training.totals?.[sport];
    const x = CARD_X[i];
    const { y, w, h } = CARD;
    paper(ctx, x, y, w, h, CARD_TILT[i], '#fbf8ef', (c) => {
        // Index card rules: one coloured line under the heading, faint blue ones below.
        c.fillStyle = 'rgba(70, 120, 200, 0.22)';
        for (let ly = 176; ly < h - 20; ly += 52) c.fillRect(16, ly, w - 32, 2);
        c.fillStyle = style.ink;
        c.fillRect(16, 130, w - 32, 4);

        write(c, style.label, w / 2, 112, 80, { bold: true, color: style.ink });
        if (month) {
            write(c, distance(sport, month.km), w / 2, 270, 112, { bold: true, maxWidth: w - 36 });
            write(c, sessions(sport, month.sessions), w / 2, 350, 60, { maxWidth: w - 36, color: FADED });
            write(c, duration(month.seconds), w / 2, 480, 76, { bold: true, color: style.ink, maxWidth: w - 36 });
            write(c, 'moving', w / 2, 528, 40, { color: FADED });
        } else {
            write(c, '–', w / 2, 290, 140, { bold: true });
            write(c, NO_NUMBERS[training.status as keyof typeof NO_NUMBERS], w / 2, 400, 46, { maxWidth: w - 36, color: FADED });
        }
    });
    pin(ctx, x + w / 2, y + 16, style.pin);
}

function raceBib(ctx: Ctx, next: { race: Race; days: number } | null) {
    const x = 1075, y = 80, w = 400, h = 530;
    paper(ctx, x, y, w, h, 0.03, '#ffffff', (c) => {
        c.fillStyle = '#c8322b';
        c.fillRect(0, 0, w, 92);
        write(c, 'NEXT RACE', w / 2, 66, 50, { bold: true, color: '#ffffff', family: BIB_FONT });
        if (next) {
            write(c, String(next.days), w / 2, 290, 200, { bold: true, color: '#111111', family: BIB_FONT, maxWidth: w - 50 });
            write(c, daysToGo(next.days), w / 2, 350, 58, { color: RED });
            write(c, next.race.name, w / 2, 420, 54, { bold: true, maxWidth: w - 40 });
            write(c, raceDay(next.race), w / 2, 466, 38, { maxWidth: w - 120, color: 'rgba(31, 47, 107, 0.8)' });
        } else {
            write(c, '—', w / 2, 290, 200, { bold: true, color: '#111111', family: BIB_FONT });
            write(c, 'no race booked… yet', w / 2, 400, 54, { maxWidth: w - 40 });
        }
        safetyPin(c, 34, 128, -0.5);
        safetyPin(c, w - 34, 128, 0.5);
        safetyPin(c, 34, h - 22, 0.5);
        safetyPin(c, w - 34, h - 22, -0.5);
    });
}

function totalNote(ctx: Ctx, training: TrainingState) {
    const x = 1110, y = 660, w = 330, h = 300;
    const totals = training.totals;
    paper(ctx, x, y, w, h, -0.04, '#f7e27a', (c) => {
        write(c, 'all in', w / 2, 80, 64, { bold: true });
        if (totals) {
            const seconds = SPORTS.reduce((sum, s) => sum + totals[s].seconds, 0);
            const count = SPORTS.reduce((sum, s) => sum + totals[s].sessions, 0);
            write(c, duration(seconds), w / 2, 185, 104, { bold: true, maxWidth: w - 30, color: RED });
            write(c, `${count} session${count === 1 ? '' : 's'}`, w / 2, 250, 48, { maxWidth: w - 30 });
        } else {
            write(c, '–', w / 2, 200, 120, { bold: true, color: RED });
        }
    });
}

/** Draw the whole board, filling a canvas of any size with the same 3:2 layout. */
export function drawTrainingBoard(ctx: Ctx, width: number, height: number, training: TrainingState, next: { race: Race; days: number } | null) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(width / BOARD_WIDTH, height / BOARD_HEIGHT);
    cork(ctx);
    monthNote(ctx, training);
    SPORTS.forEach((sport, i) => sportCard(ctx, sport, training, i));
    raceBib(ctx, next);
    totalNote(ctx, training);
    ctx.restore();
}
