import { MOBILE } from "./device";

export const MOTION = {
  // start animacji: górna krawędź na 40% ekranu od dołu (komputer). Na telefonie wcześniej
  // (tuż po wejściu w ekran), bo palcem przewija się szybciej i dłużej niż kółkiem myszy
  revealStart: MOBILE ? "top 96%" : "top 60%",
  resetStart: "top bottom", // reset: element całkiem poza ekranem (od dołu)
  ease: "power4.out",
  holdScreens: 0.35, // zatrzymanie sekcji: ile ekranów scrolla, w których nic się nie dzieje
};
