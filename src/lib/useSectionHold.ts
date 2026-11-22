import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "./gsap";
import { MOTION } from "./motion";
import { MOBILE } from "./device";

// Kolejność odświeżania ScrollTriggerów musi odpowiadać kolejności sekcji na stronie
// (od góry do dołu), bo każde zatrzymanie dodaje wysokość, od której zależy położenie
// wszystkich sekcji poniżej. Wyższy priorytet = odświeżane wcześniej.
export function pagePriority(el: Element): number {
  const sections = Array.from(document.querySelectorAll("main section"));
  const index = sections.indexOf(el.closest("section") ?? el);
  return 100 - Math.max(0, index) * 10;
}

// Jak długo trwa zwalnianie sekcji, liczone jako wielokrotność dystansu zatrzymania.
// Przy ease sine.inOut najwolniejszy moment to 1 - π/(2·spread) normalnej prędkości:
//   1.6 = ok. 2% (prawie pełne zatrzymanie, jak twardy pin)
//   1.8 = ok. 13% (domyślnie)
//   2.4 = ok. 35%, 2.8 = ok. 44% (sekcja tylko lekko "ciężkieje")
// Można podać własną wartość dla konkretnej sekcji (trzeci argument useSectionHold).
const SPREAD = 1.8;
const MIN_SPREAD = Math.PI / 2 + 0.05; // poniżej sekcja cofałaby się względem ekranu

// Zatrzymania sekcji (transform sterowany scrollem) są wyłączone przy ograniczonym ruchu
// oraz na telefonie: tam scroll jest natywny i każda sekcja jechałaby z opóźnieniem
// względem palca. Bez zatrzymań nie ma też spacerów, więc strona jest krótsza.
const prefersReducedMotion = () =>
  MOBILE ||
  (typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// Ile pikseli scrolla dodaje zatrzymanie (strona robi się o tyle dłuższa, tak jak
// wcześniej przy pinie). Bez ruchu (prefers-reduced-motion) nie ma zatrzymania wcale.
export function holdDistance(screens = MOTION.holdScreens): number {
  if (typeof window === "undefined" || prefersReducedMotion()) return 0;
  return window.innerHeight * Math.min(screens, 0.45);
}

// Położenie elementu od góry dokumentu liczone z układu strony (offsetTop), więc nie
// zależy od transformów, które w trakcie zatrzymania przesuwają sekcję.
export function documentTop(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

// Miękkie zatrzymanie sekcji zamiast twardego pina.
//
// Twardy pin zmienia prędkość sekcji z pełnej na zero w jednej klatce i z powrotem,
// i właśnie to widać jako "zahaczenie", mimo gładkiego Lenisa. Tu sekcja jest
// przesuwana w dół (transform) po krzywej sine.inOut sterowanej scrollem, więc jej
// prędkość zmienia się płynnie: pełna, zwalnia, najwolniejsza w środku, przyspiesza,
// pełna. Dodatkowa długość scrolla jest taka sama jak przy pinie: sekcja po zwolnieniu
// jest o dokładnie holdDistance niżej, a ten odstęp rezerwuje spacer za sekcją.
export function useSectionHold(
  ref: RefObject<HTMLElement | null>,
  screens = MOTION.holdScreens,
  spread = SPREAD,
) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;

      const hold = () => holdDistance(screens);
      const zone = () => hold() * Math.max(spread, MIN_SPREAD);

      // spacer rezerwuje miejsce, o które sekcja zostaje przesunięta w dół
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.pointerEvents = "none";
      const syncSpacer = () => {
        spacer.style.height = `${hold()}px`;
        // Fade czyta stąd, o ile sekcja jest przesunięta po zwolnieniu
        el.dataset.holdPx = String(hold());
      };
      syncSpacer();
      el.after(spacer);
      // wysokość spacerów musi być ustawiona zanim którykolwiek trigger zacznie mierzyć
      ScrollTrigger.addEventListener("refreshInit", syncSpacer);

      gsap.fromTo(
        el,
        { y: 0 },
        {
          y: () => hold(),
          ease: "sine.inOut",
          force3D: true, // stała warstwa: bez "przeskoku" tekstu po zakończeniu animacji
          scrollTrigger: {
            trigger: el,
            // środek strefy zwalniania = sekcja wyśrodkowana na ekranie (wysoka sekcja:
            // jej dół na dole ekranu); na samym początku strony strefa startuje od 0
            start: () => {
              const anchor =
                el.offsetHeight > window.innerHeight
                  ? documentTop(el) + el.offsetHeight - window.innerHeight
                  : documentTop(el) +
                    el.offsetHeight / 2 -
                    window.innerHeight / 2;
              return Math.max(0, anchor - zone() / 2);
            },
            end: () => `+=${zone()}`,
            scrub: true, // bez dodatkowego opóźnienia: gładkość daje Lenis
            invalidateOnRefresh: true,
            refreshPriority: pagePriority(el),
          },
        },
      );

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", syncSpacer);
        spacer.remove();
        delete el.dataset.holdPx;
      };
    },
    { scope: ref },
  );
}
