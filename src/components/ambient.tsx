import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { stage, hooks, INTRO_PLAYS, INTRO_PATH } from "../lib/intro";
import { MOBILE } from "../lib/device";

// Paleta: ciepłe światło (bursztyn, złoto, szampan, miedź) na chłodnym granacie
const COLORS = {
  amber: "255 176 96",
  gold: "255 200 130",
  champagne: "255 230 190",
  copper: "226 142 94",
  slate: "70 96 156",
  navy: "34 56 112",
};

type Blob = {
  rgb: string;
  size: number; // vmax
  alpha: number; // jasność środka plamy
  depth: number; // 0-1: jak mocno plama reaguje na światło przy kursorze (paralaksa)
  period: number; // s: okres głównego ruchu dryfu
  sway: [number, number]; // vw, vh: amplituda dryfu
  breathe: number; // amplituda oddychania skali
  x: number[]; // vw: pozycja (lewy górny róg) w sekcjach: hero, o mnie, wir, CodeTime
  y: number[]; // vh
  o: number[]; // jasność w kolejnych sekcjach
};

const ALL_BLOBS: Blob[] = [
  {
    // źródło ciepła w lewym górnym rogu
    rgb: COLORS.amber,
    size: 78,
    alpha: 0.5,
    depth: 0.35,
    period: 28,
    sway: [4, 3],
    breathe: 0.12,
    x: [-22, -12, -16, -8],
    y: [-34, -26, -14, -22],
    o: [1, 0.55, 0.45, 0.4],
  },
  {
    rgb: COLORS.slate,
    size: 66,
    alpha: 0.5,
    depth: 0.55,
    period: 33,
    sway: [5, 4],
    breathe: 0.1,
    x: [52, 60, 48, 56],
    y: [-20, -6, -14, 0],
    o: [0.55, 0.7, 0.75, 0.6],
  },
  {
    rgb: COLORS.copper,
    size: 54,
    alpha: 0.4,
    depth: 0.75,
    period: 24,
    sway: [3.5, 5],
    breathe: 0.14,
    x: [14, 4, -6, 8],
    y: [48, 40, 24, 12],
    o: [0.45, 0.5, 0.5, 0.5],
  },
  {
    rgb: COLORS.navy,
    size: 64,
    alpha: 0.6,
    depth: 0.5,
    period: 31,
    sway: [4.5, 3.5],
    breathe: 0.1,
    x: [60, 44, 52, 40],
    y: [-10, 26, 30, 10],
    o: [0.7, 0.6, 0.6, 0.7],
  },
  {
    rgb: COLORS.champagne,
    size: 30,
    alpha: 0.38,
    depth: 1,
    period: 19,
    sway: [6, 5],
    breathe: 0.18,
    x: [40, 20, 52, 28],
    y: [-6, 10, 30, 12],
    o: [0.35, 0.4, 0.45, 0.35],
  },
];

// telefon: cztery główne plamy (bez małej, szampańskiej); mniej warstw do kompozycji
const BLOBS = MOBILE ? ALL_BLOBS.slice(0, 4) : ALL_BLOBS;

// barwy światła przy kursorze i ich "kotwice" na ekranie (0-1)
const LIGHT = [
  { rgb: COLORS.gold, x: 0.12, y: 0.2 },
  { rgb: COLORS.champagne, x: 0.5, y: 0.5 },
  { rgb: COLORS.copper, x: 0.9, y: 0.25 },
  { rgb: COLORS.amber, x: 0.5, y: 0.95 },
];

// ---------- smugi światła (god rays) ----------
type Ray = {
  rgb: string;
  angle: number; // stopnie od pionu, w prawo i w dół
  width: number; // vmax
  alpha: number;
  sway: number; // stopnie: amplituda kołysania
  period: number; // s
  phase: number;
};
const ALL_RAYS: Ray[] = [
  {
    rgb: COLORS.gold,
    angle: 11,
    width: 5,
    alpha: 0.5,
    sway: 1.6,
    period: 23,
    phase: 0.4,
  },
  {
    rgb: COLORS.champagne,
    angle: 18,
    width: 12,
    alpha: 0.34,
    sway: 2.2,
    period: 31,
    phase: 1.9,
  },
  {
    rgb: COLORS.amber,
    angle: 25,
    width: 7,
    alpha: 0.6,
    sway: 1.4,
    period: 27,
    phase: 3.1,
  },
  {
    rgb: COLORS.gold,
    angle: 33,
    width: 15,
    alpha: 0.28,
    sway: 2.6,
    period: 37,
    phase: 4.4,
  },
  {
    rgb: COLORS.copper,
    angle: 41,
    width: 6,
    alpha: 0.42,
    sway: 1.8,
    period: 25,
    phase: 5.2,
  },
  {
    rgb: COLORS.champagne,
    angle: 52,
    width: 11,
    alpha: 0.2,
    sway: 2.4,
    period: 41,
    phase: 0.9,
  },
];
// telefon: trzy smugi (szeroka szampańska, bursztynowa i miedziana)
const RAYS = MOBILE ? [1, 2, 4].map((i) => ALL_RAYS[i]) : ALL_RAYS;
const RAY_SOURCE = { x: -0.07, y: -0.16 }; // ułamek ekranu (poza kadrem)
const RAY_LENGTH = 100; // vmax
const RAY_O = [1, 0.8, 0.5, 0.62]; // jasność smug w kolejnych sekcjach (po postępie scrolla)
const LEAK_O = [1, 0.8, 0.45, 0.7]; // jasność przecieku światła w kolejnych sekcjach

// mgła przy dole kadru
const ALL_FOG = [
  {
    rgb: COLORS.slate,
    alpha: 0.55,
    w: 120,
    h: 52,
    x: 0.3,
    y: 1.0,
    o: 0.9,
    period: 46,
  },
  {
    rgb: COLORS.copper,
    alpha: 0.28,
    w: 90,
    h: 36,
    x: 0.74,
    y: 0.97,
    o: 0.7,
    period: 61,
  },
];

// telefon: jedna mgła przy dole kadru
const FOG = MOBILE ? ALL_FOG.slice(0, 1) : ALL_FOG;

// ---------- strojenie ----------
const TUNING = {
  parallax: 34, // px: maks. przesunięcie najgłębszej plamy pod wpływem światła
  idleMs: 2800, // po tylu ms bez ruchu myszy światło zaczyna wędrować samo
  scrollLag: 3.2, // jak szybko tło dogania scroll (większe = żywiej)
  // sprężyny: k = sztywność, c = tłumienie. Im mniejsze k, tym większa bezwładność.
  tight: { size: MOBILE ? 240 : 300, alpha: 0.5, k: 260, c: 34 },
  core: { size: MOBILE ? 560 : 760, alpha: 0.36, k: 80, c: 15 },
  halo: { size: 1700, alpha: 0.2, k: 26, c: 8 },
};

// bokeh: złote cząstki z głębią ostrości (ustaw count na 0, żeby wyłączyć)
const BOKEH = {
  count: MOBILE ? 64 : 560, // telefon: kilkadziesiąt dużych, rozmytych krążków zamiast setek iskier
  speed: 7, // px/s dla najbliższej warstwy
  lightRadius: 560, // px: zasięg rozświetlania przez światło kursora
  idle: 0.8, // jasność bazowa
  lit: 0.7, // dodatkowa jasność w świetle kursora
  beam: 1.1, // dodatkowa jasność wewnątrz smug
};

// kolory cząstek: złoto, szampan, miedź, jasny biały
const HUES = ["255 200 128", "255 232 196", "238 160 104", "255 246 232"];

const PULSE = 900; // px: rozmiar fali światła przy kliknięciu
const BASE = "#0d111c";

// słabszy sprzęt: bez mieszania screen, dryfu i pyłu (dodatkowo jest też adaptacja w locie)
// (telefony zgłaszają 4-6 rdzeni także przy mocnych procesorach, a i tak mają własną,
// lżejszą ścieżkę MOBILE, więc ich tym nie karzemy)
const LITE =
  !MOBILE &&
  typeof navigator !== "undefined" &&
  (navigator.hardwareConcurrency ?? 8) <= 4;

// Telefon: bez mix-blend-mode i filtrów (to najdroższe rzeczy dla GPU telefonu), bez ziarna,
// winiety intro, najazdu kamery, fal po tapnięciu i warstw pomocniczych. Cząstki są mniej
// liczne, większe i bardziej rozmyte (SOFT dokłada rozmycia, DISC powiększa krążki, GAIN
// dokłada jasności, żeby mniej cząstek dawało podobny efekt), a tło jest aktualizowane
// co drugą klatkę (30 fps wystarcza dla tak wolnych ruchów i zostawia czas na scroll).
const SIMPLE = LITE || MOBILE;
const SOFT = MOBILE ? 0.42 : 0;
const DISC = MOBILE ? 1.7 : 1;
const GAIN = MOBILE ? 1.5 : 1;
const MOBILE_STEP_MS = 30;

// ---------- pomocnicze ----------
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// Radialny gradient o gaussowskim spadku jasności: zero na krawędzi, brak pasm i krawędzi
function glow(rgb: string, alpha: number, stops = 16): string {
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops; // 0 = środek, 1 = krawędź
    const a = alpha * Math.exp(-4.2 * t * t) * (1 - t ** 6);
    parts.push(`rgb(${rgb} / ${a.toFixed(4)}) ${(t * 100).toFixed(1)}%`);
  }
  return `radial-gradient(closest-side, ${parts.join(", ")})`;
}

// Pasmo o gaussowskim przekroju (miękkie krawędzie smugi); spread = wariancja
function strip(rgb: string, peak: number, spread = 0.04, stops = 20): string {
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = peak * Math.exp(-((t - 0.5) ** 2) / spread);
    parts.push(`rgb(${rgb} / ${a.toFixed(4)}) ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

// Zanikanie smugi wzdłuż długości
const RAY_MASK =
  "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.7) 20%, rgb(0 0 0 / 0.2) 48%, transparent 85%)";

// Gładka krzywa przez punkty kluczowe (Catmull-Rom), u w [0, 1]
function sample(values: number[], u: number): number {
  const n = values.length - 1;
  const f = clamp01(u) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(n, i + 2)];
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
}

type Mass = { x: number; y: number; vx: number; vy: number };
const makeMass = (x: number, y: number): Mass => ({ x, y, vx: 0, vy: 0 });

// Sprężyna z podkrokami (stabilna także przy dłuższych klatkach)
function spring(
  m: Mass,
  tx: number,
  ty: number,
  k: number,
  c: number,
  dt: number,
) {
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    m.vx += (k * (tx - m.x) - c * m.vx) * h;
    m.vy += (k * (ty - m.y) - c * m.vy) * h;
    m.x += m.vx * h;
    m.y += m.vy * h;
  }
}

// Wagi barw światła w zależności od pozycji (suma = 1, więc jasność jest stała)
function lightWeights(nx: number, ny: number, out: number[]) {
  let sum = 0;
  LIGHT.forEach((anchor, i) => {
    const dx = nx - anchor.x;
    const dy = (ny - anchor.y) * 0.8;
    out[i] = Math.exp(-(dx * dx + dy * dy) / 0.157);
    sum += out[i];
  });
  for (let i = 0; i < out.length; i++) out[i] /= sum || 1;
}

// ---------- cząstki ----------
type Mote = {
  x: number; // 0-1
  y: number; // 0-1
  z: number; // 0-1, 1 = najbliżej
  size: number; // px: rozmiar punktu w ostrości
  a: number; // jasność bazowa
  phase: number;
  rate: number;
  sway: number; // px: kołysanie na boki
  swayRate: number;
  dx: number;
  dy: number;
  hue: number;
};

const pickHue = () => {
  const r = Math.random();
  return r < 0.45 ? 0 : r < 0.62 ? 1 : r < 0.92 ? 2 : 3;
};

const makeMote = (z: number, size: number, a: number): Mote => ({
  x: Math.random(),
  y: Math.random(),
  z,
  size,
  a,
  phase: Math.random() * Math.PI * 2,
  rate: 0.4 + Math.random() * 1.1,
  sway: 8 + Math.random() * 26,
  swayRate: 0.12 + Math.random() * 0.3,
  dx: (Math.random() - 0.5) * 0.5,
  dy: -(0.5 + Math.random() * 0.5),
  hue: pickHue(),
});

const makeDust = (count: number): Mote[] => [
  ...Array.from({ length: count }, () => {
    const z = Math.random();
    return makeMote(
      z,
      1.3 + z * 3.2 + Math.random(),
      0.35 + 0.65 * Math.random() ** 1.5,
    );
  }),
  // pierwszy plan: duże, bardzo miękkie plamy tuż przed obiektywem (głębia jak w filmie)
  ...Array.from(
    { length: Math.max(MOBILE ? 4 : 8, Math.round(count * 0.025)) },
    () =>
      makeMote(
        1.15 + Math.random() * 0.15,
        12 + Math.random() * 14,
        0.4 + 0.4 * Math.random(),
      ),
  ),
];

// Sprite'y cząstek: 0 = iskra, 1 = bokeh (tarcza z jaśniejszą obwódką), 2 = welon (miękka poświata)
function makeSprite(
  kind: 0 | 1 | 2,
  rgb: string,
  size = 96,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  const r = size / 2;
  const rgba = rgb.split(" ").join(", ");
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  const stops = 40;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    let a: number;
    if (kind === 0) {
      a = Math.exp(-t * t * 10);
    } else if (kind === 1) {
      const edge = t < 0.84 ? 1 : Math.max(0, 1 - (t - 0.84) / 0.16);
      a = (0.46 + 0.26 * Math.exp(-(((t - 0.8) / 0.09) ** 2))) * edge * edge;
    } else {
      a = 0.55 * Math.exp(-t * t * 3.4) * (1 - t ** 6);
    }
    grad.addColorStop(t, `rgba(${rgba}, ${a.toFixed(4)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  if (kind === 0) {
    // gorący, prawie biały środek iskry
    const core = g.createRadialGradient(r, r, 0, r, r, r);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      core.addColorStop(
        t,
        `rgba(255, 252, 244, ${(0.95 * Math.exp(-t * t * 70)).toFixed(4)})`,
      );
    }
    g.fillStyle = core;
    g.fillRect(0, 0, size, size);
  }
  return canvas;
}

const buildSprites = () =>
  HUES.map((hue) => ([0, 1, 2] as const).map((kind) => makeSprite(kind, hue)));

const stamp = (
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  d: number,
  alpha: number,
) => {
  if (alpha < 0.008) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
};

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

// stała sekwencja pozycji ziarna (tempo taśmy filmowej, bez losowego migotania)
const GRAIN_STEPS: [number, number][] = [
  [0, 0],
  [-61, 37],
  [43, -72],
  [-24, -49],
  [70, 18],
  [-80, -12],
  [12, 66],
  [-47, 74],
  [58, -31],
  [-7, -85],
];

export function Ambient() {
  const root = useRef<HTMLDivElement>(null);
  const tightRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = root.current;
    const tightEl = tightRef.current;
    const coreEl = coreRef.current;
    const haloEl = haloRef.current; // na telefonie go nie ma
    const grainEl = grainRef.current; // na telefonie go nie ma
    if (!rootEl || !tightEl || !coreEl) return;

    const dustCanvas = dustRef.current;
    const dustCtx = dustCanvas?.getContext("2d") ?? null;

    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    let lite = LITE;
    let alive = !calm && !lite; // dryf i paralaksa
    let dustOn = alive && BOKEH.count > 0 && dustCtx !== null;

    const blobEls = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-blob]"),
    );
    const blendEls = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-blend]"),
    );
    const pulses = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-pulse]"),
    );
    const rayEls = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-ray]"),
    );
    const fogEls = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-fog]"),
    );
    const rayGroup = rootEl.querySelector<HTMLElement>("[data-rays]");
    const streakEl = rootEl.querySelector<HTMLElement>("[data-streak]");
    const stageEl = rootEl.querySelector<HTMLElement>("[data-stage]");
    const laneEl = rootEl.querySelector<HTMLElement>("[data-lane]");
    const leakEl = rootEl.querySelector<HTMLElement>("[data-leak]");
    // światło wychodzi z kropki kursora (jeśli istnieje), a nie z surowej pozycji myszy
    const dotEl = document.querySelector<HTMLElement>("[data-cursor-dot]");
    const layers = [
      Array.from(tightEl.children) as HTMLElement[],
      Array.from(coreEl.children) as HTMLElement[],
      ...(haloEl ? [Array.from(haloEl.children) as HTMLElement[]] : []),
    ];

    const view = { w: window.innerWidth, h: window.innerHeight };
    const wander = (t: number) => ({
      x: view.w * (0.5 + 0.3 * Math.sin(t * 0.21)),
      y: view.h * (0.46 + 0.22 * Math.cos(t * 0.16 + 1)),
    });

    const start = wander(0);
    const pointer = { x: start.x, y: start.y };
    const tight = makeMass(start.x, start.y);
    const core = makeMass(start.x, start.y);
    const halo = makeMass(start.x, start.y);
    const par = { x: 0, y: 0 };
    const scroll = { p: 0, target: 0, v: 0, ready: false };
    const shadeEl = shadeRef.current;
    let lastGrain = "";
    let lastShade = "";
    const weights = LIGHT.map(() => 0);
    const shown = LIGHT.map(() => -1);
    // liczba cząstek rośnie z powierzchnią ekranu (ultra-wide, 4K), żeby gęstość była ta sama
    const moteCount = () =>
      MOBILE
        ? BOKEH.count
        : clamp(
            Math.round((BOKEH.count * view.w * view.h) / (1920 * 1080)),
            360,
            1000,
          );
    const motes = dustOn ? makeDust(moteCount()) : [];
    const sprites = dustOn ? buildSprites() : [];

    // geometria smug w bieżącej klatce (czytana też przez cząstki)
    const rayS = new Float64Array(RAYS.length);
    const rayC = new Float64Array(RAYS.length);
    const rayW = new Float64Array(RAYS.length);
    const rayA = new Float64Array(RAYS.length);

    let lastMove = -Infinity;
    let hasPointer = false;
    let follow = 0; // 0 = światło wędruje samo, 1 = podąża za kursorem
    let energy = 0; // 0-1: jak szybko poruszasz myszą
    let vel = 0; // 0-1: jak szybko przewijasz stronę
    let kick = 0; // 0-1: chwilowe "przeostrzenie" na bliższy plan po fali światła
    let dirX = 1; // kierunek ruchu światła (wygładzony), do rozciągnięcia plamy
    let dirY = 0;
    let kickTarget = 0; // cel dla kick: narasta szybko, opada wolno (bez skoku)
    let zoomed = false;

    let time = 0;
    let grainClock = 0;
    let grainIndex = 0;
    let pulseIndex = 0;
    let frames = 0;
    let frameSum = 0;

    const sizeDust = () => {
      if (!dustCanvas || !dustCtx) return;
      // telefon: płótno w ok. 0,6 rozdzielczości ekranu; cząstki są miękkie, więc różnicy
      // nie widać, a do narysowania jest kilka razy mniej pikseli
      const dpr = MOBILE ? 0.6 : Math.min(window.devicePixelRatio || 1, 2);
      dustCanvas.width = Math.round(view.w * dpr);
      dustCanvas.height = Math.round(view.h * dpr);
      dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeDust();

    // gdy komputer nie wyrabia, wyłączamy najdroższe efekty zamiast dopuścić do zacinania
    const degrade = () => {
      if (lite) return;
      lite = true;
      alive = false;
      dustOn = false;
      blendEls.forEach((el) => {
        el.style.mixBlendMode = "normal";
      });
      if (rayGroup) rayGroup.style.filter = "none";
      dustCtx?.clearRect(0, 0, view.w, view.h);
    };

    const place = (
      el: HTMLElement,
      m: Mass,
      scale: number,
      opacity: number,
      stretch = 0,
      angle = 0,
    ) => {
      el.style.transform =
        stretch > 0.002
          ? `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${angle.toFixed(3)}rad) scale(${(scale * (1 + stretch)).toFixed(3)}, ${scale.toFixed(3)})`
          : `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
    };

    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 50) / 1000;
      time += dt;
      kick += (kickTarget - kick) * (1 - Math.exp(-dt * 5));
      kickTarget *= Math.exp(-dt * 0.9);

      // intro: powolny najazd kamery (scena startuje lekko powiększona)
      if (stage.zoom > 0.001) {
        rootEl.style.transform = `scale(${(1 + 0.05 * stage.zoom).toFixed(4)})`;
        zoomed = true;
      } else if (zoomed) {
        rootEl.style.transform = "";
        zoomed = false;
      }

      // 1. postęp scrolla (wygładzony) i energia przewijania
      scroll.p +=
        (scroll.target - scroll.p) * (1 - Math.exp(-dt * TUNING.scrollLag));
      scroll.v *= Math.exp(-dt * 5);
      vel +=
        (clamp01(Math.abs(scroll.v) / 2500) - vel) * (1 - Math.exp(-dt * 4));

      // 2. cel światła: kropka kursora albo spokojna wędrówka, z płynnym przejściem
      let px = pointer.x;
      let py = pointer.y;
      if (dotEl && hasPointer) {
        const dx = Number(gsap.getProperty(dotEl, "x"));
        const dy = Number(gsap.getProperty(dotEl, "y"));
        if (Number.isFinite(dx) && Number.isFinite(dy)) {
          px = dx;
          py = dy;
        }
      }
      const idle = performance.now() - lastMove > TUNING.idleMs;
      const wantsPointer = hasPointer && !idle && !coarse;
      follow +=
        ((wantsPointer ? 1 : 0) - follow) *
        (1 - Math.exp(-dt * (wantsPointer ? 6 : 1.4)));
      const eased = follow * follow * (3 - 2 * follow);
      const w = wander(time);
      let tx = calm ? (hasPointer ? px : view.w * 0.3) : lerp(w.x, px, eased);
      let ty = calm ? (hasPointer ? py : view.h * 0.35) : lerp(w.y, py, eased);

      // intro: scenariusz przejmuje światło, potem płynnie je oddaje
      if (stage.script > 0.001) {
        tx = lerp(tx, sample(INTRO_PATH.x, stage.path) * view.w, stage.script);
        ty = lerp(ty, sample(INTRO_PATH.y, stage.path) * view.h, stage.script);
      }

      // 3. sprężyny o różnej bezwładności
      if (calm) {
        for (const m of [tight, core, halo]) {
          m.x = tx;
          m.y = ty;
          m.vx = 0;
          m.vy = 0;
        }
      } else {
        spring(tight, tx, ty, TUNING.tight.k, TUNING.tight.c, dt);
        spring(core, tx, ty, TUNING.core.k, TUNING.core.c, dt);
        spring(halo, tx, ty, TUNING.halo.k, TUNING.halo.c, dt);
      }

      // 4. energia ruchu (szybki ruch myszą lub scroll lekko powiększają i rozjaśniają światło)
      const speed = Math.hypot(core.vx, core.vy);
      energy += (clamp01(speed / 1800) - energy) * (1 - Math.exp(-dt * 5));
      const lift = Math.max(energy, vel * 0.6, stage.boost);
      // skala interfejsu: światło i cząstki rosną razem z ekranem (ultra-wide, 4K)
      const ui = clamp(Math.min(view.w, view.h) / 1080, 0.85, 2.4);
      // światło lekko rozciąga się wzdłuż ruchu, jak przy długiej ekspozycji
      const lightSpeed = Math.hypot(tight.vx, tight.vy);
      if (lightSpeed > 60) {
        const k = 1 - Math.exp(-dt * 6);
        dirX += (tight.vx / lightSpeed - dirX) * k;
        dirY += (tight.vy / lightSpeed - dirY) * k;
      }
      const lightAngle = Math.atan2(dirY, dirX);
      const stretch = clamp01((lightSpeed - 120) / 1600) * 0.35;
      const reveal = stage.light;
      const grow = 0.7 + 0.3 * reveal;
      // różne wykładniki: iskra rośnie pierwsza, halo doganiają na końcu (bloom)
      const sz = stage.size;
      place(
        tightEl,
        tight,
        ui * grow * sz ** 0.55 * (1 + 0.04 * lift),
        reveal * (0.88 + 0.2 * lift),
        stretch,
        lightAngle,
      );
      place(
        coreEl,
        core,
        ui * grow * sz * (1 + 0.06 * lift),
        reveal * (0.9 + 0.15 * lift),
        stretch * 0.6,
        lightAngle,
      );
      if (haloEl) {
        place(
          haloEl,
          halo,
          ui * grow * sz ** 1.7 * (1 + 0.02 * lift),
          reveal * (0.95 + 0.06 * lift),
        );
      }

      // 5. barwa światła zależy od pozycji i bardzo wolno dryfuje w czasie
      const nx = clamp01(core.x / view.w + 0.12 * Math.sin(time * 0.11));
      const ny = clamp01(core.y / view.h + 0.08 * Math.cos(time * 0.09));
      lightWeights(nx, ny, weights);
      weights.forEach((weight, i) => {
        const rounded = Math.round(weight * 250) / 250;
        if (rounded === shown[i]) return;
        shown[i] = rounded;
        const visibility = rounded < 0.02 ? "hidden" : "visible"; // ukryte warstwy nie wchodzą do kompozycji
        for (const group of layers) {
          group[i].style.opacity = rounded.toFixed(3);
          group[i].style.visibility = visibility;
        }
      });

      // 6. plamy: trasa ze scrollem + organiczny dryf + paralaksa od światła
      if (alive) {
        const k = 1 - Math.exp(-2 * dt);
        par.x += ((core.x / view.w - 0.5) * 2 - par.x) * k;
        par.y += ((core.y / view.h - 0.5) * 2 - par.y) * k;
      }
      BLOBS.forEach((b, i) => {
        const phase = i * 2.399; // kąt złoty: plamy nie poruszają się zgodnie
        const omega = (Math.PI * 2) / b.period;
        let dx = 0;
        let dy = 0;
        let breathing = 1;
        let flicker = 1;
        let ox = 0;
        let oy = 0;
        if (alive) {
          dx =
            ((Math.sin(omega * time + phase) +
              0.45 * Math.sin(omega * 1.618 * time + phase * 1.3)) *
              b.sway[0] *
              view.w) /
            100;
          dy =
            ((Math.cos(omega * 0.83 * time + phase * 0.7) +
              0.45 * Math.sin(omega * 1.272 * time + phase)) *
              b.sway[1] *
              view.h) /
            100;
          breathing =
            1 +
            b.breathe *
              (0.5 + 0.5 * Math.sin(omega * 0.7 * time + phase * 0.8));
          flicker = 0.93 + 0.07 * Math.sin(omega * 1.9 * time + phase);
          ox = -par.x * b.depth * TUNING.parallax;
          oy = -par.y * b.depth * TUNING.parallax;
        }
        // intro: każda plama startuje ze środka światła i płynie na swoje miejsce (z opóźnieniem)
        const e = smooth(clamp01(stage.bloom * 1.6 - i * 0.12));
        const half =
          (b.size * Math.min(Math.max(view.w, view.h), view.h * 2)) / 200;
        const x = lerp(
          core.x - half,
          (sample(b.x, scroll.p) / 100) * view.w + dx + ox,
          e,
        );
        const y = lerp(
          core.y - half,
          (sample(b.y, scroll.p) / 100) * view.h + dy + oy,
          e,
        );
        const born = lerp(0.3, 1, e);
        const stretch = breathing * (1 + 0.1 * vel);
        const el = blobEls[i];
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(breathing * born).toFixed(4)}, ${(stretch * born).toFixed(4)})`;
        el.style.opacity = clamp01(
          sample(b.o, scroll.p) * flicker * (1 + 0.12 * vel) * e,
        ).toFixed(3);
      });

      if (stageEl) {
        stageEl.style.opacity = alive
          ? (0.85 + 0.15 * Math.sin(time * 0.35)).toFixed(3)
          : "1";
      }

      // 7. smugi światła: kołyszą się, oddychają i rozwijają się razem z intro
      const maxDim = Math.max(view.w, view.h);
      // na ultra-wide plamy i smugi nie rosną ponad dwukrotność wysokości ekranu
      const refDim = Math.min(maxDim, view.h * 2);
      const rayO = sample(RAY_O, scroll.p);
      const sx = view.w * RAY_SOURCE.x - par.x * 16;
      const sy = view.h * RAY_SOURCE.y - par.y * 10;
      rayEls.forEach((el, i) => {
        const r = RAYS[i];
        const omega = (Math.PI * 2) / r.period;
        const sway = alive ? Math.sin(omega * time + r.phase) * r.sway : 0;
        const breathe = alive
          ? 0.78 + 0.22 * Math.sin(omega * 1.43 * time + r.phase * 1.7)
          : 1;
        const angle = r.angle + sway + par.x * 0.6;
        const e = smooth(clamp01(stage.rays * 1.5 - i * 0.1));
        const widthPx = (r.width * refDim) / 100;
        const theta = (angle * Math.PI) / 180;
        rayS[i] = Math.sin(theta);
        rayC[i] = Math.cos(theta);
        rayW[i] = 1 / (widthPx * 0.55);
        rayA[i] = r.alpha * breathe * rayO * e * reveal;
        el.style.transform = `translate3d(${(sx - widthPx / 2).toFixed(1)}px, ${sy.toFixed(1)}px, 0) rotate(${(-angle).toFixed(3)}deg) scaleY(${(0.35 + 0.65 * e).toFixed(3)})`;
        el.style.opacity = clamp01(rayA[i] * (1 + 0.08 * lift)).toFixed(3);
      });

      // 8. mgła i smuga anamorficzna (smuga tylko w intro)
      fogEls.forEach((el, i) => {
        const f = FOG[i];
        const sway = alive
          ? Math.sin(((Math.PI * 2) / f.period) * time + i * 2.1)
          : 0;
        const x = view.w * (f.x + 0.09 * sway);
        const y = view.h * f.y;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = (
          reveal *
          f.o *
          (alive ? 0.85 + 0.15 * Math.sin(time * 0.21 + i) : 1)
        ).toFixed(3);
      });
      if (streakEl) {
        const k = clamp01(stage.boost * 0.8 + stage.streak);
        streakEl.style.transform = `translate3d(${tight.x.toFixed(1)}px, ${tight.y.toFixed(1)}px, 0) translate(-50%, -50%) scaleX(${(0.5 + 0.5 * k).toFixed(3)})`;
        streakEl.style.opacity = (reveal * 0.6 * k).toFixed(3);
      }

      // 8b. pas światła pod wstęgą cząstek i ciepły przeciek przy lewej krawędzi
      if (laneEl) {
        const laneY =
          view.h * (0.66 - 0.2 * scroll.p + 0.03 * Math.sin(time * 0.13));
        laneEl.style.transform = `translate3d(0, ${(laneY - view.h * 0.11).toFixed(1)}px, 0)`;
        laneEl.style.opacity = (reveal * stage.dust * 0.9).toFixed(3);
      }
      if (leakEl) {
        const swing = alive ? Math.sin(time * 0.37) : 0;
        leakEl.style.transform = `translate3d(0, ${(swing * view.h * 0.08).toFixed(1)}px, 0)`;
        leakEl.style.opacity = (
          reveal *
          (alive ? 0.1 + 0.07 * Math.sin(time * 0.37 + 1) : 0.12) *
          sample(LEAK_O, scroll.p)
        ).toFixed(3);
      }

      // 9. bokeh: głębia ostrości, wstęga gęstości i rozświetlanie przez światło oraz smugi
      if (dustOn && dustCtx) {
        dustCtx.clearRect(0, 0, view.w, view.h);
        dustCtx.globalCompositeOperation = "lighter";

        // płaszczyzna ostrości wędruje powoli, przesuwa się ze scrollem i "skacze" po fali światła
        const focus = clamp01(
          0.62 - 0.32 * scroll.p + 0.1 * Math.sin(time * 0.11) + 0.3 * kick,
        );
        // wstęga cząstek: stoi na ekranie, a cząstki przepływają przez nią
        const bandY =
          view.h * (0.66 - 0.2 * scroll.p + 0.03 * Math.sin(time * 0.13));
        const bandH = view.h * 0.18;
        const unit = clamp(Math.min(view.w, view.h) / 900, 0.8, 2.6);
        // miejsce zapłonu: stąd cząstki wylatują w intro
        const burstX = view.w * INTRO_PATH.x[0];
        const burstY = view.h * INTRO_PATH.y[0];
        const pad = 90 * ui;
        const spanX = view.w + pad * 2;
        const spanY = view.h + pad * 2;
        const rayLen = ((RAY_LENGTH * refDim) / 100) * 0.8;

        for (const m of motes) {
          const drift = BOKEH.speed * ui * (0.3 + 0.7 * m.z) * time;
          let x =
            m.x * view.w +
            Math.sin(time * m.swayRate + m.phase) * m.sway * (0.4 + m.z) +
            m.dx * drift -
            par.x * m.z * 46;
          let y =
            m.y * view.h +
            m.dy * drift -
            scroll.p * view.h * 2.4 * m.z -
            par.y * m.z * 46;
          x = ((((x + pad) % spanX) + spanX) % spanX) - pad;
          y = ((((y + pad) % spanY) + spanY) % spanY) - pad;

          // intro: cząstki łagodnie rozchodzą się od miejsca zapłonu na swoje miejsca
          let flare = 1;
          let grow = 1;
          if (stage.burst < 0.999) {
            const away = Math.hypot(x - burstX, y - burstY) / (maxDim * 0.8);
            const t = clamp01(stage.burst * 1.3 - away * 0.3);
            const e = t * t * (3 - 2 * t); // miękki start i lądowanie
            x = lerp(burstX + (x - burstX) * 0.6, x, e);
            y = lerp(burstY + (y - burstY) * 0.6, y, e);
            flare = 1 + 4.8 * e * (1 - e); // miękki blask w połowie drogi
            grow = 0.6 + 0.4 * e;
          }

          // światło kursora tylko delikatnie rozjaśnia cząstki w swoim zasięgu
          const d = Math.hypot(x - core.x, y - core.y);
          const lit = Math.exp(-((d / (BOKEH.lightRadius * ui)) ** 2) * 1.6);

          // pokrycie smugami
          let beam = 0;
          const rx = x - sx;
          const ry = y - sy;
          for (let i = 0; i < RAYS.length; i++) {
            const along = rx * rayS[i] + ry * rayC[i];
            if (along <= 0) continue;
            const perp = (rx * rayC[i] - ry * rayS[i]) * rayW[i];
            beam +=
              rayA[i] *
              Math.exp(-perp * perp) *
              (1 - Math.min(1, along / rayLen));
          }

          const band = 0.16 + 0.84 * Math.exp(-(((y - bandY) / bandH) ** 2));
          const twinkle = 0.62 + 0.38 * Math.sin(time * m.rate + m.phase);
          const glint =
            m.z > 0.5 || lit > 0.25
              ? 0.9 *
                Math.max(0, Math.sin(time * m.rate * 0.31 + m.phase * 2.3)) **
                  14 *
                (1 + 2.2 * lit)
              : 0;
          const a =
            (BOKEH.idle * (0.4 + 0.6 * m.z) * band +
              BOKEH.lit * lit +
              BOKEH.beam * beam) *
            m.a *
            (twinkle + glint) *
            stage.dust *
            reveal *
            flare *
            GAIN;
          if (a < 0.01) continue;

          // głębia ostrości: iskra → bokeh → welon, płynnie wraz z rozmyciem
          // ostrość podąża za światłem: cząstki w jego zasięgu wyostrzają się
          const b =
            clamp01(Math.abs(m.z - focus) * 2.4 + stage.defocus + SOFT) *
            (1 - 0.5 * lit * (0.35 + 0.65 * eased));
          const mm = smooth(clamp01((b - 0.08) / 0.4));
          const nn = smooth(clamp01((b - 0.5) / 0.45));
          const set = sprites[m.hue];
          const coreD = m.size * unit * grow;
          const discD = (coreD * 1.7 + b * (16 + 30 * m.z) * unit) * DISC;

          stamp(dustCtx, set[0], x, y, coreD * 5, a * (1 - mm));
          stamp(
            dustCtx,
            set[1],
            x,
            y,
            discD,
            (a * mm * (1 - nn) * 1.4) / (1 + b * 1.6),
          );
          stamp(
            dustCtx,
            set[2],
            x,
            y,
            discD * 1.7,
            (a * mm * nn * 0.7) / (1 + b * 1.2),
          );
          if (mm < 0.5 && a > 0.4 && m.z > 0.55) {
            // ostre, jasne iskry dostają miękką halację
            stamp(dustCtx, set[2], x, y, coreD * 16, a * 0.16);
          }
        }

        dustCtx.globalAlpha = 1;
        dustCtx.globalCompositeOperation = "source-over";
      }

      // 10. ziarno filmowe: stała sekwencja w tempie ok. 11 klatek na sekundę
      if (!calm && grainEl) {
        grainClock += dt;
        if (grainClock > 0.09) {
          grainClock = 0;
          grainIndex = (grainIndex + 3) % GRAIN_STEPS.length;
          const [gx, gy] = GRAIN_STEPS[grainIndex];
          grainEl.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        }
      }

      // 11. intro: mocniejsze ziarno i zamknięta winieta na starcie
      const grainOpacity = (0.1 + 0.12 * stage.grain).toFixed(3);
      if (grainEl && grainOpacity !== lastGrain) {
        lastGrain = grainOpacity;
        grainEl.style.opacity = grainOpacity;
      }
      const shade = stage.vignette.toFixed(3);
      if (shadeEl && shade !== lastShade) {
        lastShade = shade;
        shadeEl.style.opacity = shade;
      }
    };

    // monitor płynności: pomijamy start, mierzymy ok. 100 klatek (dopiero po intro, żeby jego
    // start nie wpływał na pomiar). Liczy surowe klatki przeglądarki, także te, które na
    // telefonie pomijamy w rysowaniu tła.
    const monitor = (deltaMs: number) => {
      const settled =
        stage.script < 0.001 &&
        stage.light > 0.99 &&
        stage.vignette < 0.01 &&
        stage.zoom < 0.01;
      if (!lite && settled && frames < 150) {
        frames += 1;
        if (frames > 45 && deltaMs < 100) frameSum += deltaMs;
        if (frames === 150 && frameSum / 105 > (MOBILE ? 27 : 24)) degrade();
      }
    };

    // telefon: tło odświeżamy co ok. 33 ms (30 fps), scroll i reszta strony dostają resztę czasu
    let pending = 0;
    const onTick = (time: number, deltaMs: number) => {
      monitor(deltaMs);
      if (MOBILE) {
        pending += deltaMs;
        if (pending < MOBILE_STEP_MS) return;
        deltaMs = pending;
        pending = 0;
      }
      tick(time, deltaMs);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      lastMove = performance.now();
      hasPointer = true;
    };
    const onLeave = () => {
      lastMove = -Infinity;
    };
    const onResize = () => {
      // telefon: pasek adresu chowa się i pokazuje podczas scrolla, co zmienia tylko wysokość
      // okna. Przebudowa płótna przy każdej takiej zmianie zacinałaby scroll, a warstwa tła
      // jest rozciągnięta CSS-em (fixed inset-0), więc wystarczy ją zostawić
      if (
        MOBILE &&
        window.innerWidth === view.w &&
        Math.abs(window.innerHeight - view.h) < view.h * 0.25
      ) {
        return;
      }
      view.w = window.innerWidth;
      view.h = window.innerHeight;
      sizeDust();
      if (dustOn) {
        const want = moteCount();
        if (Math.abs(want - motes.length) / motes.length > 0.3) {
          motes.length = 0;
          motes.push(...makeDust(want));
        }
      }
    };

    const firePulse = (x: number, y: number, strength = 0.5) => {
      if (calm || pulses.length === 0) return;
      kickTarget = 1;
      const el = pulses[pulseIndex++ % pulses.length];
      const dominant = weights.indexOf(Math.max(...weights));
      el.style.background = glow(LIGHT[dominant].rgb, strength);
      gsap.fromTo(
        el,
        { x, y, scale: 0.12, opacity: 0.8 },
        {
          scale: 1,
          opacity: 0,
          duration: 1.4,
          ease: "power3.out",
          overwrite: true,
        },
      );
    };

    const onDown = (event: PointerEvent) =>
      firePulse(event.clientX, event.clientY);
    hooks.pulse = firePulse;

    const trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "max",
      onUpdate: (self) => {
        scroll.target = self.progress;
        scroll.v = self.getVelocity();
      },
      onRefresh: (self) => {
        scroll.target = self.progress;
        if (!scroll.ready) {
          scroll.ready = true;
          scroll.p = scroll.target; // bez "przelotu" przy wczytaniu w środku strony
        }
      },
    });

    // pierwsza klatka jest ustawiona zanim cokolwiek zobaczysz, potem tło wyłania się płynnie
    tick(0, 16);

    window.addEventListener("pointermove", onMove);
    if (!MOBILE) window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    document.documentElement.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(onTick);
    return () => {
      gsap.ticker.remove(onTick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      trigger.kill();
      hooks.pulse = undefined;
    };
  }, []);

  const blend = SIMPLE ? "" : "mix-blend-screen";
  const soften = SIMPLE ? undefined : "blur(9px)";

  return (
    <div
      ref={root}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: BASE, transformOrigin: "50% 45%" }}
    >
      {/* baza: granat-grafit, rozjaśniony od lewego górnego rogu (miękkie światło, nie czerń) */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 16% -12%, #1b2134 0%, ${BASE} 52%, #090c15 100%)`,
        }}
      />

      {/* chłodna mgiełka przy dolnej krawędzi */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgb(88 108 150 / 0.2) 0%, transparent 42%)",
        }}
      />

      {/* poświata sceniczna w lewym górnym rogu (lekko oddycha) */}
      <div
        data-stage
        data-blend
        className={`absolute left-[16%] top-0 h-[80vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 ${blend}`}
        style={{ background: glow(COLORS.amber, 0.24) }}
      />

      {/* plamy światła: wewnętrzny rdzeń daje wrażenie bryły światła */}
      {BLOBS.map((b) => (
        <div
          key={b.rgb}
          data-blob
          data-blend
          className={`absolute left-0 top-0 will-change-transform ${blend}`}
          style={{
            width: `min(${b.size}vmax, ${b.size * 2}vh)`,
            height: `min(${b.size}vmax, ${b.size * 2}vh)`,
            opacity: 0,
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: glow(b.rgb, b.alpha) }}
          />
          <div
            className="absolute inset-[28%]"
            style={{ background: glow(b.rgb, Math.min(1, b.alpha * 0.9)) }}
          />
        </div>
      ))}

      {/* mgła przy dole kadru */}
      {FOG.map((f, i) => (
        <div
          key={i}
          data-fog
          data-blend
          className={`absolute left-0 top-0 will-change-transform ${blend}`}
          style={{
            width: `${f.w}vw`,
            height: `${f.h}vh`,
            opacity: 0,
            background: glow(f.rgb, f.alpha),
          }}
        />
      ))}

      {!MOBILE && (
        <>
          {/* pas światła pod wstęgą cząstek */}
          <div
            data-lane
            data-blend
            className={`absolute left-0 top-0 w-full will-change-transform ${blend}`}
            style={{
              height: "22vh",
              opacity: 0,
              background:
                "linear-gradient(to bottom, transparent, rgb(255 196 140 / 0.07) 50%, transparent)",
            }}
          />

          {/* ciepły przeciek światła przy lewej krawędzi, jak na taśmie filmowej */}
          <div
            data-leak
            data-blend
            className={`absolute left-0 top-0 will-change-transform ${blend}`}
            style={{
              width: "46vw",
              height: "110vh",
              marginTop: "-5vh",
              opacity: 0,
              background:
                "radial-gradient(ellipse at 0% 50%, rgb(255 118 72 / 0.42), rgb(255 188 120 / 0.16) 42%, transparent 72%)",
            }}
          />
        </>
      )}

      {/* smugi światła z lewego górnego rogu */}
      <div
        data-rays
        data-blend
        className={`absolute inset-0 ${blend}`}
        style={{ filter: soften }}
      >
        {RAYS.map((r, i) => (
          <div
            key={i}
            data-ray
            className="absolute left-0 top-0 will-change-transform"
            style={{
              width: `min(${r.width}vmax, ${r.width * 2}vh)`,
              height: `min(${RAY_LENGTH}vmax, ${RAY_LENGTH * 2}vh)`,
              transformOrigin: "50% 0",
              opacity: 0,
              background: strip(r.rgb, 0.9),
              maskImage: RAY_MASK,
              WebkitMaskImage: RAY_MASK,
            }}
          />
        ))}
      </div>

      {/* bokeh: złote cząstki rozświetlane przez światło i smugi */}
      <canvas ref={dustRef} className="absolute inset-0 size-full" />

      {/* światło przy kursorze: szeroka poświata, rdzeń i ostry punkt */}
      {!MOBILE && (
        <div
          ref={haloRef}
          data-blend
          className={`absolute left-0 top-0 will-change-transform ${blend}`}
          style={{
            width: TUNING.halo.size,
            height: TUNING.halo.size,
            opacity: 0,
          }}
        >
          {LIGHT.map((l) => (
            <div
              key={l.rgb}
              className="absolute inset-0"
              style={{ background: glow(l.rgb, TUNING.halo.alpha), opacity: 0 }}
            />
          ))}
        </div>
      )}
      <div
        ref={coreRef}
        data-blend
        className={`absolute left-0 top-0 will-change-transform ${blend}`}
        style={{
          width: TUNING.core.size,
          height: TUNING.core.size,
          opacity: 0,
        }}
      >
        {LIGHT.map((l) => (
          <div
            key={l.rgb}
            className="absolute inset-0"
            style={{ background: glow(l.rgb, TUNING.core.alpha), opacity: 0 }}
          />
        ))}
      </div>
      <div
        ref={tightRef}
        data-blend
        className={`absolute left-0 top-0 will-change-transform ${blend}`}
        style={{
          width: TUNING.tight.size,
          height: TUNING.tight.size,
          opacity: 0,
        }}
      >
        {LIGHT.map((l) => (
          <div
            key={l.rgb}
            className="absolute inset-0"
            style={{ background: glow(l.rgb, TUNING.tight.alpha), opacity: 0 }}
          />
        ))}
      </div>

      {!MOBILE && (
        <>
          {/* smuga anamorficzna: pozioma kreska światła, rośnie przy ruchu */}
          <div
            data-streak
            data-blend
            className={`absolute left-0 top-0 will-change-transform ${blend}`}
            style={{
              width: "96vw",
              height: 3,
              opacity: 0,
              filter: soften ? "blur(1.5px)" : undefined,
              background: strip(COLORS.champagne, 0.9, 0.09, 28),
            }}
          />

          {/* fale światła przy kliknięciu (pula, wielokrotnego użytku) */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              data-pulse
              data-blend
              className={`absolute left-0 top-0 rounded-full ${blend}`}
              style={{
                width: PULSE,
                height: PULSE,
                marginLeft: -PULSE / 2,
                marginTop: -PULSE / 2,
                opacity: 0,
              }}
            />
          ))}
        </>
      )}

      {!MOBILE && (
        <>
          {/* grading: ciepłe półcienie w rogu światła, chłodne w przeciwległym */}
          <div
            className="absolute inset-0 mix-blend-soft-light"
            style={{
              background:
                "linear-gradient(155deg, rgb(255 186 120 / 0.16) 0%, transparent 38%, transparent 62%, rgb(46 70 140 / 0.2) 100%)",
            }}
          />

          {/* winieta intro: zamknięta na starcie, otwiera się razem ze światłem */}
          <div
            ref={shadeRef}
            className="absolute inset-0"
            style={{
              opacity: INTRO_PLAYS ? 1 : 0,
              background:
                "radial-gradient(ellipse at 50% 45%, transparent 6%, rgb(3 5 12 / 0.94) 72%)",
            }}
          />
        </>
      )}

      {/* winieta */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 38%, rgb(3 5 12 / 0.6) 100%)",
        }}
      />

      {/* ziarno filmowe (overlay: nie podnosi czerni, usuwa banding gradientów); bez niego na telefonie */}
      {!MOBILE && (
        <div
          ref={grainRef}
          className="absolute -inset-24 opacity-[0.1] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
      )}
    </div>
  );
}
