import { ScrollTrigger } from "./gsap";
import { smoothScroll } from "./useSmoothScroll";
import type { ScrollMemory } from "./intro";

/* =========================================================================
   scrollMemory.ts: zapamiętana pozycja na stronie

   - zwykłe odświeżenie (F5): użytkownik wraca dokładnie w to samo miejsce
   - Ctrl+F5 / pierwsze wejście / ?intro: pełne intro od góry, pozycja zapomniana
     (decyduje o tym intro.ts, który wtedy woła forget zamiast restore)

   Pozycja trzyma się w sessionStorage (osobna dla każdej karty, znika po jej
   zamknięciu, więc nowa karta to zawsze "pierwsze wejście").

   Dlaczego nie natywne przywracanie przeglądarki: robi to zanim strona ma pełną
   wysokość (piny sekcji, odstępy zatrzymań, doładowane fonty i obrazy), więc
   ląduje w złym miejscu albo na samej górze. Tu czekamy, aż strona urośnie do
   zapamiętanej wysokości, a potem jeszcze chwilę pilnujemy pozycji, gdy układ
   się przesuwa.
   ========================================================================= */

const KEY = "portfolioScroll";
const MIN_RESTORE = 8; // px: poniżej tego pozycja to w praktyce góra strony
const WAIT_MS = 700; // tyle maksymalnie czekamy, aż strona urośnie do zapamiętanej wysokości
const SETTLE_MS = 3000; // tyle po wejściu pilnujemy pozycji, gdy układ jeszcze się zmienia
const CHECK_EVERY_MS = 200;
const SAVE_EVERY_MS = 200;

// Przeglądarka nie może przywracać scrolla sama (robi to za wcześnie), robimy to tutaj
if (typeof window !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const INTERACTIONS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

const maxScroll = () =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function read(): number | null {
  try {
    const value = Number(sessionStorage.getItem(KEY));
    return Number.isFinite(value) && value >= MIN_RESTORE ? value : null;
  } catch {
    return null;
  }
}

function write(y: number) {
  try {
    sessionStorage.setItem(KEY, String(Math.round(y)));
  } catch {
    /* ignorujemy */
  }
}

function clear() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignorujemy */
  }
}

// Animacje z scrub (np. Fade) dochodzą do swojej wartości z opóźnieniem. Bez tego po
// powrocie w zapamiętane miejsce (i po odświeżeniu układu, np. gdy doładują się fonty)
// byłoby widać, jak "przewijają się" od starej wartości do bieżącej (efekt speed runu),
// więc kończymy je od razu.
const settleScrubs = () =>
  ScrollTrigger.getAll().forEach((st) => {
    // getTween() zwraca 0 (nie undefined), gdy trigger nie ma wygładzania (scrub: true),
    // więc samo "?." nie wystarcza
    const tween = st.getTween?.();
    if (tween && typeof tween.progress === "function") tween.progress(1);
  });

function scrollNow(y: number) {
  const lenis = smoothScroll.lenis;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  window.scrollTo(0, y);
  ScrollTrigger.update();
  settleScrubs();
}

/* ---------- zapisywanie ---------- */

// Zapis włączamy dopiero po przywróceniu pozycji, inaczej pierwszy event scrolla
// (na samej górze albo przy chwilowo za niskiej stronie) nadpisałby zapamiętane miejsce.
let saving = false;
let saveTimer = 0;

const save = () => {
  if (saving) write(window.scrollY);
};

const scheduleSave = () => {
  if (!saving || saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    save();
  }, SAVE_EVERY_MS);
};

function startSaving() {
  if (saving) return;
  saving = true;
  window.addEventListener("scroll", scheduleSave, { passive: true });
  // zapis tuż przed odświeżeniem, zamknięciem albo ukryciem karty
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  save();
}

/* ---------- odtwarzanie ---------- */

async function restore(): Promise<void> {
  const target = read();
  if (target === null) {
    startSaving();
    return;
  }

  // 1. czekamy (krótko), aż strona urośnie do zapamiętanej wysokości
  const reachable = () => maxScroll() >= target - 2;
  const started = performance.now();
  while (!reachable() && performance.now() - started < WAIT_MS) await frame();

  const place = () => scrollNow(Math.min(target, maxScroll()));
  place();

  // 2. do pierwszej interakcji (albo SETTLE_MS) pilnujemy pozycji: fonty, obrazy i
  //    piny potrafią jeszcze przesunąć układ już po pierwszym ustawieniu
  let checkTimer = 0;
  let endTimer = 0;
  const correct = () => {
    if (reachable() && Math.abs(window.scrollY - target) > 3) place();
  };
  const finish = () => {
    window.clearInterval(checkTimer);
    window.clearTimeout(endTimer);
    INTERACTIONS.forEach((e) => window.removeEventListener(e, finish));
    window.removeEventListener("load", correct);
    ScrollTrigger.removeEventListener("refresh", settleScrubs);
    startSaving();
  };
  checkTimer = window.setInterval(correct, CHECK_EVERY_MS);
  endTimer = window.setTimeout(finish, SETTLE_MS);
  INTERACTIONS.forEach((e) =>
    window.addEventListener(e, finish, { passive: true, once: true }),
  );
  window.addEventListener("load", correct, { once: true });
  void document.fonts?.ready.then(correct);
  // odświeżenie układu w oknie pilnowania też nie może uruchamiać "dobiegania" animacji
  ScrollTrigger.addEventListener("refresh", settleScrubs);
}

// Pełne intro zaczyna od góry, więc stara pozycja jest zapomniana
function forget() {
  clear();
  startSaving();
}

export const scrollMemory: ScrollMemory = { restore, forget };
