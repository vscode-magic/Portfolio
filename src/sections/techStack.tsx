import { useTranslation } from "react-i18next";
import { Reveal } from "../components/reveal";
import { Fade } from "../components/fade";

/* =========================================================================
   TechStack: wersja sekcji "technologie" na telefon (zamiast wiru 3D).

   Trzy poziome pasy ikon, które się powoli przesuwają w przeciwne strony. To czysty
   CSS (sam transform, patrz .marquee w index.css), więc chodzi płynnie na kompozytorze
   i nie potrzebuje WebGL ani Three.js. Ikony są tymi samymi plikami co w wirze.
   ========================================================================= */

const modules = import.meta.glob<string>("../assets/icons/*.{png,webp,svg}", {
  eager: true,
  import: "default",
});

const ICONS = Object.entries(modules)
  .map(([path, src]) => ({
    src,
    name: path
      .split("/")
      .pop()!
      .replace(/\.\w+$/, ""),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ikony rozdzielone po kolei na trzy pasy, żeby każdy miał podobną długość i mieszankę
const ROWS: (typeof ICONS)[] = [[], [], []];
ICONS.forEach((icon, i) => ROWS[i % 3].push(icon));

// czas jednego obiegu (s), kierunek i przesunięcie początkowe każdego pasa
const ROW_STYLE = [
  { duration: 42, reverse: false, offset: 0 },
  { duration: 52, reverse: true, offset: -6 },
  { duration: 46, reverse: false, offset: -13 },
] as const;

function Row({
  icons,
  duration,
  reverse,
  offset,
}: {
  icons: typeof ICONS;
  duration: number;
  reverse: boolean;
  offset: number;
}) {
  // lista powielona dwa razy: przesunięcie o połowę szerokości daje pętlę bez szwu
  const items = [...icons, ...icons];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]">
      <div
        className="marquee flex w-max"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
          animationDelay: `${offset}s`,
        }}
      >
        {items.map((icon, i) => (
          <div
            key={`${icon.name}-${i}`}
            className="mr-4 grid size-[4.5rem] shrink-0 place-items-center rounded-2xl border border-white/10 border-t-white/25 bg-white/[0.06] p-3.5"
            aria-hidden={i >= icons.length}
          >
            <img
              src={icon.src}
              alt={i < icons.length ? icon.name : ""}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TechStack() {
  const { t } = useTranslation();

  return (
    <section className="relative z-30 py-24">
      <Fade className="px-6">
        <Reveal
          as="p"
          text={t("vortex.eyebrow")}
          className="mb-4 text-sm uppercase tracking-[0.3em] text-white/50"
        />
        <Reveal
          as="h2"
          text={t("vortex.title")}
          className="text-4xl font-semibold tracking-tight"
        />
      </Fade>

      <Fade className="mt-12 space-y-4">
        {ROWS.map((icons, i) => (
          <Row key={i} icons={icons} {...ROW_STYLE[i]} />
        ))}
      </Fade>
    </section>
  );
}
