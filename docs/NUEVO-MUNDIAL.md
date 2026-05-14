# Preparar la app para el próximo Mundial (ej: 2030)

Cuando Panini lance el álbum del próximo Mundial, este es el checklist para reutilizar esta app sin re-escribir nada.

> **Tiempo estimado:** 1 día completo cuando salga el catálogo oficial.

---

## Pre-requisitos

- Tener el catálogo oficial del nuevo Mundial publicado por Panini
- 1-2 horas seguidas sin interrupciones
- El álbum físico nuevo a la mano para verificar números/grupos

---

## Fase 1 — Backup del Mundial actual (30 min)

Antes de tocar nada, archivar lo del Mundial actual:

```bash
# 1. Descargar snapshot del estado completo
curl -sL "https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec?action=publica" \
  > backups/mundial-2026-final-$(date +%Y%m%d).json

# 2. En la app, hacer Export (Finanzas → ⋮ → Exportar JSON)
# Te baja un JSON con todos los movimientos de finanzas

# 3. Commitear los backups al repo
git add backups/
git commit -m "Backup final del Mundial 2026 antes de migrar a 2030"
git push
```

---

## Fase 2 — Actualizar el catálogo (1 hora)

Editar `catalogo.json` con los datos del nuevo Mundial:

```json
{
  "evento": "Mundial 2030",
  "year": 2030,
  "stickersPorEquipo": 20,        // o lo que diga Panini
  "totalEquipos": 48,             // o 32 si vuelven al formato anterior
  "secciones": {
    "intro": [/* nuevos FWC1-N intro */],
    "history": [/* historic FWCs */]
  },
  "equipos": [
    { "code": "ESP", "name": "España", "grupo": "A" },
    /* los 48 equipos clasificados */
  ]
}
```

**Cómo armar la lista de equipos:**
1. Copiar el orden EXACTO en que aparecen en el álbum físico (los grupos van A, B, C... según FIFA)
2. Códigos de 3 letras tipo FIFA (no inventar — usar los oficiales)
3. Verificar dos veces — un error acá te jode toda la app

---

## Fase 3 — Actualizar el catálogo en el código (15 min)

Desde el refactor de mayo 2026, el catálogo vive en un bloque `CATALOGO` claramente marcado al inicio del `<script>` de cada archivo. Para migrar:

**Opción A — Manual (recomendada si nunca usaste el script):**

En `apps-script-deploy/index.html`:
1. Buscar `const CATALOGO = {` (cerca del inicio del `<script>`)
2. Reemplazar el objeto completo con el del nuevo `catalogo.json`
3. Las variables `introStickers`, `historyStickers`, `ordenInicial` se derivan solas — no tocarlas.

En `cambios/index.html`: idéntico, mismo bloque `CATALOGO`. La única diferencia es que ahí se deriva `equiposDefault` en vez de `ordenInicial`.

**Opción B — Automática con script:**

```bash
./scripts/sync-catalog.sh
```

Esto lee `catalogo.json` y reemplaza los bloques `CATALOGO` en ambos HTMLs automáticamente. Después solo hacer commit + deploy.

### Rotación de `STORAGE_KEY` (importante)

En `apps-script-deploy/index.html` hay claves de localStorage versionadas:

```js
const STORAGE_KEY = 'panini_mundial_2026_v5';
const ORDER_KEY = 'panini_mundial_2026_v5_order';
const STORAGE_FIN_KEY = 'panini_mundial_2026_v5_finanzas';
```

**Cuando migrés a 2030, ROTAR estas claves** (cambiar `2026_v5` → `2030_v1`). ¿Por qué?
- localStorage en el iPhone no se limpia automáticamente al cambiar el código
- Si dejás las mismas keys, la PWA cargaría datos viejos del 2026 mezclados con la app del 2030
- Rotar la key hace que la app arranque fresh, como un install nuevo

Buscar `panini_mundial_2026_v5` en ambos archivos y reemplazar por `panini_mundial_2030_v1`.

### Sobre `stickersPorEquipo`

Desde el refactor, el valor `20` se lee de `CATALOGO.stickersPorEquipo` en los loops principales. Si Panini cambia a 22 por equipo, solo hay que actualizar `CATALOGO.stickersPorEquipo` en ambos archivos.

### En `apps-script-deploy/Code.js`

No hay nada que cambiar — el backend es agnóstico al catálogo. La función `resetParaProximoMundial()` ya está incluida (ver Fase 4).

---

## Fase 4 — Reset del estado del backend (5 min)

El estado del Mundial pasado está en `PropertiesService` de Apps Script. Hay que limpiarlo.

La función `resetParaProximoMundial()` ya está incluida en `Code.js`. Solo hay que ejecutarla:

1. Abrí https://script.google.com
2. Entrá al proyecto "Panini Mundial 2026" (mantiene el nombre histórico)
3. En el dropdown de funciones (arriba), seleccioná `resetParaProximoMundial`
4. Click "Ejecutar"
5. Confirmá los permisos si te los pide
6. Revisá el log de ejecución (View → Logs o Ejecuciones): debería decir "Reset para próximo Mundial — N keys borradas"

La función borra selectivamente:
- Estado del álbum (keys con prefix `STATE_`)
- Finanzas (`__finanzas`)
- Versiones de sync (`__version`, `__finVersion`)
- Orden de equipos (`__orden`)
- Ofertas activas (keys con prefix `OFERTA_`)

Otras keys que pudieran existir NO se tocan.

Después en la app, hacer Reset desde Finanzas → ⋮ → Reset (limpia localStorage).

---

## Fase 4.5 — Strings estáticos que requieren edición manual (10 min)

Algunos textos visibles NO se actualizan automáticamente desde CATALOGO porque son metadatos del HTML (los lee Safari antes que el JS corra). Hay que editarlos a mano:

**En `apps-script-deploy/index.html`:**
- `<title>` (línea ~6): `Álbum Panini Mundial 2026 · Tracker` → `Álbum Panini Mundial 2030 · Tracker`
- `<meta name="description">`: actualizar año
- `<meta name="apple-mobile-web-app-title" content="Panini 2026">` → `Panini 2030`
- `<meta name="apple-mobile-web-app-title" content="Panini 2030">` (el que ve el usuario al instalar PWA)

**En `cambios/index.html`:**
- `<title>`: `Álbum Panini Mundial 2026 · Cambios` → `Álbum Panini Mundial 2030 · Cambios`
- `<meta name="description">`: actualizar año

**En `manifest.json`:**
```json
{
  "name": "Álbum Panini Mundial 2030",
  "short_name": "Panini 2030",
  "description": "Tracker colaborativo del álbum Panini del Mundial 2030",
  ...
}
```

**En `index.html` (raíz, landing page):**
- Buscar y reemplazar todas las apariciones de "Mundial 2026" → "Mundial 2030"

Lo que SÍ se actualiza solo (vía JS leyendo CATALOGO):
- H1 visible en la app y en cambios
- Títulos de share (WhatsApp)
- Headers de mensajes de copy ("🎴 Álbum Panini ...")

## Fase 5 — Branding visual (opcional, 30 min)

Si querés actualizar visuales:

- `icon-180.png`, `icon-192.png`, `icon-512.png` — portada del nuevo álbum (usar una imagen oficial de Panini del 2030)
- `doggos.jpg` — opcional, foto random del avatar del footer

**Sobre la URL/repo:**
- Mantener el repo en `panini-mundial-2026` aunque ahora sirva al 2030 — renombrar rompería las URLs públicas, los QR impresos, los offer tokens vivos y las PWAs ya instaladas en celulares de clientes
- Alternativa: renombrar a `panini-tracker` con redirect, pero requiere migración cuidadosa de GitHub Pages y reinstalación de PWAs
- Decisión depende del nivel de molestia del nombre vs costo de migración. Default: mantener.

---

## Fase 6 — Deploy (15 min)

Una vez todo testeado localmente:

```bash
cd apps-script-deploy
clasp push -f
clasp version "v300 Migración a Mundial 2030"
clasp redeploy -V 300 -d "v300 Mundial 2030" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
cd ..
git add . && git commit -m "Migración completa a Mundial 2030" && git push
```

---

## Fase 7 — Testear (1 hora)

Antes de mostrarle la app a alguien:

- [ ] La app abre sin errores en consola
- [ ] Todos los grupos A-L se ven con sus 4 equipos
- [ ] La cantidad de stickers por equipo es la correcta
- [ ] Los FWC intro/history se ven correctamente
- [ ] Funciona registrar una compra (caja, sobre, álbum)
- [ ] Funciona marcar una lámina como pegada
- [ ] Funciona el flujo Cruzar bilateral
- [ ] Funciona generar una oferta y abrir el link público
- [ ] La página `/cambios/` muestra el inventario nuevo correctamente
- [ ] Los descuentos por volumen siguen aplicándose

---

## Staging (opcional, recomendado)

Si querés tener un ambiente de pruebas separado para experimentos futuros:

1. Crear nuevo proyecto en script.google.com → "Panini Mundial 2030 Staging"
2. `cd apps-script-deploy && clasp clone <scriptId>` en una carpeta paralela
3. Crear deployment inicial: `clasp deploy --description "staging v1"`
4. Guardar el deployment ID en `docs/RUNBOOK.md` para futuras referencias
5. Instalar como PWA aparte en el iPhone

Workflow de promoción: cambio en staging → testear → cuando estás conforme, `clasp redeploy` en producción al mismo `H-6eg`.

---

## Si algo se rompe a mitad de la migración

- Tener el backup `backups/mundial-2026-final-*.json` a mano
- Hacer rollback con `clasp redeploy -V N_ANTERIOR ...` (ver RUNBOOK)
- Restaurar el state vía `importState` y `importFinanzas` desde la consola de Apps Script

---

## Quien lee esto

Tú del futuro, panicando porque salió el catálogo nuevo y no recordás cómo funciona tu propia app. Respirá, seguí los pasos en orden, y tomá un café antes de la fase 3.
