// Modelo de estados del álbum Panini Mundial 2026.
// Fuente de verdad: docs/MODELO.md. Si la implementación contradice ese doc,
// el bug está acá. Funciones puras, sin dependencias de UI ni framework.
//
// Estado de una lámina: dupla (p, s)
//   p ∈ {0, 1}      ¿está pegada en el álbum?
//   s ∈ {0, 1, 2…}  copias sueltas en mano

// ──────────────────────────────────────────────────────────────────────────
// Predicados puros — los 4 filtros visibles en la UI
// ──────────────────────────────────────────────────────────────────────────

export const enFaltantes = ({ p, s }) => p === 0 && s === 0;
export const enSueltas   = ({ p, s }) => p === 0 && s >= 1;
export const enPegadas   = ({ p, s }) => p === 1;
export const enRepetidas = ({ p, s }) => s >= 1;

// ──────────────────────────────────────────────────────────────────────────
// clasificar: devuelve los filtros donde aparece una lámina, además del
// color con que debe pintarse el círculo en los filtros Sueltas/Repetidas.
// ──────────────────────────────────────────────────────────────────────────

export function clasificar({ p, s }) {
  // El color en filtros Sueltas/Repetidas se decide por la cantidad de
  // sobras físicas (máx(p + s − 1, 0)), igual que el contador. Si tiene
  // sobras (≥ 1) es repetida real → ámbar; si no, es candidata → azul.
  // Esto trata correctamente (1, 1) como ámbar (1 sobra) y (0, 1) como azul.
  const sobras = Math.max(p + s - 1, 0);
  return {
    faltante:        enFaltantes({ p, s }),
    suelta:          enSueltas({ p, s }),
    pegada:          enPegadas({ p, s }),
    repetida:        enRepetidas({ p, s }),
    repetidaColor:   enRepetidas({ p, s }) ? (sobras >= 1 ? 'ambar' : 'azul') : null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// aplicarGesto: única forma de mutar (p, s). El botón + hace cosas distintas
// según el filtro origen, y esa diferencia vive acá (no en handlers de UI).
// Sueltas es el único camino al álbum: + en Sueltas pega 1 copia, dejando
// las demás como Repetidas.
// ──────────────────────────────────────────────────────────────────────────

export function aplicarGesto({ p, s }, filtroOrigen, gesto) {
  if (filtroOrigen === 'faltantes' && gesto === 'plus') {
    if (p !== 0 || s !== 0) throw new Error('Precondición violada: faltantes/plus');
    return { p: 0, s: 1 };
  }
  if (filtroOrigen === 'sueltas' && gesto === 'plus') {
    if (p !== 0 || s < 1) throw new Error('Precondición violada: sueltas/plus');
    return { p: 1, s: s - 1 };
  }
  if (filtroOrigen === 'sueltas' && gesto === 'minus') {
    if (p !== 0 || s < 1) throw new Error('Precondición violada: sueltas/minus');
    return { p: 0, s: s - 1 };
  }
  if (filtroOrigen === 'repetidas' && gesto === 'plus') {
    if (s < 0) throw new Error('Precondición violada: repetidas/plus');
    return { p, s: s + 1 };
  }
  if (filtroOrigen === 'repetidas' && gesto === 'minus') {
    if (s < 1) throw new Error('Precondición violada: repetidas/minus');
    return { p, s: s - 1 };
  }
  if (filtroOrigen === 'pegadas' && gesto === 'plus') {
    if (p !== 1) throw new Error('Precondición violada: pegadas/plus');
    return { p: 1, s: s + 1 };
  }
  throw new Error(`Gesto no válido: ${filtroOrigen}/${gesto}`);
}

// ──────────────────────────────────────────────────────────────────────────
// contadores: las 4 métricas grandes de la homepage. El big number de
// Sueltas cuenta láminas distintas, sueltasCopias cuenta piezas físicas.
// El de Repetidas cuenta MONAS FÍSICAS DE SOBRA: Σ máx(s − 1, 0).
// ──────────────────────────────────────────────────────────────────────────

export const contadores = (laminas) => ({
  pegadas:        laminas.filter(l => l.p === 1).length,
  sueltas:        laminas.filter(l => l.p === 0 && l.s >= 1).length,
  sueltasCopias:  laminas.reduce((sum, l) => sum + (l.p === 0 ? l.s : 0), 0),
  faltantes:      laminas.filter(l => l.p === 0 && l.s === 0).length,
  // Sobras = piezas físicas que le sobran al usuario por encima del cupo del
  // álbum. Si p=0, una copia es "necesaria para pegar" y no cuenta como sobra
  // (Σ máx(s−1, 0)). Si p=1, todas las copias en mano son sobras (Σ s). La
  // fórmula unificada es máx(p + s − 1, 0) por lámina.
  repetidas:      laminas.reduce((sum, l) => sum + Math.max(l.p + l.s - 1, 0), 0),
  total:          laminas.length,
});
