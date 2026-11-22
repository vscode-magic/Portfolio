import { gsap, ScrollTrigger } from "./gsap";
import { INTRO_PATH, stage } from "./intro";
import { smoothScroll } from "./useSmoothScroll";
import { prepareWordReplay } from "./useWordReveal";
import { MOBILE, blur, unblur } from "./device";

/* =========================================================================
   returnToTop.ts: "wróć na górę" jako animacja tła, a nie zwykły scroll

   Koncepcja: zamiast długiej jazdy w górę strona się "domyka", w ciemności
   przeskakuje na samą górę i dopiero tam się odsłania.

   1. Zasłona (0-0,8 s): treść strony rozpuszcza się w rozmyciu, a tło się
      "wdycha": winieta zamyka okno widoku, ostrość ucieka, kolory i pył
      wracają do punktu światła, a samo światło ślizga się ku górze ekranu.
      Jednocześnie dock ("taskbar") zwija się i chowa za dolną krawędź ekranu,
      a scrollbar jest ukryty na czas całej animacji.
   2. Skok (0,8 s): w najciemniejszym momencie scroll ląduje na 0, bez jazdy.
   3. Odsłonięcie (0,8-2,95 s): odwrotnie niż intro. Najpierw snop wchodzi z
      lewego górnego rogu, światło SCHODZI z góry ku nagłówkowi, pył opada od
      górnej krawędzi (w intro rozchodzi się od środka), ostrość wraca szybko,
      a treść wyostrza się dopiero, gdy tło już świeci.
   4. Tekst (od 1,65 s): słowa w hero wchodzą dokładnie tą samą animacją co
      zawsze (useWordReveal), ale dopiero gdy tło już świeci i światło dociera
      do nagłówka, tak jak w intro. Słowa są schowane w chwili skoku, więc przy
      odsłonięciu treści nie ma nic "już zobaczonego".

   Wszystko dzieje się na tych samych parametrach `stage`, które czyta ambient,
   więc tło jest tym samym, tylko "odwróconym" i z innego miejsca.
   ========================================================================= */

// Punkt, w którym scroll ląduje na 0 (koniec zasłony)
const JUMP = 0.8;

// Kiedy po skoku wchodzą słowa (sekundy po skoku): tło już świeci, a światło
// dociera do nagłówka (w intro tekst wchodzi w analogicznym momencie)
const WORDS_AFTER_JUMP = 0.85;

// Trasa światła przy powrocie: schodzi z góry ku nagłówkowi (w intro: od środka).
// To też miejsce, z którego opada pył.
const RETURN_PATH = {
  x: [0.5, 0.44, 0.34, 0.26],
  y: [0.02, 0.2, 0.46, 0.68],
};

// Klawisze modyfikujące nie powinny przerywać animacji
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);
const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

let running = false;

// Elementy treści, które się rozpuszczają: wszystko w <main> poza kropką kursora,
// oraz stopka (to z niej klika się przycisk).
function contentTargets(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>("main > *"),
    ...document.querySelectorAll<HTMLElement>("main ~ footer"),
  ].filter((el) => !el.hasAttribute("data-cursor-dot"));
}

function replacePath(next: { x: number[]; y: number[] }) {
  INTRO_PATH.x.splice(0, INTRO_PATH.x.length, ...next.x);
  INTRO_PATH.y.splice(0, INTRO_PATH.y.length, ...next.y);
}

// Dock ("taskbar") zwija się i chowa za dolną krawędź ekranu, jak odwrócone wejście.
// Ruch ma delikatny, sprężysty "wdech" na starcie (ease back.in): dock najpierw
// minimalnie się unosi i rozszerza, potem się zwęża i spada poza ekran, gaśnie przy końcu.
//
// Zmieniamy tylko inline'owe translate/scale/opacity, bo Tailwind centruje dock właściwością
// CSS translate (-translate-x-1/2), a transformy GSAP by ją wchłonęły i rozjechały. Nie ruszamy
// zmiennych CSS ani pointer-events wiru: po skoku wir sam ustawia swój stan, a my po animacji
// zdejmujemy tylko własne nadpisania. Zwraca null, gdy dock i tak nie jest widoczny.
function prepareDockHide() {
  const dock = document.querySelector<HTMLElement>("[data-dock]");
  if (!dock) return null;
  const shown = () =>
    parseFloat(getComputedStyle(dock).getPropertyValue("--bar")) > 0.05;
  if (!shown()) return null;

  const rect = dock.getBoundingClientRect();
  const distance = Math.max(0, window.innerHeight - rect.top) + 32;
  // poziome przesunięcie z klasy (np. -50%); przy transformach z klas Tailwinda v3 jest "none"
  const baseTranslate = getComputedStyle(dock).translate;
  const baseX =
    baseTranslate && baseTranslate !== "none"
      ? baseTranslate.split(" ")[0]
      : "0px";

  const saved = {
    origin: dock.style.transformOrigin,
    pointerEvents: dock.style.pointerEvents,
  };
  dock.style.transformOrigin = "50% 100%";
  // bez pointer-events Dock sam zamyka otwarty popup (patrz tick w dock.tsx)
  dock.style.pointerEvents = "none";

  const state = { p: 0 }; // 0 = na miejscu, 1 = schowany (przy back.in na starcie lekko < 0)
  const apply = () => {
    const p = state.p;
    dock.style.setProperty("translate", `${baseX} ${p * distance}px`);
    dock.style.setProperty("scale", `${1 - 0.18 * p} ${1 - 0.12 * p}`);
    dock.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.5) / 0.5)));
  };
  const restore = () => {
    ["translate", "scale", "opacity"].forEach((prop) =>
      dock.style.removeProperty(prop),
    );
    dock.style.transformOrigin = saved.origin;
    // wir przywraca pointer-events przy zadokowaniu; wracamy do zapisanej wartości
    // tylko wtedy, gdy dock po skoku jest wciąż pokazany (czyli wir się nie zresetował)
    if (shown()) dock.style.pointerEvents = saved.pointerEvents;
  };
  return { state, apply, restore };
}

export function returnToTop(): void {
  const lenis = smoothScroll.lenis;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (running) return;

  // bez ruchu, już na górze albo na telefonie (tam nie rozmywamy całych sekcji
  // i nie robimy najazdu kamery): zwykły, płynny scroll
  if (reduce || MOBILE || window.scrollY < 4) {
    if (lenis)
      lenis.scrollTo(0, { duration: reduce ? 0.8 : MOBILE ? 1.6 : 1.2 });
    else window.scrollTo({ top: 0 });
    return;
  }

  running = true;
  lenis?.stop();

  const rest = { ...stage }; // stan spoczynkowy sceny, do którego wracamy na końcu
  const savedPath = { x: [...INTRO_PATH.x], y: [...INTRO_PATH.y] };
  const targets = contentTargets();
  // klasy w stopce mają własne przejście opacity, które gryzłoby się z animacją
  targets.forEach((el) => (el.style.transition = "none"));

  const dock = prepareDockHide();
  // scrollbar pokazuje się przy każdym evencie scrolla, więc po skoku by mignął
  const scrollbar = document.querySelector<HTMLElement>("[data-scrollbar]");
  if (scrollbar) scrollbar.style.visibility = "hidden";

  // trasa światła zmienia się, gdy scena jest jeszcze w pełni widoczna, ale to
  // niczego nie przesuwa: światło nie czyta trasy (script = 0), a cząstki przy
  // burst = 1 stoją na swoich miejscach. Dopiero potem zbiegają się do nowego punktu.
  replacePath(RETURN_PATH);
  stage.path = 0;

  let jumped = false;
  let finished = false;
  let speedUp: gsap.core.Tween | null = null;

  // odtworzenie animacji słów (ustawiane w chwili skoku, patrz jump)
  let replayWords: (() => void) | null = null;
  const playWords = () => {
    replayWords?.();
    replayWords = null;
  };

  const jump = () => {
    if (jumped) return;
    jumped = true;
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    ScrollTrigger.update();
    // teksty widoczne na górze wracają do stanu "przed animacją", póki treść jest
    // jeszcze zasłonięta; odtworzymy je, gdy tło będzie gotowe
    replayWords = prepareWordReplay();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    speedUp?.kill();
    SKIP_EVENTS.forEach((e) => window.removeEventListener(e, skip));
    jump(); // gdyby ktoś przerwał przed skokiem
    playWords(); // słowa nigdy nie zostają schowane
    gsap.set(targets, { clearProps: "opacity,filter" });
    targets.forEach((el) => (el.style.transition = ""));
    dock?.restore();
    if (scrollbar) scrollbar.style.visibility = "";
    replacePath(savedPath);
    Object.assign(stage, rest);
    lenis?.start();
    running = false;
  };

  const tl = gsap.timeline({ onComplete: finish });

  // dowolna interakcja płynnie przyspiesza animację
  function skip(e: Event) {
    if (speedUp) return;
    if (e.type === "keydown" && MODIFIERS.has((e as KeyboardEvent).key)) return;
    speedUp = gsap.to(tl, {
      timeScale: 5,
      duration: 0.35,
      ease: "power2.in",
      overwrite: true,
    });
  }

  const T = JUMP;

  // dock zwija się i chowa za dolną krawędź (sprężysty "wdech", potem spadek)
  if (dock) {
    tl.to(
      dock.state,
      { p: 1, duration: 0.62, ease: "back.in(1.4)", onUpdate: dock.apply },
      0,
    );
  }

  tl
    // 1. zasłona: treść rozpuszcza się w rozmyciu, nieco przed tłem
    .to(
      targets,
      { opacity: 0, ...blur(8), duration: 0.65, ease: "power2.in" },
      0,
    )
    // tło "wdycha": okno się zamyka, ostrość ucieka, wszystko wraca do światła
    .to(stage, { vignette: 0.92, duration: T, ease: "sine.inOut" }, 0)
    .to(stage, { defocus: 0.85, duration: T, ease: "sine.inOut" }, 0)
    .to(stage, { light: 0.3, duration: T, ease: "sine.inOut" }, 0)
    .to(stage, { zoom: 0.35, duration: T, ease: "power2.inOut" }, 0)
    .to(stage, { rays: 0.25, duration: T, ease: "sine.inOut" }, 0)
    .to(stage, { bloom: 0.3, duration: T, ease: "sine.inOut" }, 0)
    .to(stage, { burst: 0, duration: T, ease: "sine.inOut" }, 0)
    // światło ślizga się ku górze ekranu (początek trasy powrotnej)
    .to(stage, { script: 1, duration: T, ease: "sine.inOut" }, 0)

    // 2. skok: w najciemniejszym momencie, bez jazdy
    .call(jump, [], T)

    // 3. odsłonięcie: najpierw snop i światło, ostrość wraca szybko
    .to(stage, { light: 1, duration: 1.3, ease: "sine.out" }, T)
    .to(stage, { rays: 1, duration: 1.1, ease: "power2.out" }, T + 0.05)
    .to(stage, { defocus: 0, duration: 1.1, ease: "power2.out" }, T + 0.05)
    .to(stage, { bloom: 1, duration: 1.5, ease: "sine.inOut" }, T + 0.15)
    .to(stage, { burst: 1, duration: 1.6, ease: "sine.inOut" }, T)
    .to(stage, { vignette: 0, duration: 1.4, ease: "sine.inOut" }, T)
    .to(stage, { zoom: 0, duration: 1.6, ease: "power2.out" }, T)
    // światło schodzi z góry ku nagłówkowi
    .to(stage, { path: 1, duration: 1.6, ease: "sine.inOut" }, T)
    // treść (nagłówek, nawigacja) wyostrza się, gdy tło już świeci
    .to(
      targets,
      { opacity: 1, ...unblur, duration: 0.9, ease: "power2.out" },
      T + 0.5,
    )
    // słowa wchodzą tą samą animacją co zawsze, gdy światło dociera do nagłówka
    .call(playWords, [], T + WORDS_AFTER_JUMP)
    // scroll wraca, gdy treść jest już widoczna
    .call(() => lenis?.start(), [], T + 1.1)
    // światło płynnie wraca do wędrowania / kursora
    .to(stage, { script: 0, duration: 0.9, ease: "sine.inOut" }, T + 1.2)
    .call(finish, [], T + 2.15);

  SKIP_EVENTS.forEach((e) =>
    window.addEventListener(e, skip, { passive: true }),
  );
}
