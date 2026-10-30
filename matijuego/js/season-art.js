// Imágenes de temporada: qué arte usa cada evento de js/events.js.
// Aquí NO hay fechas: el evento activo lo decide solo activeEvent() (events.js), con sus fechas, su zona
// horaria (la hora local del aparato) y su forma de probar otros eventos (?event=halloween).
// Sin evento, o si el evento activo no tiene arte, se usa el arte "habitual" (todo el año). Si la imagen no
// carga, la pantalla de carga muestra el sello de siempre (solo el logo).
//
// Para sumar una temporada: poner sus imágenes en resources/temporadas/<id-del-evento>/, generar los recursos con
// scripts/temporada-recursos.mjs (ver docs/TEMPORADAS.md) y agregar abajo el id del evento con su color de fondo.

import { activeEvent } from "./events.js?v=cfffb722e8";

/** Arte de la pantalla de carga de cada temporada (sin textos ni logo: esos van aparte, con los archivos reales). */
const art = (id, bg) => ({
  loading: `assets/temporadas/${id}/carga.webp`,
  loadingBlur: `assets/temporadas/${id}/carga-fondo.webp`, // la misma imagen chiquita y borrosa, para rellenar los costados
  bg, // color de respaldo mientras carga la imagen
});

export const SEASON_ART = {
  habitual: art("habitual", "#1f4f86"), // todo el año, cuando no hay evento
  sanvalentin: art("sanvalentin", "#6e1f4c"),
  pascua: art("pascua", "#2f6f9e"),
  dianino: art("dianino", "#2a5f8f"),
  patrias: art("patrias", "#1f3f73"),
  halloween: art("halloween", "#24123d"),
  navidad: art("navidad", "#1d1f4f"),
};

/** El arte de la temporada activa (o del evento que se pase); sin evento o sin arte propio, el habitual. */
export function seasonArt(event = activeEvent()) {
  const own = event && SEASON_ART[event.id];
  if (own) return { id: event.id, name: event.name, ...own };
  return { id: "habitual", name: "Matijuego", ...SEASON_ART.habitual };
}
