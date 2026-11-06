import { useEffect, useState } from "react";

function measure(screens: number): boolean {
  const remaining =
    document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  return remaining <= window.innerHeight * screens;
}

// true, gdy do końca strony zostało nie więcej niż `screens` wysokości okna.
// Zależy tylko od wysokości dokumentu i pozycji scrolla, więc nie myli się przy przypiętych sekcjach (wir).
export function useNearPageEnd(screens: number): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setNear(measure(screens));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [screens]);

  return near;
}
