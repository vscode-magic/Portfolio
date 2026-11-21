import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";
import { INTRO_PLAYS, onOpen } from "./intro";
import { MOBILE } from "./device";
export const smoothScroll: { lenis: Lenis | null } = { lenis: null };

export function useSmoothScroll() {
  useEffect(() => {
    // mniejszy lerp = płynniej i z większym opóźnieniem
    const lenis = new Lenis({ lerp: 0.065, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    smoothScroll.lenis = lenis;

    // na czas intro scroll jest zablokowany, strona startuje od góry
    if (INTRO_PLAYS) {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      lenis.stop();
      // telefon: Lenis nie przejmuje dotyku, więc scroll na czas intro blokujemy w CSS
      if (MOBILE) document.documentElement.style.overflow = "hidden";
    }
    const offIntro = onOpen("done", () => {
      document.documentElement.style.overflow = "";
      lenis.start();
    });

    // telefon: ignoreMobileResize wyłącza automatyczne przeliczanie przy zmianach okna, więc
    // pozycje animacji odświeżamy sami, gdy zmieni się wysokość strony (np. doładowały się
    // zrzuty projektów). Bez tego animacje tekstu odpalały się za późno.
    let roTimer = 0;
    let lastHeight = document.body.offsetHeight;
    const ro = MOBILE
      ? new ResizeObserver(() => {
          const h = document.body.offsetHeight;
          if (Math.abs(h - lastHeight) < 2) return;
          lastHeight = h;
          window.clearTimeout(roTimer);
          roTimer = window.setTimeout(() => ScrollTrigger.refresh(), 300);
        })
      : null;
    ro?.observe(document.body);

    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      offIntro();
      ro?.disconnect();
      window.clearTimeout(roTimer);
      document.documentElement.style.overflow = "";
      gsap.ticker.remove(tick);
      smoothScroll.lenis = null;
      lenis.destroy();
    };
  }, []);
}
