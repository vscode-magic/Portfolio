import { useEffect, useRef } from "react";
import { gsap } from "../lib/gsap";
import { stage } from "../lib/intro";

const BASE = "#0d111c";

const COLORS = {
  amber: "255,176,96",
  gold: "255,200,130",
  champagne: "255,230,190",
  copper: "226,142,94",
  slate: "70,96,156",
  navy: "34,56,112",
};

// To samo wygaszanie co glow() w ambient.tsx: gaussowski środek, gładka krawędź
function glowStops(g: CanvasGradient, rgb: string, alpha: number, stops = 14) {
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = alpha * Math.exp(-4.2 * t * t) * (1 - t ** 6);
    g.addColorStop(t, `rgba(${rgb},${a.toFixed(4)})`);
  }
}

function blob(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rgb: string,
  alpha: number,
) {
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  glowStops(grad, rgb, alpha);
  g.fillStyle = grad;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// Płótno o rozmiarze CSS (w, h) z bitmapą w skali `scale`; rysujemy we współrzędnych CSS
function setup(canvas: HTMLCanvasElement, w: number, h: number, scale: number) {
  canvas.width = Math.max(2, Math.round(w * scale));
  canvas.height = Math.max(2, Math.round(h * scale));
  const g = canvas.getContext("2d")!;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, w, h);
  g.globalCompositeOperation = "lighter";
  return g;
}

// Powtarzalny generator liczb, żeby układ krążków był taki sam po każdym odświeżeniu
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HUES: [string, number][] = [
  [COLORS.amber, 0.36],
  [COLORS.gold, 0.22],
  [COLORS.champagne, 0.18],
  [COLORS.copper, 0.15],
  [COLORS.slate, 0.09],
];
function pickHue(r: () => number) {
  let x = r();
  for (const [rgb, w] of HUES) {
    if ((x -= w) <= 0) return rgb;
  }
  return COLORS.amber;
}

// Rozmyty krążek bokeh: ciemniejsze wnętrze i jaśniejszy brzeg; `soft` (0-1) rozmywa brzeg
function bokeh(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number,
  soft: number,
) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${(a * 0.3).toFixed(3)})`);
  grad.addColorStop(0.62, `rgba(${rgb},${(a * 0.42).toFixed(3)})`);
  grad.addColorStop(0.86, `rgba(${rgb},${(a * (1 - 0.45 * soft)).toFixed(3)})`);
  grad.addColorStop(0.96, `rgba(${rgb},${(a * 0.3 * (1 - soft)).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// Trzy warstwy głębi: [liczba, promień min, promień max, jasność, miękkość brzegu]
const DUST_LAYERS: [number, number, number, number, number][] = [
  [16, 7, 15, 0.34, 0.35], // daleko: małe, wyraźniejsze
  [11, 14, 28, 0.3, 0.55], // środek
  [6, 26, 46, 0.24, 0.85], // blisko: duże i bardzo miękkie
];

// Smugi światła z lewego górnego rogu: [kąt od pionu (stopnie), szerokość/H, jasność, kolor]
const RAYS: [number, number, number, string][] = [
  [14, 0.06, 0.3, COLORS.gold],
  [24, 0.11, 0.22, COLORS.champagne],
  [34, 0.075, 0.3, COLORS.amber],
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function AmbientMobile() {
  const root = useRef<HTMLDivElement>(null);

  const glowGroup = useRef<HTMLDivElement>(null);
  const lampGroup = useRef<HTMLDivElement>(null);
  const beamsGroup = useRef<HTMLDivElement>(null);
  const motesGroup = useRef<HTMLDivElement>(null);

  const glowA = useRef<HTMLCanvasElement>(null);
  const glowB = useRef<HTMLCanvasElement>(null);
  const light = useRef<HTMLCanvasElement>(null);
  const rays = useRef<HTMLCanvasElement>(null);

  const dust0 = useRef<HTMLCanvasElement>(null);
  const dust1 = useRef<HTMLCanvasElement>(null);
  const dust2 = useRef<HTMLCanvasElement>(null);

  // ---- rysowanie (raz, oraz po zmianie szerokości, np. obrocie telefonu) ----
  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const dustRefs = [dust0, dust1, dust2];
    let lastW = 0;

    const paint = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H || W === lastW) return;
      lastW = W;

      // plamy światła w skali 0,3: gładkie gradienty rozciągają się bez utraty jakości,
      // a tekstura na GPU jest kilkadziesiąt razy mniejsza niż pełnoekranowy element CSS
      const S = 0.3;
      if (glowA.current) {
        const g = setup(glowA.current, W, H, S);
        blob(g, W * 0.55, H * 0.04, H * 0.46, COLORS.amber, 0.5);
        blob(g, W * 0.55, H * 0.04, H * 0.3, COLORS.amber, 0.28);
        blob(g, W * 0.72, H * 0.76, H * 0.28, COLORS.copper, 0.4);
        blob(g, W * 0.28, H * 0.22, H * 0.16, COLORS.champagne, 0.2);
      }
      if (glowB.current) {
        const g = setup(glowB.current, W, H, S);
        blob(g, W * 1.0, H * 0.12, H * 0.36, COLORS.slate, 0.55);
        blob(g, W * 0.92, H * 0.4, H * 0.34, COLORS.navy, 0.6);
        blob(g, W * 0.08, H * 0.96, H * 0.3, COLORS.slate, 0.32);
      }
      if (light.current) {
        const g = setup(light.current, 160, 160, 1);
        blob(g, 80, 80, 80, COLORS.champagne, 0.42);
        blob(g, 80, 80, 48, COLORS.gold, 0.38);
      }

      // smugi: każda to pionowy pasek o gaussowskim przekroju, wygaszany ku dołowi,
      // obrócony o swój kąt; wszystkie rysowane raz na jednym płótnie
      if (rays.current) {
        const RW = W;
        const RH = H * 1.3;
        const g = setup(rays.current, RW, RH, 0.35);
        for (const [deg, wFrac, alpha, rgb] of RAYS) {
          const w = Math.max(8, H * wFrac);
          const len = RH * 1.25;
          const strip = document.createElement("canvas");
          strip.width = Math.max(2, Math.round(w * 0.5));
          strip.height = Math.max(2, Math.round(len * 0.35));
          const s = strip.getContext("2d")!;
          const h = s.createLinearGradient(0, 0, strip.width, 0);
          for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            const a = alpha * Math.exp(-((t - 0.5) ** 2) / 0.045);
            h.addColorStop(t, `rgba(${rgb},${a.toFixed(4)})`);
          }
          s.fillStyle = h;
          s.fillRect(0, 0, strip.width, strip.height);
          s.globalCompositeOperation = "destination-in";
          const v = s.createLinearGradient(0, 0, 0, strip.height);
          v.addColorStop(0, "rgba(0,0,0,1)");
          v.addColorStop(0.35, "rgba(0,0,0,0.55)");
          v.addColorStop(1, "rgba(0,0,0,0)");
          s.fillStyle = v;
          s.fillRect(0, 0, strip.width, strip.height);

          g.save();
          g.translate(W * 0.1, -H * 0.1);
          g.rotate((-deg * Math.PI) / 180);
          g.drawImage(strip, -w / 2, 0, w, len);
          g.restore();
        }
      }

      // trzy warstwy bokeh (każda płótno nieco większe od ekranu, żeby dryf nie odsłaniał krawędzi)
      DUST_LAYERS.forEach(([count, rMin, rMax, alpha, soft], i) => {
        const canvas = dustRefs[i]?.current;
        if (!canvas) return;
        const DW = W * 1.16;
        const DH = H * 1.12;
        const g = setup(canvas, DW, DH, 0.6);
        const rand = rng(1000 + i * 77);
        for (let n = 0; n < count; n++) {
          const r = rMin + (rMax - rMin) * rand() ** 1.4;
          bokeh(
            g,
            rand() * DW,
            rand() * DH,
            r,
            pickHue(rand),
            alpha * (0.55 + 0.45 * rand()),
            soft,
          );
        }
      });
    };

    paint();
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ---- intro: tylko przezroczystość grup, tylko dopóki trwa wejście ----
  useEffect(() => {
    const apply = () => {
      const glow = glowGroup.current;
      const lamp = lampGroup.current;
      const beams = beamsGroup.current;
      const motes = motesGroup.current;

      if (glow) glow.style.opacity = String(smooth(clamp01(stage.bloom)));
      if (lamp) lamp.style.opacity = String(smooth(clamp01(stage.light)));
      if (beams) beams.style.opacity = String(smooth(clamp01(stage.light)));
      if (motes)
        motes.style.opacity = String(
          smooth(clamp01(stage.dust)) * smooth(clamp01(stage.light)),
        );
    };
    const finished = () =>
      stage.light >= 0.999 && stage.bloom >= 0.999 && stage.dust >= 0.999;

    apply();
    if (finished()) return;
    const tick = () => {
      apply();
      if (finished()) gsap.ticker.remove(tick);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <div
      ref={root}
      className="amb-root pointer-events-none fixed left-0 top-0 -z-10 w-full overflow-hidden"
      style={{ backgroundColor: BASE, contain: "layout paint" }}
      aria-hidden="true"
    >
      {/* baza: granat-grafit rozjaśniony od lewego górnego rogu + chłodna mgiełka przy dole */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, rgb(88 108 150 / 0.2) 0%, transparent 42%), radial-gradient(120% 90% at 16% -12%, #1b2134 0%, ${BASE} 52%, #090c15 100%)`,
        }}
      />

      {/* miękkie plamy światła (dwie warstwy poruszają się osobno) */}
      <div ref={glowGroup} className="absolute inset-0" style={{ opacity: 0 }}>
        <canvas ref={glowA} className="amb-layer amb-a" />
        <canvas ref={glowB} className="amb-layer amb-b" />
      </div>

      {/* wędrujące światło */}
      <div ref={lampGroup} className="absolute inset-0" style={{ opacity: 0 }}>
        <canvas ref={light} className="amb-lamp" />
      </div>

      {/* smugi światła */}
      <div ref={beamsGroup} className="absolute inset-0" style={{ opacity: 0 }}>
        <canvas ref={rays} className="amb-rays" />
      </div>

      {/* rozmyte krążki bokeh w trzech warstwach głębi */}
      <div ref={motesGroup} className="absolute inset-0" style={{ opacity: 0 }}>
        <canvas ref={dust0} className="amb-dust amb-dust-1" />
        <canvas ref={dust1} className="amb-dust amb-dust-2" />
        <canvas ref={dust2} className="amb-dust amb-dust-3" />
      </div>

      {/* winieta */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, transparent 52%, rgb(5 7 12 / 0.5) 100%)",
        }}
      />
    </div>
  );
}
