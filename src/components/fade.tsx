import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap";
import { documentTop } from "../lib/useSectionHold";
import { MOBILE } from "../lib/device";

type Props = {
  children: ReactNode;
  className?: string;
  mode?: "inOut" | "in" | "out";
  distance?: number;
  cursor?: boolean;
};

// Płynne pojawianie i znikanie sterowane scrollem. Działa w obie strony:
// przewijanie w górę odwraca animację dokładnie tak samo płynnie.
// Gdy element jest prawie niewidoczny, nie reaguje na kursor (pointer-events: none),
// żeby ukryta sekcja nie przechwytywała hovera spod innej sekcji.
export function Fade({
  children,
  className,
  mode = "inOut",
  distance = 48,
  cursor,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // sekcje z zatrzymaniem (data-hold) po zwolnieniu są przesunięte w dół o dystans
      // zatrzymania (ustawia go useSectionHold), więc wyjście musi zacząć się o tyle później
      const held = el.closest<HTMLElement>("[data-hold]");
      const exitAt = (viewportShare: number, fallback: string) => () =>
        held
          ? documentTop(el) +
            el.offsetHeight -
            window.innerHeight * viewportShare +
            (Number(held.dataset.holdPx) || 0)
          : fallback;

      // przed wejściem i po wyjściu element jest niewidoczny, więc wyłączamy mu kursor
      let hiddenIn = mode !== "out";
      let hiddenOut = false;
      const sync = () => {
        el.style.pointerEvents = hiddenIn || hiddenOut ? "none" : "";
      };
      const checkIn = (progress: number) => {
        const hidden = progress < 0.5;
        if (hidden !== hiddenIn) {
          hiddenIn = hidden;
          sync();
        }
      };
      const checkOut = (progress: number) => {
        const hidden = progress > 0.5;
        if (hidden !== hiddenOut) {
          hiddenOut = hidden;
          sync();
        }
      };
      sync();

      if (mode !== "out") {
        gsap.fromTo(
          el,
          { opacity: 0, y: distance },
          {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              // telefon: wejście zaczyna się i kończy wyżej, a wygładzanie jest krótsze
              start: MOBILE ? "top 100%" : "top 96%",
              end: MOBILE ? "top 78%" : "top 66%",
              scrub: MOBILE ? 0.3 : 0.6,
              onUpdate: (self) => checkIn(self.progress),
              onRefresh: (self) => checkIn(self.progress),
            },
          },
        );
      }
      if (mode !== "in") {
        gsap.fromTo(
          el,
          { opacity: 1, y: 0 },
          {
            opacity: 0,
            y: -distance * 0.6,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: el,
              start: exitAt(0.4, "bottom 40%"),
              end: exitAt(0.05, "bottom 5%"),
              invalidateOnRefresh: true,
              scrub: MOBILE ? 0.3 : 0.6,
              onUpdate: (self) => checkOut(self.progress),
              onRefresh: (self) => checkOut(self.progress),
            },
          },
        );
      }

      return () => {
        el.style.pointerEvents = "";
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className} data-cursor={cursor ? "" : undefined}>
      {children}
    </div>
  );
}
