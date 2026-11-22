import { gsap, ScrollTrigger } from "./gsap";
import { smoothScroll } from "./useSmoothScroll";
import { prepareWordReplay } from "./useWordReveal";
import { blur, unblur } from "./device";

/* =========================================================================
   languageFade.ts: płynna zmiana języka

   Problem: Reveal ma key z aktualnym językiem, więc po zmianie wszystkie teksty
   montują się od nowa. Słowa znikały w jednej klatce (intensywny skok), potem
   animacja słów odpalała się od zera, a wysokości sekcji zmieniały się bez
   odświeżenia ScrollTriggerów.

   Teraz zmiana języka to jeden płynny ruch:
   1. wygaszenie (od kliknięcia): treść miękko znika w rozmyciu, razem z ruchem
      przełącznika (sam przełącznik, nagłówek i canvas wiru nie są ruszane);
   2. podmiana (gdy soczewka dojedzie): język zmienia się, gdy treść jest już
      niewidoczna, więc ciężki rerender i zmiana układu nie są widoczne;
   3. odsłonięcie: układ jest odświeżany, pozycja zachowana proporcjonalnie, treść
      wyostrza się, a słowa wchodzą tą samą animacją co zawsze (useWordReveal).
   ========================================================================= */

const OUT = 0.32; // wygaszenie (s)
const IN = 0.55; // odsłonięcie (s)
const WORDS_DELAY = 0.12; // słowa startują chwilę po początku odsłaniania

export type LanguageFade = {
  // po wygaszeniu: wykonaj zmianę języka, odśwież układ i odsłoń treść
  commit: (swap: () => unknown) => Promise<void>;
  // wróć bez zmiany języka (np. użytkownik przesunął przełącznik z powrotem)
  cancel: () => void;
};

let current: LanguageFade | null = null;

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      requestAnimationFrame(() => (left <= 1 ? resolve() : step(left - 1)));
    step(count);
  });

// Treść do wygaszenia: dzieci sekcji (poza nagłówkiem z przełącznikiem i canvasem
// wiru, który jest ciężki do rozmywania) oraz stopka.
function contentTargets(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "main section > :not(header):not(canvas)",
    ),
    ...document.querySelectorAll<HTMLElement>("main ~ footer"),
  ];
}

// Animacje z scrub (np. Fade) dochodzą do swojej wartości z opóźnieniem, a po
// odświeżeniu układu byłoby to widać, więc kończymy je od razu (patrz scrollMemory.ts).
function settleScrubs() {
  ScrollTrigger.getAll().forEach((st) => {
    const tween = st.getTween?.();
    if (tween && typeof tween.progress === "function") tween.progress(1);
  });
}

export function beginLanguageFade(): LanguageFade {
  if (current) return current;

  // bez ruchu: sama podmiana języka, bez wygaszania
  if (reduceMotion()) {
    return {
      commit: async (swap) => {
        await swap();
      },
      cancel: () => {},
    };
  }

  let els = contentTargets();
  // klasy (np. w stopce) mają własne przejście opacity, które gryzłoby się z animacją
  els.forEach((el) => (el.style.transition = "none"));

  const hide = (list: HTMLElement[]) =>
    gsap.set(list, { opacity: 0, ...blur(6) });
  const finish = () => {
    gsap.set(els, { clearProps: "opacity,filter" });
    els.forEach((el) => (el.style.transition = ""));
    current = null;
  };

  const fadeOut = gsap.to(els, {
    opacity: 0,
    ...blur(6),
    duration: OUT,
    ease: "power2.in",
  });

  const fade: LanguageFade = {
    async commit(swap) {
      try {
        await fadeOut; // treść jest już niewidoczna (gsap tween jest "thenable")

        // zachowujemy proporcjonalną pozycję: teksty w drugim języku mają inną długość
        const before = Math.max(
          1,
          document.documentElement.scrollHeight - innerHeight,
        );
        const ratio = window.scrollY / before;

        await swap();
        await frames(2); // React montuje Reveal od nowa (key = język), SplitText dzieli słowa

        // nowe elementy (gdyby się pojawiły) też zaczynają jako niewidoczne
        els = contentTargets();
        els.forEach((el) => (el.style.transition = "none"));
        hide(els);

        ScrollTrigger.refresh(); // wysokości sekcji się zmieniły
        const after = Math.max(
          0,
          document.documentElement.scrollHeight - innerHeight,
        );
        if (ratio > 0 && after > 0) {
          const y = Math.round(ratio * after);
          smoothScroll.lenis?.scrollTo(y, { immediate: true, force: true });
          window.scrollTo(0, y);
          ScrollTrigger.update();
        }
        settleScrubs();

        // widoczne teksty wracają do stanu "przed animacją"; wejdą tą samą animacją co zawsze
        const playWords = prepareWordReplay();

        gsap.to(els, {
          opacity: 1,
          ...unblur,
          duration: IN,
          ease: "power2.out",
          onComplete: finish,
        });
        gsap.delayedCall(WORDS_DELAY, playWords);
      } catch (error) {
        // błąd zmiany języka nie może zostawić pustej strony
        gsap.to(els, {
          opacity: 1,
          ...unblur,
          duration: IN,
          onComplete: finish,
        });
        throw error;
      }
    },

    cancel() {
      fadeOut.kill();
      gsap.to(els, {
        opacity: 1,
        ...unblur,
        duration: 0.35,
        ease: "power2.out",
        onComplete: finish,
      });
    },
  };

  current = fade;
  return fade;
}
