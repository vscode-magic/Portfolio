import { useEffect } from "react";

// Plamka światła na szkle: element .glass / .glass-solid pod kursorem dostaje
// zmienne --mx i --my (pozycja kursora wewnątrz elementu), po wyjściu wracają poza kadr.
export function useGlassLight() {
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches) return;

    let last: HTMLElement | null = null;
    const hide = (el: HTMLElement) => {
      el.style.setProperty("--mx", "-999px");
      el.style.setProperty("--my", "-999px");
    };

    const onMove = (event: PointerEvent) => {
      const el =
        (event.target as Element | null)?.closest<HTMLElement>(
          ".glass, .glass-solid",
        ) ?? null;
      if (last && last !== el) hide(last);
      last = el;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty(
        "--mx",
        `${(event.clientX - rect.left).toFixed(1)}px`,
      );
      el.style.setProperty(
        "--my",
        `${(event.clientY - rect.top).toFixed(1)}px`,
      );
    };
    const onLeave = () => {
      if (last) hide(last);
      last = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (last) hide(last);
    };
  }, []);
}
