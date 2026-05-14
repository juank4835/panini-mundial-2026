// Tests del modelo. Sección 7 de docs/MODELO.md.
// Para correr: `npm install -D vitest` y luego `npx vitest run src/modelo.test.js`.

import { test, expect } from 'vitest';
import { clasificar, aplicarGesto, contadores } from './modelo.js';

// ──────────────────────────────────────────────────────────────────────────
// Predicados
// ──────────────────────────────────────────────────────────────────────────

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

test('clasificar (1,1) → pegada + repetida (ámbar)', () => {
  // (1,1) tiene 1 sobra física (máx(1+1-1, 0) = 1) → ámbar, no azul.
  expect(clasificar({ p: 1, s: 1 })).toEqual({
    faltante: false, suelta: false, pegada: true, repetida: true, repetidaColor: 'ambar',
  });
});

test('clasificar (1,4) → pegada + repetida (ámbar)', () => {
  expect(clasificar({ p: 1, s: 4 })).toEqual({
    faltante: false, suelta: false, pegada: true, repetida: true, repetidaColor: 'ambar',
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Operaciones
// ──────────────────────────────────────────────────────────────────────────

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
  expect(() => aplicarGesto({ p: 0, s: 0 }, 'pegadas', 'plus')).toThrow();
});

test('pegadas/plus añade mona en mano a una pegada', () => {
  // Caso: pegué la 00 (1,0). Abro otro sobre y vuelve a salir 00.
  // Tap+ en filtro Pegadas la lleva a (1,1) — primera mona de sobra.
  let l = { p: 1, s: 0 };
  l = aplicarGesto(l, 'pegadas', 'plus');  expect(l).toEqual({ p: 1, s: 1 });
  l = aplicarGesto(l, 'pegadas', 'plus');  expect(l).toEqual({ p: 1, s: 2 });
});

// ──────────────────────────────────────────────────────────────────────────
// Contadores
// ──────────────────────────────────────────────────────────────────────────

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
