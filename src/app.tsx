import { useEffect } from "react";
import { Ambient } from "./components/ambient";
import { Cursor } from "./components/cursor";
import { Hero } from "./sections/hero";
import { About } from "./sections/about";
import { IconVortex } from "./sections/iconVortex";
import { CodeTime } from "./sections/codeTime";
import { Projects } from "./sections/projects";
import { Contact } from "./sections/contact";
import { SiteFooter } from "./components/siteFooter";
import { Scrollbar } from "./components/scrollbar";
import { useSmoothScroll } from "./lib/useSmoothScroll";
import { useGlassLight } from "./lib/useGlassLight";
import { startEntrance } from "./lib/intro";
import { scrollMemory } from "./lib/scrollMemory";

export default function App() {
  useSmoothScroll();
  useGlassLight();

  // wejście na stronę: intro albo powrót na zapamiętane miejsce (lib/intro.ts, lib/scrollMemory.ts)
  useEffect(() => startEntrance(scrollMemory), []);

  return (
    <>
      <Ambient />
      <main>
        <Cursor />
        <Hero />
        <About />
        <IconVortex />
        <CodeTime />
        <Projects />
        <Contact />
      </main>
      <SiteFooter />
      <Scrollbar />
    </>
  );
}
