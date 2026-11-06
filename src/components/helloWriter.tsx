import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap";
import {
  ACCENT_COLOR,
  HELLO_SEQUENCE,
  STROKE_WIDTH,
  type HelloWord,
} from "../lib/helloStrokes";

const DRAW = 2.4; // sekundy pisania jednego słowa
const HOLD = 0.8; // pauza po napisaniu, zanim słowo zniknie
const ERASE = 0.5; // znikanie słowa
const EASE = { inOut: "sine.inOut", out: "sine.out" } as const;
const SVG_NS = "http://www.w3.org/2000/svg";

type Prepared = { path: Path2D; length: number };
const cache = new Map<string, Prepared[]>();

// Ścieżki zamieniamy na Path2D, a ich długości mierzymy raz w ukrytym elemencie SVG
function prepare(word: HelloWord): Prepared[] {
  const hit = cache.get(word.id);
  if (hit) return hit;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  document.body.appendChild(svg);
  const prepared = word.strokes.map((s) => {
    const el = document.createElementNS(SVG_NS, "path");
    el.setAttribute("d", s.d);
    svg.appendChild(el);
    return { path: new Path2D(s.d), length: el.getTotalLength() };
  });
  svg.remove();
  cache.set(word.id, prepared);
  return prepared;
}

type Props = {
  play: boolean; // sekcja jest aktywna (blisko końca strony)
  className?: string;
};

export function HelloWriter({ play, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0); // numer słowa w bieżącym odtwarzaniu
  const [settled, setSettled] = useState(false); // słowo docelowe zostało już raz napisane
  const [wasPlaying, setWasPlaying] = useState(false);

  // po opuszczeniu sekcji zaczynamy cykl od początku
  if (play !== wasPlaying) {
    setWasPlaying(play);
    if (!play) setStep(0);
  }

  // tryb ograniczonego ruchu: od razu gotowe słowo docelowe, bez animacji
  const reduce =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const lastIndex = HELLO_SEQUENCE.length - 1;
  const index = !play
    ? -1
    : reduce || settled
      ? lastIndex
      : Math.min(step, lastIndex);
  const word = index >= 0 ? HELLO_SEQUENCE[index] : undefined;
  const last = index === lastIndex;

  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const host = box.current;
      if (!canvas || !host || !word) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const prepared = prepare(word);
      const color = getComputedStyle(host).color;
      // postęp (p) i przezroczystość (o) każdej kreski to zwykłe obiekty, bez DOM-u
      const state = word.strokes.map(() => ({ p: 0, o: 0 }));

      // dopasowanie rozmiaru: wysokość kontenera, ale nie szerzej niż kontener
      const fit = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const aspect = word.width / word.height;
        let h = host.clientHeight;
        let w = h * aspect;
        if (w > host.clientWidth) {
          w = host.clientWidth;
          h = w / aspect;
        }
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
      };

      const draw = () => {
        ctx.setTransform(
          canvas.width / word.width,
          0,
          0,
          canvas.height / word.height,
          0,
          0,
        );
        ctx.clearRect(0, 0, word.width, word.height);
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        prepared.forEach(({ path, length }, i) => {
          const { p, o } = state[i];
          if (p <= 0 || o <= 0) return;
          ctx.globalAlpha = o;
          ctx.strokeStyle = word.strokes[i].accent ? ACCENT_COLOR : color;
          // częściowa kreska: pierwsze p * długość widoczne, reszta ukryta
          ctx.setLineDash(p >= 1 ? [] : [p * length, length * 2]);
          ctx.stroke(path);
        });
        ctx.globalAlpha = 1;
      };

      fit();
      draw();
      const observer = new ResizeObserver(() => {
        fit();
        draw();
      });
      observer.observe(host);

      if (reduce) {
        state.forEach((s) => {
          s.p = 1;
          s.o = 1;
        });
        draw();
        return () => observer.disconnect();
      }

      // każde słowo skalujemy tak, żeby pisało się dokładnie DRAW sekund
      const total = Math.max(...word.strokes.map((s) => s.delay + s.duration));
      const k = DRAW / total;

      const tl = gsap.timeline({
        onUpdate: draw,
        onComplete: () => {
          if (last) setSettled(true);
          else setStep((s) => s + 1);
        },
      });
      word.strokes.forEach((s, i) => {
        const at = s.delay * k;
        const duration = s.duration * k;
        tl.fromTo(
          state[i],
          { p: 0 },
          { p: 1, duration, ease: EASE[s.ease] },
          at,
        ).fromTo(
          state[i],
          { o: 0 },
          { o: 1, duration: duration / 2, ease: "none" },
          at,
        );
      });
      if (!last) {
        tl.to(
          canvas,
          { opacity: 0, duration: ERASE, ease: "power2.in" },
          DRAW + HOLD,
        );
      }

      return () => {
        tl.kill();
        observer.disconnect();
      };
    },
    { dependencies: [word, last, reduce], scope: box },
  );

  return (
    <div
      ref={box}
      className={`relative ${className ?? ""}`}
      style={{ contain: "layout paint" }}
    >
      <span className="sr-only">{HELLO_SEQUENCE[lastIndex].label}</span>
      {word && (
        <canvas
          key={index}
          ref={canvasRef}
          aria-hidden="true"
          className="absolute left-0 top-0 text-white"
        />
      )}
    </div>
  );
}
