# RUNBOOK — Operación del Panini Tracker

Procedimientos operativos. Si algo se rompe o necesitás hacer un cambio rutinario, está acá.

---

## Deploy de un cambio al código

**Pre-requisitos:**
- `clasp` instalado y autenticado (`clasp login`)
- Estar en la carpeta `apps-script-deploy/`

**Pasos:**

```bash
cd apps-script-deploy

# 1. Subir el código al proyecto Apps Script
clasp push -f

# 2. Crear nueva versión inmutable
clasp version "vN descripción breve del cambio"

# 3. Apuntar el deployment de producción a esa nueva versión
clasp redeploy -V N -d "vN descripción" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
```

**Importante:** **NUNCA** usar `clasp deploy` (sin `redeploy`). Eso crea un deployment URL nuevo que tu PWA no conoce. Siempre `redeploy` al mismo `deploymentId` (`AKfycbxb6U...H-6eg`).

**Después:**
```bash
cd ..
git add apps-script-deploy/ cambios/ catalogo.json
git commit -m "vN descripción"
git push
```

GitHub Pages (carpeta `cambios/`) se actualiza solo después del push (1-2 min).

---

## Refrescar la app en el iPhone tras un deploy

iOS Safari/PWA cachea agresivamente. Para forzar refresco:

1. Cerrar la PWA del app switcher (swipe up)
2. Abrir Safari y navegar a la URL del deployment una vez
3. Volver a la PWA del home screen

O directamente desinstalar/reinstalar la PWA si los pasos anteriores no funcionan:
- Long-press el icono → Eliminar app → Eliminar de la pantalla
- Abrir Safari, ir a la URL → Compartir → Añadir a pantalla de inicio

---

## Restore de un cambio que rompió algo

Si un deploy rompió la app:

```bash
cd apps-script-deploy
# Apuntar el deployment a una versión anterior conocida-buena
clasp redeploy -V N_ANTERIOR -d "rollback a vN_ANTERIOR" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
```

Las versiones se acumulan en Apps Script — el último deploy bueno suele ser `N_actual - 1`.

**Cuidado:** Apps Script tiene un límite de 200 versiones por proyecto. Si llegás al límite, hay que borrar las viejas vía script.google.com → Historial de versiones.

---

## Sync entre producción y sandbox

Hay dos instancias:
- **Producción**: `panini-mundial-2026` (este repo). PWA del usuario apunta acá.
- **Sandbox / staging**: folder local `panini-sandbox-2026`. Apps Script independiente, instancia paralela para probar antes de deployar a producción.

Para sincronizar un cambio del prod al sandbox, ver `CLAUDE.md` sección "Tarea 2: Deployar un bugfix o feature" — bloque "Para sandbox (staging)".

---

## Debugging común

### "La app no carga, ve loading infinito"
- Abrir DevTools (Safari → Develop → iPhone → Apps Script URL)
- Revisar Console por errores
- Verificar que `gsRun()` no esté fallando (la JSONP al backend)

### "Vienen ofertas viejas / cache raro"
- En la PWA, hacer pull-to-refresh
- Si persiste, desinstalar y reinstalar la PWA

### "Compartí un link de oferta y el cliente dice que dice 'expirado'"
- Las ofertas tienen TTL de 30 días (en `Code.js` createOferta)
- Regenerá el link desde Cruzar → Compartir

### "Mis cambios en finanzas no quedan guardados al cerrar la app"
- iOS Safari evicta localStorage cuando matás la PWA
- Solución actual: descuentos/precios viajan al backend vía setFinDescuentos/setFinPrecios
- Si algo nuevo NO viaja al backend, hay que agregarlo (ver `_finPushPrecios` como patrón)

---

## Backup del estado completo

Para guardar un snapshot del estado (útil antes de cambios riesgosos o cierre de temporada):

```bash
curl -sL "https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec?action=publica" \
  > backups/snapshot-$(date +%Y%m%d-%H%M).json
```

Te trae todo el estado: pegadas/sueltas por lámina, precios, especiales, descuentos. **NO trae movimientos de finanzas** — esos requieren la app autenticada.

---

## URLs y IDs críticos

Guardar estos al alcance — son la base del setup:

```
Apps Script project ID:  (ver .clasp.json en apps-script-deploy/)
Production deployment:   AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
GitHub Pages URL:        https://juank4835.github.io/panini-mundial-2026/cambios/
GitHub repo:             https://github.com/juank4835/panini-mundial-2026
```

---

## Quien lee esto

Tú mismo del futuro. Cuando vuelvas en 2-3 meses sin recordar nada, este archivo te salva.
