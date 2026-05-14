# Modelo de estados — Álbum Panini Mundial 2026

> **Propósito de este documento:** especificación inequívoca del modelo de datos, filtros, operaciones y UX del tracker. Este archivo es la fuente de verdad. Si la implementación contradice este documento, el bug está en la implementación.

> **Audiencia:** Claude Code u otro desarrollador haciendo el refactor.

---

## 1 · Modelo de datos

Cada lámina del álbum se representa por **dos variables de estado**:

| Variable | Tipo | Dominio | Significado |
|---|---|---|---|
| `p` | binario | `0` o `1` | ¿Está pegada en el álbum? `1 = sí`, `0 = no`. |
| `s` | entero no negativo | `0, 1, 2, 3, ...` | Cuántas copias **sueltas** tiene en mano (sin pegar). |

Una lámina queda completamente determinada por la dupla `(p, s)`. No hay otros atributos de estado. Los nombres "Faltante", "Suelta", "Pegada", "Repetida" son **etiquetas de filtro**, no estados — se derivan de `(p, s)`.

### Invariantes (deben cumplirse siempre)

- `p ∈ {0, 1}`
- `s ≥ 0` (entero, nunca negativo)
- No hay otras dimensiones (no se rastrea fecha, ubicación física, condición, etc.)

### Estado inicial

Toda lámina inicia en `(p=0, s=0)`. Es decir, todas faltantes.

---

## 2 · Filtros (predicados puros)

Los 4 filtros visibles en la UI son funciones que reciben `(p, s)` y devuelven `boolean`. Una misma lámina puede aparecer en **varios filtros simultáneamente**.

| Filtro | Predicado | En palabras |
|---|---|---|
| **Faltantes** | `p === 0 && s === 0` | No la tiene |
| **Sueltas** | `p === 0 && s >= 1` | Tiene al menos una en mano, sin pegar |
| **Pegadas** | `p === 1` | Está en el álbum (con o sin extras) |
| **Repetidas** | `s >= 1` | Tiene al menos una copia en mano (esté pegada o no) |

### Nota sobre el cambio respecto a versiones anteriores

Una versión anterior del doc usaba `p === 0 && s === 1` (estricto) para Sueltas. Eso tenía un hoyo: una lámina con `(0, 2+)` no aparecía en Sueltas, y como **Sueltas es el único camino para pegar**, no había forma de pegar una lámina con dos o más copias sin antes perder copias en Repetidas. Esta versión amplía Sueltas a `s >= 1` y permite pegar desde cualquier `(0, s)`.

### Cobertura

Toda dupla `(p, s)` cae en al menos un filtro:

| `(p, s)` | Faltantes | Sueltas | Pegadas | Repetidas |
|---|---|---|---|---|
| `(0, 0)` | ✓ | | | |
| `(0, 1)` | | ✓ | | ✓ |
| `(0, 2+)` | | ✓ | | ✓ |
| `(1, 0)` | | | ✓ | |
| `(1, 1)` | | | ✓ | ✓ |
| `(1, 2+)` | | | ✓ | ✓ |

### Implementación de referencia (JavaScript)

```js
export const enFaltantes = ({ p, s }) => p === 0 && s === 0;
export const enSueltas   = ({ p, s }) => p === 0 && s >= 1;
export const enPegadas   = ({ p, s }) => p === 1;
export const enRepetidas = ({ p, s }) => s >= 1;

/**
 * Devuelve los filtros donde aparece una lámina, además del color
 * con que debe pintarse el círculo en cada filtro.
 */
export function clasificar({ p, s }) {
  return {
    faltante:        enFaltantes({ p, s }),
    suelta:          enSueltas({ p, s }),
    pegada:          enPegadas({ p, s }),
    repetida:        enRepetidas({ p, s }),
    repetidaColor:   enRepetidas({ p, s }) ? (s === 1 ? 'azul' : 'ambar') : null,
  };
}
```

---

## 3 · Color del círculo dentro de cada tarjeta

El color del círculo de una lámina **depende del filtro en que se está viendo**, no solo de `(p, s)`.

Sea `sobras = máx(p + s − 1, 0)` (la misma fórmula del contador de Repetidas).

| Filtro | `(0,1)` | `(0, 2+)` | `(1, 0)` | `(1, 1)` | `(1, 2+)` |
|---|---|---|---|---|---|
| Faltantes | — | — | — | — | — |
| Sueltas | azul *(sin badge)* | azul *(sin badge)* | — | — | — |
| Pegadas | — | — | verde | verde *(sin badge)* | verde *(sin badge)* |
| Repetidas | azul *(candidata)* | ámbar *(badge `+sobras`)* | — | ámbar *(badge `+sobras`)* | ámbar *(badge `+sobras`)* |

Reglas:

- **En Pegadas, "verde es sagrado" sólo aplica al despegar.** No hay badge de extras (la vista es del álbum, no del inventario). El botón `+` añade una mona en mano sin cambiar el color.
- **En Sueltas, todas azul sin badge.** La acción de este filtro es pegar; cuántas copias hay no importa para esa decisión. El detalle de sobras vive en el filtro Repetidas.
- **En Repetidas, el color refleja sobras físicas:** azul si `sobras === 0` (candidata, todavía no le sobra nada al usuario), ámbar si `sobras ≥ 1` (repetida real con badge `+sobras`). El valor del badge **es la misma fórmula del contador**: `máx(p + s − 1, 0)`.
- **Vista global (sin filtro):** colores sólidos por `(p, s)` — rojo si faltante `(0,0)`, azul si suelta única `(0,1)`, verde si pegada limpia `(1,0)`, ámbar si tiene sobras (`p + s − 1 ≥ 1`).

---

## 4 · Contadores de las tarjetas (homepage)

Cada tarjeta de filtro en la homepage muestra **un número grande** y un **subtítulo**. Las fórmulas son sumatorias sobre **todas las láminas** del álbum.

| Tarjeta | Número grande | Subtítulo | Justificación |
|---|---|---|---|
| **Pegadas** *(donut)* | `count(p === 1) / N` | "PEGADAS" | Métrica de progreso del álbum |
| **Sueltas** | `count(p === 0 && s >= 1)` | `Σ s · "copias"` (donde `p === 0`) | Cuenta de láminas distintas que tengo en mano sin pegar; subtítulo total de piezas físicas en mano |
| **Faltantes** | `count(p === 0 && s === 0)` | "por conseguir" | Cuenta de láminas distintas que faltan |
| **Repetidas** | `Σ máx(p + s − 1, 0)` | "X monas" | **Monas físicas de sobra** disponibles para intercambiar |

### Por qué el contador de Repetidas es `Σ máx(p + s − 1, 0)` y no otra cosa

- La palabra "monas" en el dominio significa **piezas físicas individuales**, no posiciones de álbum. El contador tiene que reflejar piezas.
- Es la métrica accionable para intercambios: cuántas piezas físicas le sobran al usuario por encima de lo que el álbum puede albergar.
- Si `p = 0` y `s = 1`, la única copia es "necesaria para pegar" y no es sobra (cuenta 0). Por eso se resta 1.
- Si `p = 1`, todas las copias en mano son sobras (el álbum ya tiene su lugar ocupado). El cupo del álbum se cubre por `p`, no por `s`.
- La fórmula unificada que cubre los dos casos es `máx(p + s − 1, 0)`, que es equivalente a "total físico − cupo del álbum (si lo hay)".

### Por qué el subtítulo de Sueltas es `Σ s` y no `count`

- El número grande ya muestra cuántas láminas distintas tienes en mano.
- El subtítulo agrega **información útil que no es redundante**: cuántas piezas físicas hay en total en la pila de sueltas (ej. 5 láminas distintas pero 8 copias en mano).

### Implementación de referencia

```js
export const contadores = (laminas) => ({
  pegadas:        laminas.filter(l => l.p === 1).length,
  sueltas:        laminas.filter(l => l.p === 0 && l.s >= 1).length,
  sueltasCopias:  laminas.reduce((sum, l) => sum + (l.p === 0 ? l.s : 0), 0),
  faltantes:      laminas.filter(l => l.p === 0 && l.s === 0).length,
  repetidas:      laminas.reduce((sum, l) => sum + Math.max(l.p + l.s - 1, 0), 0),
  total:          laminas.length,
});
```

---

## 5 · Operaciones (cambios en `(p, s)`)

Cada operación es una función pura que toma `(p, s)` y un contexto (filtro origen + gesto) y devuelve `(p', s')`.

| # | Filtro origen | Gesto | Precondición | Cambio | Efecto en filtros |
|---|---|---|---|---|---|
| 1 | Faltantes | tap `+` | `(0, 0)` | `s ← 1` → `(0, 1)` | sale de Faltantes; entra a Sueltas y Repetidas |
| 2 | Sueltas | tap `+` (= pegar) | `p === 0 && s >= 1` | `p ← 1, s ← s − 1` → `(1, s−1)` | pega una; si `s` queda en 0 sale de Sueltas y Repetidas; si no, queda en Repetidas |
| 3 | Sueltas | tap `−` (= descartar) | `p === 0 && s >= 1` | `s ← s − 1` | si llega a 0 vuelve a Faltantes |
| 4 | Repetidas | tap `+` | `s ≥ 0` | `s ← s + 1` | si era azul (`s=1`), pasa a ámbar (`s=2`); badge aparece |
| 5 | Repetidas | tap `−` | `s ≥ 1` | `s ← s − 1` | si llega a `s=0`, sale de Repetidas (y de Sueltas si era `(0,1)`) |
| 6 | Pegadas | tap `+` | `p === 1` | `s ← s + 1` | si era (1,0) entra a Repetidas; si ya estaba, queda en Repetidas con badge (s≥2) |

### Implementación de referencia

```js
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
```

---

## 6 · Reglas de UX

### Gestos disponibles en cada filtro

| Filtro | Botón `+` | Botón `−` | Long-press | Tap en imagen |
|---|---|---|---|---|
| Faltantes | sí | no existe | no | abre detalle |
| Sueltas | sí (= pegar) | sí (= descartar) | no | abre detalle |
| Pegadas | sí (+1 mona en mano) | no existe | no | abre detalle |
| Repetidas | sí | sí | no | abre detalle |

### Reglas explícitas

- **Long-press sólo en vista global.** En cualquier filtro activo (Faltantes / Sueltas / Pegadas / Repetidas) los botones `+`/`−` cubren todas las acciones, así que el long-press se desactiva ahí (evita race conditions con tap+ rápido y overlays accidentales). En vista global, donde el tap es no-op por diseño, el long-press abre el menú flotante con todas las acciones disponibles según el estado.
- **No existe "despegar".** Pegar una lámina es irreversible (refleja la realidad física: el adhesivo destruye el papel).
- **Undo de último tap.** Después de cualquier gesto, mostrar un toast tipo `"Pegada ✓ · Deshacer"` por ~5 segundos. Esto cubre el caso de tap accidental sin meter "despegar" como operación permanente del modelo.
- **Sin "menú: quitar (lámina dañada)".** Caso tan raro que no justifica complejidad. Si pasa, el usuario puede resetear el álbum.
- **Tap en la imagen (no en los botones)** abre el detalle de la lámina.
- **Sueltas como único camino al álbum.** El `+` de Sueltas es siempre "pegar 1 copia". Para acumular copias antes de pegar se usa Repetidas.

### Auto-tab "Todos"

Al activar cualquier filtro, automáticamente se va a "Todos los equipos". El selector de grupos se oculta. Razón: el filtro ya es una vista vertical sobre el álbum entero; meter una segunda dimensión (por equipo) aquí solo confunde.

### Vista global (sin filtro)

- Layout: tabla compacta — 1 fila por equipo con 20 círculos en 2 sub-filas (10 + 10).
- **Read-only.** Tap = no-op. El usuario no puede modificar `(p, s)` desde la vista global. Para modificar tiene que entrar a un filtro.
- Colores sólidos según `(p, s)`: rojo si faltante, azul si suelta única, verde si pegada limpia, ámbar si tiene extras.

---

## 7 · Casos de prueba (para tests unitarios)

### Predicados

```js
test('clasificar (0,0) → faltante', () => {
  expect(clasificar({ p: 0, s: 0 })).toEqual({
    faltante: true, suelta: false, pegada: false, repetida: false, repetidaColor: null,
  });
});

test('clasificar (0,1) → suelta + repetida (azul)', () => {
  expect(clasificar({ p: 0, s: 1 })).toEqual({
    faltante: false, suelta: true, pegada: false, repetida: true, repetidaColor: 'azul',
  });
});

test('clasificar (0,3) → suelta + repetida (ámbar)', () => {
  expect(clasificar({ p: 0, s: 3 })).toEqual({
    faltante: false, suelta: true, pegada: false, repetida: true, repetidaColor: 'ambar',
  });
});

test('clasificar (1,0) → pegada limpia', () => {
  expect(clasificar({ p: 1, s: 0 })).toEqual({
    faltante: false, suelta: false, pegada: true, repetida: false, repetidaColor: null,
  });
});

test('clasificar (1,1) → pegada + repetida (azul)', () => {
  expect(clasificar({ p: 1, s: 1 })).toEqual({
    faltante: false, suelta: false, pegada: true, repetida: true, repetidaColor: 'azul',
  });
});

test('clasificar (1,4) → pegada + repetida (ámbar)', () => {
  expect(clasificar({ p: 1, s: 4 })).toEqual({
    faltante: false, suelta: false, pegada: true, repetida: true, repetidaColor: 'ambar',
  });
});
```

### Operaciones

```js
test('flujo natural completo: faltante → suelta → pegada → repetida', () => {
  let l = { p: 0, s: 0 };
  l = aplicarGesto(l, 'faltantes', 'plus');  expect(l).toEqual({ p: 0, s: 1 });
  l = aplicarGesto(l, 'sueltas',   'plus');  expect(l).toEqual({ p: 1, s: 0 });
  l = aplicarGesto(l, 'repetidas', 'plus');  expect(l).toEqual({ p: 1, s: 1 });
  l = aplicarGesto(l, 'repetidas', 'plus');  expect(l).toEqual({ p: 1, s: 2 });
});

test('acumular sueltas y luego pegar conserva extras', () => {
  let l = { p: 0, s: 0 };
  l = aplicarGesto(l, 'faltantes', 'plus');  expect(l).toEqual({ p: 0, s: 1 });
  l = aplicarGesto(l, 'repetidas', 'plus');  expect(l).toEqual({ p: 0, s: 2 });
  l = aplicarGesto(l, 'repetidas', 'plus');  expect(l).toEqual({ p: 0, s: 3 });
  // Ahora tengo 3 sueltas. Pego una desde Sueltas.
  l = aplicarGesto(l, 'sueltas',   'plus');  expect(l).toEqual({ p: 1, s: 2 });
  // Quedan 2 monas extras como Repetida ámbar.
});

test('descartar mona desde sueltas con s>=2', () => {
  let l = { p: 0, s: 3 };
  l = aplicarGesto(l, 'sueltas', 'minus');
  expect(l).toEqual({ p: 0, s: 2 });
});

test('descartar última mona vuelve a faltante', () => {
  let l = { p: 0, s: 1 };
  l = aplicarGesto(l, 'sueltas', 'minus');
  expect(l).toEqual({ p: 0, s: 0 });
});

test('restar copia desde repetidas reduce s sin tocar p', () => {
  let l = { p: 1, s: 3 };
  l = aplicarGesto(l, 'repetidas', 'minus');
  expect(l).toEqual({ p: 1, s: 2 });
});

test('precondición violada lanza error', () => {
  expect(() => aplicarGesto({ p: 1, s: 0 }, 'faltantes', 'plus')).toThrow();
  expect(() => aplicarGesto({ p: 0, s: 0 }, 'repetidas', 'minus')).toThrow();
  expect(() => aplicarGesto({ p: 0, s: 0 }, 'sueltas', 'plus')).toThrow();
  expect(() => aplicarGesto({ p: 1, s: 1 }, 'sueltas', 'plus')).toThrow();
});
```

### Contadores

```js
test('contadores con álbum mixto', () => {
  const laminas = [
    { id: 1, p: 0, s: 0 },  // faltante
    { id: 2, p: 0, s: 0 },  // faltante
    { id: 3, p: 0, s: 1 },  // suelta + repetida azul
    { id: 4, p: 1, s: 0 },  // pegada limpia
    { id: 5, p: 1, s: 3 },  // pegada + repetida ámbar (2 monas de sobra)
    { id: 6, p: 0, s: 2 },  // suelta + repetida ámbar (1 mona de sobra)
  ];
  expect(contadores(laminas)).toEqual({
    pegadas:        2,   // ids 4 y 5
    sueltas:        2,   // ids 3 y 6 (ambos p=0 con s>=1)
    sueltasCopias:  3,   // 1 + 2
    faltantes:      2,   // ids 1 y 2
    // Σ máx(p + s − 1, 0): 0+0+0+0+3+1 = 4
    //   id 5 (1,3) → máx(3, 0) = 3 (todas las en mano son sobras porque ya está pegada)
    //   id 6 (0,2) → máx(1, 0) = 1
    repetidas:      4,
    total:          6,
  });
});
```

---

## 8 · Anti-patrones (lo que NO se debe hacer)

> Esta sección lista los enredos que el modelo actual probablemente tiene y que el refactor debe eliminar.

### ❌ Razonar la lógica de negocio en términos de filtros

Mal: `if (lamina.estado === 'suelta') { ... }`
Bien: `if (lamina.p === 0 && lamina.s >= 1) { ... }`, o mejor, usar el predicado `enSueltas(lamina)`.

**Por qué:** los filtros son derivados. El estado es `(p, s)`. Si la lógica razona sobre filtros, terminamos con bugs como "una lámina con `s=3` no aparece en Repetidas porque alguien escribió la condición mal en algún sitio".

### ❌ Tener un campo `estado` o `categoria` guardado en la base de datos

La fuente de verdad son `p` y `s`. El "estado/categoría/filtro" se calcula on-the-fly. Si se guarda, eventualmente queda desincronizado con `(p, s)` y aparecen láminas en filtros donde no deberían estar.

### ❌ Que el botón `+` haga cosas distintas en filtros distintos sin que el modelo lo refleje

El botón `+` SÍ hace cosas distintas según el filtro origen, pero esa diferencia debe estar **explicitada en `aplicarGesto`** y testeada. No debe estar repartida en handlers de UI con condicionales ad-hoc.

### ❌ Long-press, menús contextuales, o gestos ocultos

El modelo nuevo no tiene acciones secundarias. Toda operación es un botón visible. Si Claude Code se siente tentado a meter un menú "para no llenar la pantalla de botones", lo correcto es revisar si el modelo permite esa operación — si no, no se mete.

### ❌ "Despegar" como operación permanente

Solo existe undo de último tap (toast con timeout). No hay opción de menú "despegar" ni botón persistente en Pegadas.

### ❌ Mezclar contadores

El número grande de Repetidas es `Σ máx(p + s − 1, 0)`. NO es `count(s >= 1)`, NI `count(s >= 2)`, NI `Σ s`, NI `Σ máx(s − 1, 0)`. Cada uno cuenta una historia distinta y solo el primero responde a "cuántas piezas físicas tengo de sobra".

---

## 9 · Orden recomendado para el refactor

1. **Crear módulo `src/modelo.js`** con: `clasificar`, `aplicarGesto`, `contadores`, predicados puros. Sin dependencias de UI ni de framework.
2. **Crear `src/modelo.test.js`** con todos los tests de la sección 7. Hacer que pasen al 100% antes de tocar UI.
3. **Refactorizar las tarjetas de homepage** para usar `contadores()`.
4. **Refactorizar la vista de cada filtro** para usar `clasificar()` y decidir color/badge.
5. **Refactorizar los handlers de botones** para llamar a `aplicarGesto()`. El handler debe:
   - Optimistic update: aplicar el cambio en el estado local inmediatamente.
   - Mostrar toast con "Deshacer".
   - Persistir al backend.
6. **Eliminar todo el código viejo** que razone sobre "estado nombrado" o que tenga long-press, menús, opciones "despegar", etc.

---

## 10 · Resumen ultra-corto (para tener en mente)

- Estado real: **`(p, s)`**. Todo lo demás es derivado.
- Filtros: **Faltantes** `(0,0)`, **Sueltas** `p=0 ∧ s≥1`, **Pegadas** `p=1`, **Repetidas** `s≥1`.
- En Sueltas y Repetidas: azul si `s=1`, ámbar si `s≥2`. Badge `+(s−1)` solo si ámbar.
- **Sueltas es el único camino al álbum.** Tap `+` en Sueltas = pegar 1 copia. Para acumular extras antes de pegar se usa Repetidas.
- Operaciones: solo `+` y `−` por filtro. Sin long-press. Sin despegar.
- Contador de Repetidas: **monas físicas de sobra** = `Σ máx(p + s − 1, 0)`.
- Pegar es irreversible. El único "deshacer" es el toast del último tap.
