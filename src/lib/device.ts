/* =========================================================================
   device.ts: jedno miejsce, które mówi, czy strona działa w trybie mobile.

   Tryb mobile = ekran dotykowy (pointer: coarse) albo wąskie okno (< 768 px).
   W tym trybie strona dostaje lżejszą wersję efektów: mniej elementów w tle,
   bez mieszania warstw i rozmywania całych sekcji, prostsze intro i lżejszy wir.

   Do testów na komputerze:  ?mobile  wymusza tryb mobile,  ?full  wymusza pełny.
   ========================================================================= */

function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("full")) return false;
    if (q.has("mobile")) return true;
    return (
      matchMedia("(pointer: coarse)").matches ||
      matchMedia("(max-width: 767px)").matches
    );
  } catch {
    return false;
  }
}

export const MOBILE = detect();

// CSS reaguje na ten atrybut (html[data-mobile]), więc ?mobile działa też w stylach
if (MOBILE && typeof document !== "undefined") {
  document.documentElement.setAttribute("data-mobile", "");
}

// Rozmycie (filter: blur) całych sekcji i pojedynczych słów kosztuje na telefonie
// tyle, że zacina scroll. Na mobile animujemy tylko przezroczystość (i ruch).
export const blur = (px: number): { filter?: string } =>
  MOBILE ? {} : { filter: `blur(${px}px)` };
export const unblur: { filter?: string } = MOBILE
  ? {}
  : { filter: "blur(0px)" };
