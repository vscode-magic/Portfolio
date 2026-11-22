import { useSyncExternalStore } from "react";
import { gsap, ScrollTrigger } from "./gsap";
import { MOBILE } from "./device";

/* =========================================================================
   intro.ts: całe wejście na stronę w jednym pliku (zastępuje introFx.tsx)

   1. decyzja       czy gra pełne intro (pierwsza wizyta, Ctrl+F5, ?intro)
   2. scena         stan czytany przez ambient.tsx w każdej klatce
   3. start         zasłona z index.html + odświeżanie layoutu w tle (bez czekania)
   4. bramki        kiedy hero pokazuje tekst, nawigację i odblokowuje scroll
   5. scenariusze   playQuick (zwykłe wejście) i playIntro (pełne, ok. 5,2 s;
                    na telefonie prostsze i łagodniejsze, ok. 2,1 s)
   6. startEntrance jedyna funkcja, którą wywołuje app.tsx
   ========================================================================= */

/* ---------- 1. decyzja ---------- */

const KEY = "portfolioIntroSeen";

// Pełne intro: pierwsze wejście w sesji, po twardym odświeżeniu albo z ?intro w adresie.
function decide(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forced = new URLSearchParams(location.search).has("intro");
    const seen = sessionStorage.getItem(KEY) === "1";
    sessionStorage.setItem(KEY, "1");
    return !reduce && (forced || !seen);
  } catch {
    return false;
  }
}
export const INTRO_PLAYS = decide();

// Ctrl+F5 / Ctrl+Shift+R / Cmd+Shift+R: zerujemy flagę tuż przed przeładowaniem
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const hard =
      (e.key === "F5" && (e.ctrlKey || e.shiftKey)) ||
      (key === "r" && e.shiftKey && (e.ctrlKey || e.metaKey));
    if (!hard) return;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignorujemy */
    }
  });
}

/* ---------- 2. scena (czytana przez ambient w każdej klatce) ---------- */

// Stan końcowy: scena w spoczynku, tak jak ją widzi użytkownik po intro.
const FINAL = {
  light: 1, // jasność warstw światła (rdzeń, halo)
  size: 1, // rozmiar światła: od iskry do pełnej plamy
  bloom: 1, // plamy wylatują ze światła na swoje miejsca
  rays: 1, // smugi światła rozwijają się z lewego górnego rogu
  burst: 1, // cząstki wylatują ze światła zapłonu na swoje miejsca
  zoom: 0, // najazd kamery: scena startuje lekko powiększona
  streak: 0, // anamorficzna smuga światła przy zapłonie
  defocus: 0, // 0-1: rozmycie całej sceny (przeostrzanie ostrości)
  dust: 1, // jasność pyłu poza światłem
  script: 0, // 0-1: jak mocno scenariusz przejmuje sterowanie światłem
  path: 1, // postęp światła po ścieżce
  vignette: 0, // dodatkowe zamknięcie winiety
  grain: 0, // dodatkowe ziarno
  boost: 0, // chwilowy "błysk" światła
};

// Stan początkowy pełnego intro: ciemność, rozmycie, zamknięta winieta.
const START: typeof FINAL = {
  light: 0,
  size: 0.1,
  bloom: 0,
  rays: 0,
  burst: 0,
  zoom: 1,
  streak: 0,
  defocus: 1,
  dust: 0,
  script: 1,
  path: 0,
  vignette: 1,
  grain: 1,
  boost: 0,
};

// Stan początkowy intro na telefonie: bez najazdu kamery, winiety i ziarna (każdy z tych
// efektów to pełnoekranowa warstwa, którą telefon musi przerysowywać w każdej klatce).
// Zostaje tylko łagodne rozjaśnianie: światło, plamy i pył wyłaniają się z ciemności.
const START_MOBILE: typeof FINAL = {
  ...START,
  size: 0.6,
  rays: 1,
  burst: 1,
  zoom: 0,
  script: 0,
  path: 1,
  vignette: 0,
  grain: 0,
};
const START_NOW = MOBILE ? START_MOBILE : START;

export const stage: typeof FINAL = {
  ...(INTRO_PLAYS
    ? START_NOW
    : { ...FINAL, light: 0, defocus: 0.7, zoom: MOBILE ? 0 : 0.4 }),
};

// Trasa światła (0-1 ekranu): zapłon pośrodku, powolny zjazd w stronę nagłówka (lewy dół).
// Pierwszy punkt to też miejsce, z którego wylatuje pył.
export const INTRO_PATH = {
  x: [0.5, 0.42, 0.32, 0.26],
  y: [0.42, 0.52, 0.63, 0.68],
};

// ambient rejestruje tu falę światła, żeby intro mogło ją odpalić
export const hooks: {
  pulse?: (x: number, y: number, strength?: number) => void;
} = {};

/* ---------- 3. start: zasłona z index.html i odświeżanie w tle ---------- */

// Zdejmuje czarną zasłonę z index.html (duration 0 = od razu)
function liftBoot(duration: number) {
  const el = document.getElementById("boot");
  if (!el) return;
  if (duration <= 0.02) {
    el.remove();
    return;
  }
  gsap.to(el, {
    opacity: 0,
    duration,
    ease: "power2.out",
    overwrite: true,
    onComplete: () => el.remove(),
  });
}

// Intro NIE czeka na nic (fonty, obrazy, load). Layout, który mógł się przesunąć
// po doładowaniu fontów i obrazów, przeliczamy w tle, bez blokowania startu.
function refreshInBackground() {
  const refresh = () => ScrollTrigger.refresh();
  void document.fonts?.ready.then(refresh);
  if (document.readyState !== "complete") {
    window.addEventListener("load", refresh, { once: true });
  }
}

/* ---------- 4. bramki ---------- */

export type Gate = "text" | "chrome" | "done";

const open: Record<Gate, boolean> = {
  text: false, // słowa w hero mogą się odsłaniać
  chrome: false, // nawigacja
  done: false, // scroll odblokowany, podpowiedź scrolla
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const openGate = (gate: Gate) => {
  if (open[gate]) return;
  open[gate] = true;
  emit();
};
const openAll = () => (["text", "chrome", "done"] as const).forEach(openGate);

export function useIntroGate(gate: Gate): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open[gate],
    () => true,
  );
}

export function onOpen(gate: Gate, cb: () => void): () => void {
  if (open[gate]) {
    cb();
    return () => {};
  }
  const listener = () => {
    if (!open[gate]) return;
    listeners.delete(listener);
    cb();
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ---------- 5a. zwykłe wejście (bez pełnego intro) ---------- */

// Światło rozwija się szybko i spokojnie po zdjęciu zasłony (to wejście po odświeżeniu,
// nie pełne intro); tekst i scroll są od razu.
function playQuick(): () => void {
  openAll();
  const tweens = [
    gsap.to(stage, {
      light: 1,
      duration: 1.1,
      delay: 0.05,
      ease: "power2.out",
    }),
    gsap.to(stage, {
      defocus: 0,
      duration: 1.5,
      delay: 0.05,
      ease: "power2.inOut",
    }),
    gsap.to(stage, { zoom: 0, duration: 1.8, delay: 0.05, ease: "power2.out" }),
  ];
  return () => tweens.forEach((t) => t.kill());
}

/* ---------- 5b. pełne intro: "wyostrzanie" (ok. 5,2 s) ---------- */

// Koncepcja (inspirowana tłem rozruchu PS5, ok. 11-15 s filmu, bez logo): jeden,
// ciągły ruch w czterech aktach, zbudowany wyłącznie z warstw ambientu. Dynamika
// jest dopasowana do pomiaru tej sekwencji w filmie (jasność, ostrość, snop):
//
// 1. Mgła bokeh (0-1,6 s): ogromne, rozmyte krążki światła w ciemności, powoli
//    jaśnieją do pierwszego szczytu. Okno widoku (winieta) jest wąskie i powoli się
//    otwiera.
// 2. Oddech (1,6-2,25 s): jasność szybko opada niemal do ciemności, a w tym
//    samym czasie ostrość "doskakuje": krążki zamieniają się w drobne, ostre
//    iskry. To właśnie ta chwila ciemności między aktami robi dynamikę.
// 3. Snop (2,25-4,1 s): z lewego górnego rogu wychodzą smugi światła, pod nimi
//    rozlewają się kolory, a światło (i mgła przy dole kadru) narasta do pełni.
// 4. Treść (3,3 s+): gdy snop jest prawie pełny, wchodzi tekst, potem nawigacja,
//    a na końcu światło wraca do kursora.
//
// Zasady, które robią "premium":
// - krzywa jasności ma trzy odcinki, które łączą się w szczycie i dolince z
//   zerową prędkością (sine), więc nigdzie nie ma szarpnięcia;
// - pozostałe właściwości mają jedną płynną krzywą (bez sklejonych tweenów);
// - akty zachodzą na siebie, a kamera płynie od pierwszej do ostatniej klatki;
// - żadnych "zdarzeń" (fal, błysków): wszystko jest ciągłe;
// - ostatni ruch (oddanie sterów kursorowi) kończy się równo z bramką "done",
//   więc ostatnia klatka intro i pierwsza klatka strony są identyczne.
const T = {
  peak: 1.6, // pierwszy szczyt jasności: mgła bokeh w pełni
  dip: 2.25, // dolinka jasności = moment wyostrzania
  full: 3.7, // jasność w pełni
  dust: 0.1, // pył wyłania się jako rozmyte krążki
  burst: 0.3, // cząstki rozchodzą się od punktu zapłonu
  vignette: 0.2, // okno widoku powoli się otwiera
  grain: 0.5, // ziarno cichnie
  zoom: 0, // kamera płynie przez cały czas
  size: 0.4, // światło rośnie
  focus: 1.45, // ostrość "doskakuje": krążki → iskry (krótko i zdecydowanie)
  sweep: 1.0, // światło zsuwa się ku nagłówkowi
  rays: 2.25, // snop z lewego górnego rogu
  bloom: 2.4, // kolory rozlewają się
  text: 3.3, // snop prawie pełny: wchodzi tekst hero
  chrome: 4.2, // nawigacja
  handoff: 4.0, // światło wraca do wędrowania / kursora
  done: 5.2, // koniec: scroll odblokowany
};

// Poziomy jasności w trzech odcinkach krzywej "oddechu"
const LIGHT = { peak: 0.55, dip: 0.15 };

// Klawisze modyfikujące nie powinny przerywać intro (np. początek Ctrl+F5)
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

// Pełne intro (komputer): cała oś czasu opisana w komentarzu wyżej.
function buildFullTimeline(tl: gsap.core.Timeline) {
  tl
    // kamera: wolny najazd od pierwszej do ostatniej klatki
    .to(stage, { zoom: 0, duration: 4.8, ease: "power2.out" }, 0)
    // jasność: szczyt mgły, szybka dolinka przy wyostrzaniu, potem narastanie do pełni
    // (sine.out na starcie, więc mgłę widać już w pierwszej sekundzie)
    .to(stage, { light: LIGHT.peak, duration: T.peak, ease: "sine.out" }, 0)
    .to(
      stage,
      { light: LIGHT.dip, duration: T.dip - T.peak, ease: "sine.inOut" },
      T.peak,
    )
    .to(
      stage,
      { light: 1, duration: T.full - T.dip, ease: "sine.inOut" },
      T.dip,
    )
    // pył wyłania się jako ogromne, rozmyte krążki (defocus stoi na 1 do T.focus)
    .to(stage, { dust: 1, duration: 1.8, ease: "sine.inOut" }, T.dust)
    // okno widoku powoli się otwiera, ziarno cichnie
    .to(stage, { vignette: 0, duration: 3.4, ease: "sine.inOut" }, T.vignette)
    .to(stage, { grain: 0, duration: 3.2, ease: "sine.out" }, T.grain)
    // cząstki rozchodzą się od punktu zapłonu; blask w połowie drogi wypada
    // w chwili wyostrzania, czyli na szczycie ruchu
    .to(stage, { burst: 1, duration: 3.2, ease: "sine.inOut" }, T.burst)
    // światło rośnie wolniej niż jasność
    .to(stage, { size: 1, duration: 3.6, ease: "power2.inOut" }, T.size)
    // akt 2: ostrość doskakuje: krążki kurczą się w ostre iskry (krótko, zdecydowanie)
    .to(stage, { defocus: 0, duration: 0.9, ease: "power2.inOut" }, T.focus)
    // światło zsuwa się ku nagłówkowi
    .to(stage, { path: 1, duration: 3.4, ease: "sine.inOut" }, T.sweep)
    // akt 3: snop z rogu, potem kolory
    .to(stage, { rays: 1, duration: 1.8, ease: "power1.inOut" }, T.rays)
    .to(stage, { bloom: 1, duration: 2.4, ease: "sine.inOut" }, T.bloom)
    // akt 4: treść
    .call(() => openGate("text"), [], T.text)
    .call(() => openGate("chrome"), [], T.chrome)
    // przekazanie: światło płynnie wraca do wędrowania / kursora
    .to(
      stage,
      { script: 0, duration: T.done - T.handoff, ease: "sine.inOut" },
      T.handoff,
    )
    .call(() => openGate("done"), [], T.done);
}

// Intro na telefonie (ok. 2,1 s): jeden łagodny ruch zamiast czterech aktów.
// Z ciemności wyłaniają się światło, kolorowe plamy i pył (rozmyte krążki bokeh,
// które powoli się wyostrzają). Nie ma najazdu kamery, winiety, ziarna, smug ani
// sceny z "oddechem", bo to wszystko pełnoekranowe warstwy, których telefon nie
// uciągnie w płynnych 60 klatkach. Tekst wchodzi, gdy światło jest w połowie,
// a scroll odblokowuje się równo z końcem ruchu.
const TM = { text: 0.9, chrome: 1.4, done: 2.1 };

function buildMobileTimeline(tl: gsap.core.Timeline) {
  tl.to(stage, { light: 1, duration: 1.7, ease: "sine.inOut" }, 0.05)
    .to(stage, { size: 1, duration: 1.8, ease: "sine.out" }, 0.05)
    .to(stage, { bloom: 1, duration: 2.0, ease: "sine.inOut" }, 0.1)
    .to(stage, { defocus: 0, duration: 1.7, ease: "sine.inOut" }, 0.15)
    .to(stage, { dust: 1, duration: 1.6, ease: "sine.inOut" }, 0.25)
    .call(() => openGate("text"), [], TM.text)
    .call(() => openGate("chrome"), [], TM.chrome)
    .call(() => openGate("done"), [], TM.done);
}

function playIntro(): () => void {
  if (!INTRO_PLAYS) return () => {};

  Object.assign(stage, START_NOW);
  open.text = open.chrome = open.done = false;
  emit();

  // chwilowe przycięcia (np. montowanie elementów) nie przeskakują animacji,
  // tylko ją na moment wstrzymują
  gsap.ticker.lagSmoothing(120, 33);

  let finished = false;
  let speedUp: gsap.core.Tween | null = null;

  // Domyka scenę w stanie końcowym i oddaje stronę użytkownikowi.
  // Wołane przez koniec osi czasu albo przez sprzątanie (HMR, odmontowanie),
  // dzięki czemu scroll nigdy nie zostaje zablokowany.
  const finish = () => {
    if (finished) return;
    finished = true;
    speedUp?.kill();
    gsap.ticker.lagSmoothing(0);
    Object.assign(stage, FINAL);
    openAll();
    SKIP_EVENTS.forEach((e) => window.removeEventListener(e, skip));
  };

  const tl = gsap.timeline({ onComplete: finish });

  // dowolna interakcja płynnie przyspiesza intro (rozpędzenie, nie skok)
  function skip(e: Event) {
    if (speedUp) return;
    if (e.type === "keydown" && MODIFIERS.has((e as KeyboardEvent).key)) return;
    speedUp = gsap.to(tl, {
      timeScale: 6,
      duration: 0.35,
      ease: "power2.in",
      overwrite: true,
    });
  }

  if (MOBILE) buildMobileTimeline(tl);
  else buildFullTimeline(tl);

  SKIP_EVENTS.forEach((e) =>
    window.addEventListener(e, skip, { passive: true }),
  );

  return () => {
    tl.kill();
    finish();
  };
}

/* ---------- 6. jedyne wejście dla app.tsx ---------- */

// Pozycja na stronie (patrz scrollMemory.ts) jest wstrzykiwana z zewnątrz, żeby intro.ts
// nie importował modułu, który sam zależy od intro.ts (useSmoothScroll).
export type ScrollMemory = {
  restore: () => Promise<void>; // zwykłe wejście: wróć w zapamiętane miejsce
  forget: () => void; // pełne intro: zacznij od góry
};

// Startuje od razu po zamontowaniu strony (jedna klatka, bez żadnego czekania):
// zdejmuje zasłonę i puszcza właściwy scenariusz. Zwraca funkcję sprzątającą
// (do useEffect). Start w kolejnej klatce zamiast synchronicznie sprawia, że
// podwójne wywołanie efektu w React StrictMode (dev) niczego nie psuje.
export function startEntrance(scroll?: ScrollMemory): () => void {
  let cancelled = false;
  let stop = () => {};

  const raf = requestAnimationFrame(() => {
    // znacznik do pomiaru: performance.getEntriesByName("entrance:start")[0].startTime
    performance.mark("entrance:start");
    if (INTRO_PLAYS) {
      // pełne intro zawsze od góry, więc stara pozycja jest zapomniana;
      // przy intro tło i tak jest czarne, więc zasłonę zdejmujemy od razu
      scroll?.forget();
      liftBoot(0);
      stop = playIntro();
      refreshInBackground();
      return;
    }
    // zwykłe wejście: zasłona zostaje, dopóki strona nie wróci na zapamiętane miejsce
    // (zwykle jedna klatka, maks. ok. 0,7 s, gdy strona jeszcze rośnie)
    void (scroll ? scroll.restore() : Promise.resolve()).then(() => {
      if (cancelled) return;
      liftBoot(0.4);
      stop = playQuick();
      refreshInBackground();
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    stop();
  };
}
