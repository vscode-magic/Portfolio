import { useEffect, useRef } from "react";
import { smoothScroll } from "../lib/useSmoothScroll";
import { useIntroGate } from "../lib/intro";

const HIDE_AFTER = 1200; // ms bez ruchu, po których pasek znika
const EDGE = 32; // px od prawej krawędzi, w których pasek się pokazuje
const MARGIN = 10; // odstęp od góry i dołu okna

export function Scrollbar() {
  const ready = useIntroGate("done");
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trackEl = track.current;
    const thumbEl = thumb.current;
    if (!ready || !trackEl || !thumbEl) return;
    // na ekranach dotykowych zostaje natywny pasek
    if (!matchMedia("(pointer: fine)").matches) return;

    const doc = document.documentElement;
    let maxScroll = 1;
    let thumbHeight = 48;
    let travel = 1;
    let frame = 0;
    let hideTimer = 0;
    let hovering = false;
    let dragging = false;

    const setActive = (on: boolean) => {
      thumbEl.dataset.active = on ? "true" : "false";
    };
    const hide = () => {
      if (hovering || dragging) return;
      trackEl.style.opacity = "0";
      trackEl.style.pointerEvents = "none";
    };
    const show = () => {
      trackEl.style.opacity = "1";
      trackEl.style.pointerEvents = "auto";
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, HIDE_AFTER);
    };

    const measure = () => {
      const total = doc.scrollHeight;
      const area = window.innerHeight - MARGIN * 2;
      maxScroll = Math.max(1, total - window.innerHeight);
      thumbHeight = Math.max(48, (area * window.innerHeight) / total);
      travel = Math.max(1, area - thumbHeight);
      thumbEl.style.height = `${thumbHeight}px`;
      trackEl.style.visibility =
        total <= window.innerHeight + 1 ? "hidden" : "visible";
    };
    const place = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      thumbEl.style.transform = `translate3d(0, ${progress * travel}px, 0)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    const scrollTo = (y: number, smooth: boolean) => {
      const target = Math.min(maxScroll, Math.max(0, y));
      if (smoothScroll.lenis) {
        smoothScroll.lenis.scrollTo(
          target,
          smooth ? { duration: 1.2 } : { immediate: true },
        );
      } else {
        window.scrollTo({ top: target });
      }
    };

    const onScroll = () => {
      schedule();
      show();
    };

    // pasek pokazuje się, gdy kursor jest przy prawej krawędzi
    const onMove = (e: PointerEvent) => {
      if (dragging) return;
      const near = e.clientX >= window.innerWidth - EDGE;
      if (near !== hovering) {
        hovering = near;
        setActive(near);
        show();
      }
    };

    let startY = 0;
    let startScroll = 0;
    const onThumbDown = (e: PointerEvent) => {
      e.preventDefault();
      dragging = true;
      setActive(true);
      startY = e.clientY;
      startScroll = window.scrollY;
      thumbEl.setPointerCapture(e.pointerId);
      show();
    };
    const onThumbMove = (e: PointerEvent) => {
      if (!dragging) return;
      scrollTo(
        startScroll + ((e.clientY - startY) / travel) * maxScroll,
        false,
      );
    };
    const onThumbUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      thumbEl.releasePointerCapture(e.pointerId);
      hovering = e.clientX >= window.innerWidth - EDGE;
      setActive(hovering);
      show();
    };
    const onTrackDown = (e: PointerEvent) => {
      if (e.target === thumbEl) return;
      const y = e.clientY - MARGIN - thumbHeight / 2;
      scrollTo((y / travel) * maxScroll, true);
    };

    measure();
    place();
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    thumbEl.addEventListener("pointerdown", onThumbDown);
    thumbEl.addEventListener("pointermove", onThumbMove);
    thumbEl.addEventListener("pointerup", onThumbUp);
    thumbEl.addEventListener("pointercancel", onThumbUp);
    trackEl.addEventListener("pointerdown", onTrackDown);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      thumbEl.removeEventListener("pointerdown", onThumbDown);
      thumbEl.removeEventListener("pointermove", onThumbMove);
      thumbEl.removeEventListener("pointerup", onThumbUp);
      thumbEl.removeEventListener("pointercancel", onThumbUp);
      trackEl.removeEventListener("pointerdown", onTrackDown);
      window.clearTimeout(hideTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready]);

  return (
    <div
      ref={track}
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 right-0 z-[9998] w-4 opacity-0 transition-opacity duration-500 ease-out"
      style={{ touchAction: "none" }}
    >
      <div
        ref={thumb}
        data-active="false"
        className="absolute right-[3px] w-[5px] rounded-full bg-white/25 transition-[width,background-color,box-shadow] duration-300 ease-out data-[active=true]:w-[9px] data-[active=true]:bg-white/55 data-[active=true]:shadow-[0_0_14px_rgba(167,139,250,0.55)]"
        style={{ top: MARGIN }}
      />
    </div>
  );
}
