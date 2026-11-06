import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { smoothScroll } from "../lib/useSmoothScroll";
import { useNearPageEnd } from "../lib/useNearPageEnd";

function warsawTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

export function SiteFooter() {
    const { t } = useTranslation();
    const [time, setTime] = useState(warsawTime);
    const near = useNearPageEnd(1.4);

  useEffect(() => {
    const id = window.setInterval(() => setTime(warsawTime()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const toTop = () => {
    if (smoothScroll.lenis) smoothScroll.lenis.scrollTo(0, { duration: 1.8 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer
      className={`relative z-10 border-t border-white/10 px-6 pb-28 pt-8 transition-opacity duration-1000 md:px-16 ${
        near ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 font-mono text-[11px] text-white/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <span className="tabular-nums">
          {t("footer.location")} · {time.slice(0, 2)}
          <span className="animate-pulse">:</span>
          {time.slice(3)}
        </span>
        <span>{t("footer.built")}</span>
        <button
          type="button"
          onClick={toTop}
          className="group inline-flex items-center gap-1.5 text-left transition-colors duration-500 hover:text-white"
        >
          {t("footer.top")}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-500 ease-out group-hover:-translate-y-1"
          >
            ↑
          </span>
        </button>
      </div>
    </footer>
  );
}
