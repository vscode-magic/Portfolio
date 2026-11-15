import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/reveal";
import { LanguageSwitch } from "../components/languageSwitch";
import { Fade } from "../components/fade";
import { useSectionHold } from "../lib/useSectionHold";
import { ScrollHint } from "../components/scrollHint";
import { useIntroGate } from "../lib/intro";

export function Hero() {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  // hero: lekkie zatrzymanie (krótkie i bardzo miękkie), bo zaczyna się od pierwszego scrolla
  useSectionHold(root, 0.18, 2.8);

  // tekst jest zamontowany od początku (podział na słowa dzieje się w ciemności),
  // a animacja słów czeka na bramkę "text" (patrz useWordReveal)
  const chromeReady = useIntroGate("chrome");

  return (
    <section
      ref={root}
      data-hold
      className="relative flex min-h-screen flex-col justify-between px-6 py-8 md:px-[max(4rem,calc((100vw-120rem)/2))]"
    >
      <header
        className={`relative z-10 flex items-center justify-between transition-opacity duration-[1400ms] ease-out ${
          chromeReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-lg font-semibold tracking-tight">Piotr</span>
        <LanguageSwitch />
      </header>

      <Fade mode="out" className="relative z-10 max-w-5xl pb-24">
        <Reveal
          as="p"
          text={t("hero.eyebrow")}
          className="mb-6 text-sm uppercase tracking-[0.3em] text-white/50"
        />
        <Reveal
          as="h1"
          text={t("hero.title")}
          className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-8xl"
        />
        <Reveal
          as="p"
          text={t("hero.subtitle")}
          className="mt-8 max-w-xl text-lg text-white/60"
        />
      </Fade>
      <ScrollHint />
    </section>
  );
}
