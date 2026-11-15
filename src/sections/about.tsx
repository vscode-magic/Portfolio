import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/reveal";
import { Fade } from "../components/fade";
import { useSectionHold } from "../lib/useSectionHold";

export function About() {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  // about: delikatniejsze niż pozostałe sekcje
  useSectionHold(root, 0.25, 2.4);
  const facts = t("about.facts", { returnObjects: true }) as string[];

  return (
    <section ref={root} data-hold className="px-6 py-32 md:px-16">
      <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2">
        <Fade>
          <Reveal
            as="h2"
            text={t("about.title")}
            className="text-5xl font-semibold tracking-tight md:text-7xl"
          />
        </Fade>
        <div>
          <Fade>
            <Reveal
              as="p"
              text={t("about.body")}
              className="text-2xl leading-snug text-white/80"
            />
          </Fade>
          <div className="mt-12 space-y-3">
            {facts.map((f) => (
              <Fade
                key={f}
                cursor
                className="glass rounded-3xl px-7 py-5 text-white/75 transition-[translate,color] duration-500 ease-out hover:translate-x-2 hover:text-white"
              >
                {f}
              </Fade>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
