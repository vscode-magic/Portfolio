import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, SplitText } from "./gsap";
import { MOTION } from "./motion";
import { onOpen } from "./intro";

// Rejestr aktywnych tekstów, żeby animację słów dało się odtworzyć ponownie bez
// scrollowania (np. po powrocie na górę, patrz returnToTop.ts).
type Replay = { el: HTMLElement; hide: () => void; play: () => void };
const replays = new Set<Replay>();

// Linia, powyżej której tekst jest już "wchodzący": to samo co MOTION.revealStart
// ("top 60%"), czyli górna krawędź na 60% wysokości ekranu.
const REVEAL_LINE = 0.6;

// Chowa teraz widoczne teksty (słowa wracają do stanu początkowego) i zwraca funkcję,
// która odtwarza dla nich dokładnie tę samą animację co przy normalnym wejściu.
// Wołać, gdy treść jest zasłonięta; funkcję odtwarzającą wołać, gdy tło jest gotowe.
export function prepareWordReplay(): () => void {
  const targets = [...replays].filter((r) => {
    const box = r.el.getBoundingClientRect();
    return box.top < window.innerHeight * REVEAL_LINE && box.bottom > 0;
  });
  targets.forEach((r) => r.hide());
  return () => targets.forEach((r) => r.play());
}

export function useWordReveal(ref: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // aktualna animacja słów (przy autoSplit jest tworzona od nowa po każdym podziale)
      let current: gsap.core.Tween | null = null;
      let offGate = () => {};
      const replay: Replay = {
        el,
        hide: () => {
          offGate();
          current?.pause(0);
        },
        play: () => {
          current?.play();
        },
      };
      replays.add(replay);

      SplitText.create(el, {
        type: "words",
        autoSplit: true,
        onSplit(self) {
          const tween = gsap.from(self.words, {
            yPercent: 28,
            opacity: 0,
            filter: "blur(10px)", // słowa wyostrzają się jak w przeostrzeniu ostrości
            duration: 1.5,
            ease: "power3.out", // spokojnie, bez odbicia
            stagger: { amount: Math.min(1.1, self.words.length * 0.07) },
            paused: true,
          });

          current = tween;

          // animacja słów czeka na bramkę "text": podczas intro otwiera się ona,
          // gdy światło dojeżdża do nagłówka, poza intro jest już otwarta
          ScrollTrigger.create({
            trigger: el,
            start: MOTION.revealStart,
            onEnter: () => {
              offGate();
              offGate = onOpen("text", () => tween.play());
            },
          });
          ScrollTrigger.create({
            trigger: el,
            start: MOTION.resetStart,
            onLeaveBack: () => {
              offGate();
              tween.pause(0); // wraca do stanu początkowego
            },
          });

          return tween;
        },
      });

      return () => {
        replays.delete(replay);
      };
    },
    { scope: ref },
  );
}
