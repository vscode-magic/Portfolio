import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { useTranslation } from "react-i18next";
import { gsap } from "../lib/gsap";
import { HelloWriter } from "../components/helloWriter";
import { useSectionHold } from "../lib/useSectionHold";
import { useNearPageEnd } from "../lib/useNearPageEnd";

// adres składamy w kodzie z części, żeby proste boty zbierające maile go nie znalazły
const USER = "pzniszczol20";
const DOMAIN = "gmail.com";

const LINKS = [
  { key: "github", href: "https://github.com/vscode-magic" },
  { key: "codetime", href: "https://codetime.dev/en/user/33120" },
] as const;

function EmailButton({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  const address = `${USER}@${DOMAIN}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // starsze przeglądarki: kopiowanie przez tymczasowe pole tekstowe
      const field = document.createElement("textarea");
      field.value = address;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    // zielony błysk przebiega przez litery adresu
    gsap.fromTo(
      gsap.utils.toArray<HTMLElement>("[data-char]", button.current),
      { color: "#6ee7b7" },
      {
        color: "#ffffff",
        duration: 0.9,
        stagger: 0.025,
        ease: "power2.out",
        clearProps: "color",
        overwrite: "auto",
      },
    );
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // litery wysuwają się spod maski jedna po drugiej, a po ukryciu wracają na start
  useGSAP(
    () => {
      const el = button.current;
      const chars = gsap.utils.toArray<HTMLElement>("[data-char]");
      if (!visible) {
        el?.setAttribute("data-ready", "false");
        gsap.set(chars, { yPercent: 115, opacity: 0 });
        return;
      }
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(chars, { yPercent: 0, opacity: 1 });
        el?.setAttribute("data-ready", "true");
        return;
      }
      gsap.fromTo(
        chars,
        { yPercent: 115, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: "power4.out",
          stagger: 0.032,
          overwrite: true,
          onComplete: () => el?.setAttribute("data-ready", "true"),
        },
      );
    },
    { dependencies: [visible], scope: button },
  );

  // przyciąganie tekstu do kursora i fala liter po najechaniu (tylko mysz)
  useGSAP(
    () => {
      const el = button.current;
      const target = el?.querySelector<HTMLElement>("[data-magnet]");
      if (
        !el ||
        !target ||
        !matchMedia("(hover: hover) and (pointer: fine)").matches ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const chars = gsap.utils.toArray<HTMLElement>("[data-char]", el);
      const mx = gsap.quickTo(target, "x", { duration: 0.7, ease: "power3" });
      const my = gsap.quickTo(target, "y", { duration: 0.7, ease: "power3" });

      const enter = () => {
        // fala startuje dopiero po zakończeniu wejścia liter
        if (el.dataset.ready !== "true") return;
        gsap.fromTo(
          chars,
          { yPercent: 0 },
          {
            yPercent: -9,
            duration: 0.3,
            ease: "power2.out",
            stagger: 0.02,
            yoyo: true,
            repeat: 1,
            overwrite: "auto",
          },
        );
      };
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        mx(((e.clientX - (r.left + r.width / 2)) / r.width) * 16);
        my(((e.clientY - (r.top + r.height / 2)) / r.height) * 10);
      };
      const leave = () => {
        mx(0);
        my(0);
      };
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: button },
  );

  return (
    <button
      ref={button}
      type="button"
      onClick={copy}
      tabIndex={visible ? 0 : -1}
      aria-label={t("contact.emailLabel")}
      className={`group block text-left ${visible ? "" : "pointer-events-none"}`}
    >
      <span data-magnet className="block">
        <span
          aria-hidden="true"
          className="relative inline-block text-[clamp(1.5rem,6vw,3.75rem)] font-medium tracking-tight"
        >
          {address.split("").map((char, i) => (
            <span
              key={i}
              className="-my-[0.12em] inline-block overflow-hidden py-[0.12em] align-bottom"
            >
              <span data-char className="inline-block opacity-0">
                {char}
              </span>
            </span>
          ))}
          <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-white/70 transition-transform duration-700 ease-out group-hover:scale-x-100" />
        </span>
        <span className="relative mt-4 block h-4 font-mono text-[11px] tracking-wide">
          <span
            className={`absolute left-0 top-0 text-white/45 transition-opacity duration-300 ${
              copied ? "opacity-0" : "opacity-100"
            }`}
          >
            {t("contact.copy")}
          </span>
          <span
            className={`absolute left-0 top-0 text-emerald-300/90 transition-opacity duration-300 ${
              copied ? "opacity-100" : "opacity-0"
            }`}
          >
            {t("contact.copied")}
          </span>
        </span>
      </span>
    </button>
  );
}

export function Contact() {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  useSectionHold(root);

  // wszystko w tej sekcji jest ukryte, dopóki nie jesteśmy blisko końca strony
  const active = useNearPageEnd(1.15);

  // miękka poświata podąża za kursorem (przesuwana transformacją, więc tania w renderowaniu)
  useGSAP(
    () => {
      const section = root.current;
      const orb = glow.current;
      if (
        !section ||
        !orb ||
        !matchMedia("(hover: hover) and (pointer: fine)").matches ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      gsap.set(orb, {
        xPercent: -50,
        yPercent: -50,
        x: section.clientWidth * 0.5,
        y: section.clientHeight * 0.5,
      });
      const x = gsap.quickTo(orb, "x", { duration: 1.2, ease: "power3" });
      const y = gsap.quickTo(orb, "y", { duration: 1.2, ease: "power3" });
      const move = (e: PointerEvent) => {
        const r = section.getBoundingClientRect();
        x(e.clientX - r.left);
        y(e.clientY - r.top);
      };
      section.addEventListener("pointermove", move);
      return () => section.removeEventListener("pointermove", move);
    },
    { scope: root },
  );

  // adres pojawia się, gdy pierwsze słowo jest już prawie napisane
  const [showEmail, setShowEmail] = useState(false);
  useEffect(() => {
    if (!active || showEmail) return;
    const id = window.setTimeout(() => setShowEmail(true), 1600);
    return () => window.clearTimeout(id);
  }, [active, showEmail]);

  // wejście elementów: przesunięcie i pojawienie się z kolejnym opóźnieniem
  const appear = (delayMs: number) => ({
    className: `transition-all duration-1000 ease-out ${
      active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
    }`,
    style: { transitionDelay: active ? `${delayMs}ms` : "0ms" },
  });

  return (
    <section
      ref={root}
      data-hold
      className="relative flex min-h-screen flex-col justify-center px-6 pb-40 pt-32 md:px-16"
    >
      <div
        ref={glow}
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 size-[36rem] rounded-full transition-opacity duration-1000 ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.14), transparent)",
          willChange: "transform",
        }}
      />

      <div
        className={`mx-auto w-full max-w-6xl ${active ? "" : "pointer-events-none"}`}
        aria-hidden={!active}
      >
        <p
          style={appear(0).style}
          className={`mb-6 text-sm uppercase tracking-[0.3em] text-white/50 ${appear(0).className}`}
        >
          {t("contact.eyebrow")}
        </p>

        <HelloWriter
          play={active}
          className="h-[clamp(6rem,14vw,10rem)] w-full"
        />

        <p
          style={appear(400).style}
          className={`mt-6 max-w-xl text-lg text-white/60 ${appear(400).className}`}
        >
          {t("contact.lead")}
        </p>

        <div className="mt-12">
          <EmailButton visible={showEmail} />
        </div>

        <ul
          style={appear(800).style}
          className={`mt-14 flex flex-wrap gap-x-8 gap-y-3 font-mono text-sm ${appear(800).className}`}
        >
          {LINKS.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={active ? 0 : -1}
                className="group inline-flex items-center gap-2 text-white/55 transition-colors duration-500 hover:text-white"
              >
                {t(`contact.links.${link.key}`)}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                >
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
