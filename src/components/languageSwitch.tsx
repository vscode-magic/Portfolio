import { startTransition, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,} from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent,} from "react";
import { useTranslation } from "react-i18next";
import { beginLanguageFade } from "../lib/languageFade";
import type { LanguageFade } from "../lib/languageFade";

type Lang = "pl" | "en";

interface PhysicsState {
  pos: number;
  vel: number;
  target: number;
  lift: number;
  liftVel: number;
  liftTarget: number;
  hx: number;
  hy: number;
  hxTarget: number;
  hyTarget: number;
  hover: number;
  hoverVel: number;
  hoverTarget: number;
}

interface DragState {
  active: boolean;
  pointerId: number;
  startX: number;
  startPos: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

interface Metrics {
  outerW: number;
  outerH: number;
  thumbW: number;
  thumbH: number;
  travel: number;
}

// Parametry fizyki (częstotliwość kątowa omega dla tłumienia krytycznego)
const GLIDE_OMEGA = 13.5; // gładki, ok. ~460ms przelot bez odbić
const LIFT_OMEGA = 22; // szybka, miękka reakcja pod palcem/kursorem
const HOVER_OMEGA = 14; // płynny zanik reflektora na kapsule
const DRAG_THRESHOLD_PX = 4;
const RUBBER_BAND_LIMIT = 0.14;
const FLICK_PROJECTION_S = 0.12;
const SETTLE_POS_EPS = 0.004;
const SETTLE_VEL_EPS = 0.015;
const SETTLE_AUX_EPS = 0.003;

// Bazowe warstwy optyczne szkła soczewki (krawędź rysuje osobny wektorowy SVG)
const LENS_BODY_STYLE: CSSProperties = {
  background: [
    "radial-gradient(125% 110% at 30% 0%, rgb(255 246 232 / 0.34), rgb(255 255 255 / 0.09) 56%, rgb(255 255 255 / 0.03) 100%)",
    "linear-gradient(180deg, rgb(255 255 255 / 0.18) 0%, rgb(255 255 255 / 0.05) 52%, rgb(255 255 255 / 0.11) 100%)",
  ].join(", "),
};

// Wewnętrzny ruchomy refleks (caustic highlight) ślizgający się po kopule szkła
const LENS_SHEEN_STYLE: CSSProperties = {
  background:
    "radial-gradient(62% 90% at 50% 0%, rgb(255 250 240 / 0.5) 0%, rgb(255 255 255 / 0.14) 46%, transparent 78%)",
};

// Subtelna dyspersja krawędzi (ciepły bursztyn / chłodny lód) widoczna tylko w ruchu
const LENS_PRISM_STYLE: CSSProperties = {
  boxShadow: [
    "inset 1.5px 0 3px rgb(255 216 164 / 0.48)",
    "inset -1.5px 0 3px rgb(172 216 255 / 0.36)",
    "inset 0 1px 2px rgb(255 255 255 / 0.45)",
  ].join(", "),
  opacity: 0,
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Dokładne rozwiązanie analityczne oscylatora tłumionego krytycznie:
// zero odbić, pełna płynność niezależnie od częstotliwości ekranu (60–240 Hz).
function stepCriticallyDamped(
  pos: number,
  vel: number,
  target: number,
  omega: number,
  dt: number,
): [number, number] {
  const x = pos - target;
  const exp = Math.exp(-omega * dt);
  const c2 = vel + omega * x;
  const nextX = (x + c2 * dt) * exp;
  const nextVel = (vel - c2 * omega * dt) * exp;
  return [target + nextX, nextVel];
}

// Miękki opór na krawędziach podczas przeciągania (krzywa iOS rubber-band)
function rubberBand(
  value: number,
  min: number,
  max: number,
  limit: number,
): number {
  if (value < min) {
    const over = min - value;
    return min - (over * limit) / (over + limit);
  }
  if (value > max) {
    const over = value - max;
    return max + (over * limit) / (over + limit);
  }
  return value;
}

// Precyzyjne dopasowanie wektorowego obrysu SVG do dokładnych pikseli (x/y = 0.5)
function syncRimSvg(
  svg: SVGSVGElement | null,
  rect: SVGRectElement | null,
  width: number,
  height: number,
) {
  if (!svg || !rect || width <= 2 || height <= 2) return;
  const w = Math.round(width);
  const h = Math.round(height);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  rect.setAttribute("x", "0.5");
  rect.setAttribute("y", "0.5");
  rect.setAttribute("width", String(w - 1));
  rect.setAttribute("height", String(h - 1));
  rect.setAttribute("rx", String((h - 1) / 2));
}

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const active: Lang = i18n.resolvedLanguage?.startsWith("pl") ? "pl" : "en";
  const initialPos = active === "en" ? 1 : 0;

  // Unikalne ID gradientów SVG (bezpieczne przy wielu instancjach komponentu)
  const uid = useId();
  const outerRimId = `${uid}-outer-rim`;
  const thumbRimId = `${uid}-thumb-rim`;

  // Stan React aktualizowany wyłącznie dla ARIA (nigdy w trakcie animacji)
  const [announced, setAnnounced] = useState<Lang>(active);

  // Referencje do warstw DOM aktualizowanych bezpośrednio z pętli rAF
  const buttonRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const prismRef = useRef<HTMLSpanElement>(null);
  const spotlightRef = useRef<HTMLSpanElement>(null);
  const plLabelRef = useRef<HTMLSpanElement>(null);
  const enLabelRef = useRef<HTMLSpanElement>(null);
  const outerSvgRef = useRef<SVGSVGElement>(null);
  const outerRectRef = useRef<SVGRectElement>(null);
  const thumbSvgRef = useRef<SVGSVGElement>(null);
  const thumbRectRef = useRef<SVGRectElement>(null);

  const activeRef = useRef<Lang>(active);
  const pendingLangRef = useRef<Lang | null>(null);
  const fadeRef = useRef<LanguageFade | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const metricsRef = useRef<Metrics>({
    outerW: 0,
    outerH: 0,
    thumbW: 0,
    thumbH: 0,
    travel: 0,
  });

  const physRef = useRef<PhysicsState>({
    pos: initialPos,
    vel: 0,
    target: initialPos,
    lift: 0,
    liftVel: 0,
    liftTarget: 0,
    hx: initialPos === 1 ? 0.75 : 0.25,
    hy: 0.5,
    hxTarget: initialPos === 1 ? 0.75 : 0.25,
    hyTarget: 0.5,
    hover: 0,
    hoverVel: 0,
    hoverTarget: 0,
  });

  const dragRef = useRef<DragState>({
    active: false,
    pointerId: -1,
    startX: 0,
    startPos: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    moved: false,
  });

  // Bezpośrednie naniesienie bieżącego stanu fizyki na warstwy DOM (0 rerenderów)
  const renderVisuals = useCallback((settled: boolean) => {
    const p = physRef.current;
    const m = metricsRef.current;

    const clampedPos = clamp(p.pos, 0, 1);
    const speed = Math.min(Math.abs(p.vel), 4.5);
    const travel = m.travel;

    // 1. Pozycja i subtelna płynna deformacja soczewki w ruchu
    const thumbEl = thumbRef.current;
    if (thumbEl) {
      if (travel > 0) {
        const rawX = p.pos * travel;
        if (settled) {
          // W spoczynku wyrównujemy do pełnych pikseli dla wektorowej ostrości
          thumbEl.style.transform = `translate3d(${Math.round(rawX)}px, 0, 0)`;
        } else {
          const stretch = speed * 0.011;
          const liftScale = p.lift * 0.024;
          const sx = 1 + stretch + liftScale;
          const sy = 1 - stretch * 0.42 + liftScale;
          thumbEl.style.transform = `translate3d(${rawX.toFixed(3)}px, 0, 0) scale3d(${sx.toFixed(4)}, ${sy.toFixed(4)}, 1)`;
        }
      } else {
        thumbEl.style.transform =
          p.target >= 0.5 ? "translate3d(100%, 0, 0)" : "translate3d(0, 0, 0)";
      }
    }

    // 2. Dynamiczny cień pod soczewką (pogłębia się lekko przy uniesieniu)
    const shadowEl = shadowRef.current;
    if (shadowEl) {
      const lift = p.lift;
      const yOff = 5 + lift * 4;
      const blur = 16 + lift * 8;
      const alpha = 0.54 + lift * 0.16;
      shadowEl.style.boxShadow = `0 ${yOff.toFixed(1)}px ${blur.toFixed(1)}px -6px rgb(2 4 12 / ${alpha.toFixed(3)}), 0 2px 5px -1px rgb(2 4 12 / 0.34)`;
    }

    // 3. Ruchomy refleks (caustic) wędrujący po powierzchni soczewki
    const sheenEl = sheenRef.current;
    if (sheenEl) {
      const pointerBias = (p.hx - 0.5) * 18 * p.hover;
      const posBias = (clampedPos - 0.5) * -14;
      const velBias = clamp(p.vel * 2.4, -10, 10);
      const shiftX = pointerBias + posBias + velBias;
      const sheenOpacity = 0.72 + p.hover * 0.2 + p.lift * 0.14;
      sheenEl.style.transform = `translate3d(${shiftX.toFixed(2)}%, 0, 0)`;
      sheenEl.style.opacity = String(clamp(sheenOpacity, 0, 1));
    }

    // 4. Pryzmatyczna krawędź dyspersji widoczna wyłącznie w locie / dotyku
    const prismEl = prismRef.current;
    if (prismEl) {
      const prismOpacity = clamp(speed * 0.22 + p.lift * 0.42, 0, 0.78);
      prismEl.style.opacity =
        prismOpacity < 0.005 ? "0" : prismOpacity.toFixed(3);
    }

    // 5. Reflektor na kapsule podążający za kursorem
    const spotEl = spotlightRef.current;
    if (spotEl) {
      if (p.hover < 0.005) {
        spotEl.style.opacity = "0";
      } else {
        const px = (p.hx * 100).toFixed(2);
        const py = (p.hy * 100).toFixed(2);
        spotEl.style.background = `radial-gradient(64px circle at ${px}% ${py}%, rgb(255 246 232 / 0.18), transparent 72%)`;
        spotEl.style.opacity = p.hover.toFixed(3);
      }
    }

    // 6. Ciągłe rozświetlanie etykiet PL / EN zsynchronizowane z soczewką
    const plEl = plLabelRef.current;
    const enEl = enLabelRef.current;
    if (plEl && enEl) {
      const plWeight = 1 - clampedPos;
      const enWeight = clampedPos;
      const hoverBoost = p.hover * 0.18;

      const plOpacity = clamp(
        0.46 + plWeight * 0.54 + (1 - plWeight) * hoverBoost,
        0,
        1,
      );
      const enOpacity = clamp(
        0.46 + enWeight * 0.54 + (1 - enWeight) * hoverBoost,
        0,
        1,
      );

      plEl.style.opacity = plOpacity.toFixed(3);
      enEl.style.opacity = enOpacity.toFixed(3);

      const plGlow = (plWeight * 0.32).toFixed(3);
      const enGlow = (enWeight * 0.32).toFixed(3);
      plEl.style.textShadow =
        plWeight > 0.05 ? `0 0 12px rgb(255 246 232 / ${plGlow})` : "none";
      enEl.style.textShadow =
        enWeight > 0.05 ? `0 0 12px rgb(255 246 232 / ${enGlow})` : "none";
    }
  }, []);

  const commitPendingLanguage = useCallback(() => {
    const target = pendingLangRef.current;
    pendingLangRef.current = null;
    const fade = fadeRef.current;
    fadeRef.current = null;

    if (target && target !== activeRef.current) {
      if (fade) {
        void fade.commit(() => i18n.changeLanguage(target));
      } else {
        startTransition(() => {
          void i18n.changeLanguage(target);
        });
      }
    } else {
      fade?.cancel();
    }
  }, [i18n]);

  // Główna pętla fizyki — automatycznie zasypia, gdy wszystko się ustabilizuje
  const ensureRunning = useCallback(() => {
    if (rafRef.current !== null) return;
    lastFrameRef.current = performance.now();

    const frame = (now: number) => {
      const dt = clamp((now - lastFrameRef.current) / 1000, 0, 0.05);
      lastFrameRef.current = now;

      const p = physRef.current;
      const dragging = dragRef.current.active && dragRef.current.moved;

      if (!dragging) {
        [p.pos, p.vel] = stepCriticallyDamped(
          p.pos,
          p.vel,
          p.target,
          GLIDE_OMEGA,
          dt,
        );
      }

      [p.lift, p.liftVel] = stepCriticallyDamped(
        p.lift,
        p.liftVel,
        p.liftTarget,
        LIFT_OMEGA,
        dt,
      );

      [p.hover, p.hoverVel] = stepCriticallyDamped(
        p.hover,
        p.hoverVel,
        p.hoverTarget,
        HOVER_OMEGA,
        dt,
      );

      // Płynne podążanie współrzędnych reflektora za kursorem
      const follow = 1 - Math.exp(-16 * dt);
      p.hx += (p.hxTarget - p.hx) * follow;
      p.hy += (p.hyTarget - p.hy) * follow;

      const posSettled =
        !dragging &&
        Math.abs(p.pos - p.target) < SETTLE_POS_EPS &&
        Math.abs(p.vel) < SETTLE_VEL_EPS;

      if (posSettled) {
        p.pos = p.target;
        p.vel = 0;
        if (pendingLangRef.current !== null) {
          commitPendingLanguage();
        }
      }

      const auxSettled =
        Math.abs(p.lift - p.liftTarget) < SETTLE_AUX_EPS &&
        Math.abs(p.liftVel) < SETTLE_AUX_EPS &&
        Math.abs(p.hover - p.hoverTarget) < SETTLE_AUX_EPS &&
        Math.abs(p.hoverVel) < SETTLE_AUX_EPS &&
        Math.abs(p.hx - p.hxTarget) < SETTLE_AUX_EPS &&
        Math.abs(p.hy - p.hyTarget) < SETTLE_AUX_EPS;

      if (posSettled && auxSettled) {
        p.lift = p.liftTarget;
        p.liftVel = 0;
        p.hover = p.hoverTarget;
        p.hoverVel = 0;
        p.hx = p.hxTarget;
        p.hy = p.hyTarget;
        renderVisuals(true);
        rafRef.current = null;
        return;
      }

      renderVisuals(false);
      rafRef.current = window.requestAnimationFrame(frame);
    };

    rafRef.current = window.requestAnimationFrame(frame);
  }, [commitPendingLanguage, renderVisuals]);

  // Rozpoczęcie płynnego lotu do wskazanego języka
  const transitionTo = useCallback(
    (next: Lang, initialVelocity?: number) => {
      const p = physRef.current;
      const targetPos = next === "en" ? 1 : 0;

      pendingLangRef.current = next;
      setAnnounced(next);
      p.target = targetPos;

      if (next !== activeRef.current) {
        fadeRef.current ??= beginLanguageFade();
      } else if (fadeRef.current) {
        fadeRef.current.cancel();
        fadeRef.current = null;
      }

      if (reduceMotion()) {
        p.pos = targetPos;
        p.vel = 0;
        p.lift = 0;
        p.liftVel = 0;
        p.liftTarget = 0;
        renderVisuals(true);
        commitPendingLanguage();
        return;
      }

      if (initialVelocity !== undefined) {
        p.vel = clamp(initialVelocity, -6, 6);
      }

      ensureRunning();
    },
    [commitPendingLanguage, ensureRunning, renderVisuals],
  );

  // Pomiar geometrii oraz wyrównanie wektorowych obrysów SVG przed malowaniem
  useLayoutEffect(() => {
    const buttonEl = buttonRef.current;
    const trackEl = trackRef.current;
    const thumbEl = thumbRef.current;
    if (!buttonEl || !trackEl || !thumbEl) return;

    const measure = () => {
      const outerW = buttonEl.clientWidth;
      const outerH = buttonEl.clientHeight;
      const thumbW = thumbEl.offsetWidth;
      const thumbH = thumbEl.offsetHeight;
      const travel = Math.max(0, trackEl.clientWidth - thumbW);

      metricsRef.current = { outerW, outerH, thumbW, thumbH, travel };
      syncRimSvg(outerSvgRef.current, outerRectRef.current, outerW, outerH);
      syncRimSvg(thumbSvgRef.current, thumbRectRef.current, thumbW, thumbH);
      renderVisuals(rafRef.current === null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(buttonEl);
    return () => ro.disconnect();
  }, [renderVisuals]);

  // Synchronizacja, gdy język zmieni się z zewnątrz (np. inny komponent)
  useEffect(() => {
    activeRef.current = active;
    if (pendingLangRef.current !== null || dragRef.current.active) return;

    const targetPos = active === "en" ? 1 : 0;
    const p = physRef.current;
    if (p.target !== targetPos) {
      p.target = targetPos;
      setAnnounced(active);
      if (reduceMotion()) {
        p.pos = targetPos;
        p.vel = 0;
        renderVisuals(true);
      } else {
        ensureRunning();
      }
    }
  }, [active, ensureRunning, renderVisuals]);

  // Sprzątanie zasobów przy odmontowaniu
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
      }
    };
  }, []);

  const updatePointerSpot = (e: PointerEvent<HTMLButtonElement>) => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    physRef.current.hxTarget = clamp(
      (e.clientX - rect.left) / rect.width,
      0,
      1,
    );
    physRef.current.hyTarget = clamp(
      (e.clientY - rect.top) / rect.height,
      0,
      1,
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const p = physRef.current;
    const now = performance.now();

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startPos: p.pos,
      lastX: e.clientX,
      lastTime: now,
      velocity: 0,
      moved: false,
    };

    updatePointerSpot(e);
    p.hoverTarget = 1;
    p.liftTarget = reduceMotion() ? 0 : 1;
    ensureRunning();
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = physRef.current;
    updatePointerSpot(e);
    p.hoverTarget = 1;

    const drag = dragRef.current;
    if (drag.active && drag.pointerId === e.pointerId) {
      const dx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }

      if (drag.moved && metricsRef.current.travel > 0) {
        const travel = metricsRef.current.travel;
        const rawPos = drag.startPos + dx / travel;
        p.pos = rubberBand(rawPos, 0, 1, RUBBER_BAND_LIMIT);

        const now = performance.now();
        const dt = Math.max((now - drag.lastTime) / 1000, 0.004);
        const instantVel = (e.clientX - drag.lastX) / travel / dt;
        drag.velocity = drag.velocity * 0.55 + instantVel * 0.45;
        drag.lastX = e.clientX;
        drag.lastTime = now;
        p.vel = drag.velocity;
      }
    }

    ensureRunning();
  };

  const finishPointer = (
    e: PointerEvent<HTMLButtonElement>,
    cancelled: boolean,
  ) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const wasDragged = drag.moved;
    const releaseVel = drag.velocity;
    drag.active = false;
    drag.pointerId = -1;
    drag.moved = false;

    const p = physRef.current;
    p.liftTarget = 0;

    if (cancelled) {
      ensureRunning();
      return;
    }

    // Zapobiegamy podwójnemu wywołaniu przez natywny onClick po pointerUp
    suppressClickRef.current = true;
    if (suppressTimerRef.current !== null) {
      window.clearTimeout(suppressTimerRef.current);
    }
    suppressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 350);

    if (wasDragged) {
      const projected = p.pos + releaseVel * FLICK_PROJECTION_S;
      const next: Lang = projected >= 0.5 ? "en" : "pl";
      transitionTo(next, releaseVel);
    } else {
      const currentTarget: Lang = p.target >= 0.5 ? "en" : "pl";
      const next: Lang = currentTarget === "en" ? "pl" : "en";
      transitionTo(next);
    }
  };

  const onPointerLeave = () => {
    if (dragRef.current.active) return;
    physRef.current.hoverTarget = 0;
    ensureRunning();
  };

  // Obsługa kliknięcia z klawiatury (Enter / Space) lub wywołania programowego
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (e.detail !== 0) return;
    const currentTarget: Lang = physRef.current.target >= 0.5 ? "en" : "pl";
    transitionTo(currentTarget === "en" ? "pl" : "en");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      transitionTo("pl");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      transitionTo("en");
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      aria-checked={announced === "en"}
      aria-label={
        announced === "pl"
          ? "Change language to English"
          : "Zmień język na polski"
      }
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
      onPointerLeave={onPointerLeave}
      className="glass relative grid cursor-pointer touch-none select-none grid-cols-2 rounded-full p-1 text-sm font-medium tracking-[0.06em] antialiased outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {/* Reflektor na kapsule podążający za kursorem */}
      <span
        ref={spotlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full opacity-0"
      />

      {/* Wektorowa, idealnie gładka krawędź zewnętrznej kapsuły */}
      <svg
        ref={outerSvgRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id={outerRimId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(255 250 244 / 0.34)" />
            <stop offset="42%" stopColor="rgb(255 255 255 / 0.08)" />
            <stop offset="100%" stopColor="rgb(255 255 255 / 0.18)" />
          </linearGradient>
        </defs>
        <rect
          ref={outerRectRef}
          fill="none"
          stroke={`url(#${outerRimId})`}
          strokeWidth="1"
        />
      </svg>

      {/* Tor przesuwu soczewki (wewnątrz paddingu p-1) */}
      <span
        ref={trackRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 block"
      >
        <span
          ref={thumbRef}
          style={{
            transform:
              initialPos === 1
                ? "translate3d(100%, 0, 0)"
                : "translate3d(0, 0, 0)",
          }}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full"
        >
          {/* Warstwa 1: dynamiczny cień wysokości */}
          <span
            ref={shadowRef}
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow:
                "0 5px 16px -6px rgb(2 4 12 / 0.54), 0 2px 5px -1px rgb(2 4 12 / 0.34)",
            }}
          />

          {/* Warstwa 2: objętość szkła + ruchomy refleks + dyspersja krawędzi */}
          <span
            style={LENS_BODY_STYLE}
            className="absolute inset-0 overflow-hidden rounded-full"
          >
            <span
              ref={sheenRef}
              style={LENS_SHEEN_STYLE}
              className="absolute -inset-x-1/4 inset-y-0 rounded-full"
            />
            <span
              ref={prismRef}
              style={LENS_PRISM_STYLE}
              className="absolute inset-0 rounded-full"
            />
          </span>

          {/* Warstwa 3: kryształowa obwódka wektorowa SVG (zero ząbkowania) */}
          <svg
            ref={thumbSvgRef}
            className="absolute inset-0 size-full overflow-visible"
          >
            <defs>
              <linearGradient
                id={thumbRimId}
                x1="12%"
                y1="0%"
                x2="88%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgb(255 252 246 / 0.8)" />
                <stop offset="30%" stopColor="rgb(255 255 255 / 0.24)" />
                <stop offset="68%" stopColor="rgb(255 255 255 / 0.08)" />
                <stop offset="100%" stopColor="rgb(255 244 228 / 0.36)" />
              </linearGradient>
            </defs>
            <rect
              ref={thumbRectRef}
              fill="none"
              stroke={`url(#${thumbRimId})`}
              strokeWidth="1"
            />
          </svg>
        </span>
      </span>

      <span
        ref={plLabelRef}
        lang="pl"
        className="relative z-10 px-3 py-1 text-center uppercase text-white"
        style={{ opacity: initialPos === 0 ? 1 : 0.46 }}
      >
        pl
      </span>
      <span
        ref={enLabelRef}
        lang="en"
        className="relative z-10 px-3 py-1 text-center uppercase text-white"
        style={{ opacity: initialPos === 1 ? 1 : 0.46 }}
      >
        en
      </span>
    </button>
  );
}
