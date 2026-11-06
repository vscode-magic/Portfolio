import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { useTranslation } from "react-i18next";
import { gsap } from "../lib/gsap";
import { useIntroGate } from "../lib/intro";

export function ScrollHint() {
  const { t } = useTranslation();
  const ready = useIntroGate("done");
  const [atTop, setAtTop] = useState(
    () => typeof window === "undefined" || window.scrollY < 60,
  );
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // światło przesuwa się po linii w pętli
  useGSAP(
    () => {
      const el = bar.current;
      if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        el,
        { yPercent: -100 },
        {
          yPercent: 100,
          duration: 1.6,
          ease: "power2.inOut",
          repeat: -1,
          repeatDelay: 0.5,
        },
      );
    },
    { scope: bar },
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 transition-opacity duration-700 ${
        ready && atTop ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
        {t("hero.scroll")}
      </span>
      <span className="relative block h-12 w-px overflow-hidden bg-white/15">
        <span
          ref={bar}
          className="absolute inset-x-0 top-0 block h-full bg-white/80"
        />
      </span>
    </div>
  );
}
