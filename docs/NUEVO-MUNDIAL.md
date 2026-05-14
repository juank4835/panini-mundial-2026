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

## Fase 3 — Actualizar código que aún tiene datos hardcodeados (1-2 horas)

> En la versión actual (mayo 2026), el catálogo todavía está hardcodeado en `apps-script-deploy/index.html` y `cambios/index.html`. La idea es refactorizar para leer de `catalogo.json` antes de 2030, pero si no se hizo, hay que actualizar manualmente:

**En `apps-script-deploy/index.html`:**
- Buscar `const ordenInicial = [` y reemplazar con los 48 nuevos equipos
- Buscar `const introStickers = [` y actualizar las FWC1-N
- Buscar `const historyStickers = [` y actualizar
- Si cambia la cantidad de stickers por equipo, buscar `for (let i = 1; i <= 20; i++)` y otros usos del `20`

**En `cambios/index.html`:**
- Buscar `equiposDefault = [` y replicar los 48 equipos
- Buscar `introStickers` y `historyStickers` igual

**En `apps-script-deploy/Code.js`:**
- Probablemente no haya nada que cambiar (el backend es agnóstico al catálogo)

---

## Fase 4 — Reset del estado del backend (10 min)

El estado del Mundial pasado está en `PropertiesService` de Apps Script. Hay que limpiarlo:

```bash
# En Apps Script editor (script.google.com), ejecutar manualmente:
function resetParaProximoMundial() {
  const props = PropertiesService.getScriptProperties();
  const allKeys = props.getKeys();
  allKeys.forEach(k => {
    if (k.startsWith('STATE_') || k === '__finanzas' || k === '__version' ||
        k === '__finVersion' || k === '__orden' || k.startsWith('OFERTA_')) {
      props.deleteProperty(k);
    }
  });
  Logger.log('Reset completo: ' + allKeys.length + ' keys borradas.');
}
```

Después en la app, hacer Reset desde Finanzas → ⋮ → Reset.

---

## Fase 5 — Branding update (opcional, 30 min)

Si querés actualizar visuales:

- `icon-180.png`, `icon-192.png`, `icon-512.png` — portada del nuevo álbum
- `doggos.jpg` — opcional, foto random del avatar
- `manifest.json` — actualizar `"name"` y `"short_name"`
- En `apps-script-deploy/index.html` y `cambios/index.html`: buscar "Mundial 2026" y reemplazar por "Mundial 2030"
- En `apps-script-deploy/index.html`: actualizar `STORAGE_KEY = 'panini_mundial_2026_v5'` a `'panini_mundial_2030_v1'` para limpiar localStorage automáticamente en clientes existentes

**Sobre la URL/repo:**
- Mantener el repo en `panini-mundial-2026` aunque ahora sirva al 2030 (renombrar romperia QRs, links, PWAs ya instalados)
- O renombrar a `panini-tracker` con redirect (más limpio, pero requiere migración cuidadosa)
- Decisión depende del nivel de molestia del nombre vs costo de migración

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
