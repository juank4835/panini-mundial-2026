# CLAUDE.md — Runbook para agentes LLM

Este archivo es la **fuente única de verdad** para cualquier agente (Claude, GPT, etc.) que el dueño (Juan Camilo) invoque para operar sobre este repo.

Si el usuario te dice algo como:
- "Llegó el Mundial 2030, deploy una nueva instancia"
- "Migrá la app al nuevo Mundial"
- "Hay un bug, arreglalo y deploya"
- "Hacé backup del estado"

Este documento contiene **todo lo que necesitás** para ejecutar la tarea sin tener que adivinar.

---

## Contexto del proyecto en 1 minuto

App personal de Juan Camilo (Bogotá) para trackear el álbum Panini de cada Copa Mundial. Stack: HTML/JS monolítico + Google Apps Script backend + GitHub Pages para vista pública. Se instala como PWA en iPhone. La app maneja: pegadas/sueltas/repetidas, intercambios bilaterales con vecinos, ventas con descuentos por volumen, ofertas personalizadas vía link compartido, finanzas (precios, especiales, movimientos).

Diseñado para reusarse cada 4 años (nuevo Mundial = nuevo catálogo de equipos). El motor (Cruzar, Finanzas, etc.) NO cambia entre Mundiales.

---

## Identificadores críticos — NO INVENTAR NI CAMBIAR

| Recurso | Valor |
|---|---|
| **Production deployment URL** (Apps Script Web App) | `AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg` |
| **scriptId** (Apps Script project) | leer de `apps-script-deploy/.clasp.json` |
| **GitHub repo** | `https://github.com/juank4835/panini-mundial-2026` |
| **GitHub Pages public URL** | `https://juank4835.github.io/panini-mundial-2026/cambios/` |
| **Sandbox instance** (staging, opcional) | `AKfycbxO6ce9vpKOiFwRXCw9Th_R7O1PmBAKHJtCVZGKy3_IIAvaCQ_ZQgzMBSsiasd8g18` |

**REGLA DE ORO:** la URL de producción está pinned a la PWA instalada en el iPhone del usuario y a QRs/links impresos circulando. **NUNCA crear deployments nuevos con `clasp deploy` (genera URL nueva). SIEMPRE usar `clasp redeploy -V N -d "..." <DEPLOYMENT_URL>`** para actualizar la URL existente.

**PRODUCCIÓN TIENE DATOS VIVOS — proteger.**

Producción es donde el usuario registra sus pegadas reales, ventas reales, plata real. **No tocar producción durante simulaciones, pruebas o exploraciones.** Default a sandbox SIEMPRE a menos que el usuario diga explícitamente "deploy a producción" o "migrar producción". Si tenés duda, preguntá.

Las únicas tareas que justifican tocar producción son:
- Bugfix urgente (con la palabra "deploy", "bug", "arreglar" del usuario)
- Migración real entre Mundiales (con confirmación explícita del usuario)
- Sincronización docs/strings menores (texto sin riesgo de datos)

Si el usuario te pide "simular X" o "probar Y" o "ver cómo se vería Z" → **es trabajo de sandbox**, no de producción.

---

## Tareas que el usuario te puede pedir

### Tarea 1: Migrar a un nuevo Mundial (ej. 2030, 2034)

**Trigger frases:** "salió el Mundial X", "migrar al nuevo Mundial", "deploy nueva edición"

**Antes de empezar, pedile al usuario los siguientes datos.**

**UX CRÍTICO — Una pregunta a la vez.** No tires todas las preguntas en un solo mensaje, el usuario se abruma. Esperá la respuesta de cada pregunta antes de pasar a la siguiente. Ack brevemente cada respuesta antes de pedir la próxima. Orden óptimo:

**Q1: ¿Qué Mundial y dónde se juega?**
- Año (2030, 2034, etc.) y país(es) host.
- Útil para el contexto general y para anticipar qué emblemas van en "intro" (cada host suele tener su emblema en las primeras láminas).

**Q2: ¿Migrás producción o creás sandbox?**
- **Producción** = borrar el Mundial pasado y arrancar el nuevo con el MISMO URL. La PWA del usuario se actualiza automáticamente. Irreversible sin restore manual.
- **Sandbox** = deployar a la instancia sandbox (`AKfycbxO...sd8g18`), paralela a producción. El Mundial activo queda intacto en producción. Útil si el usuario quiere probar primero o si todavía está activo el Mundial anterior.

**Q3: ¿Cuántos stickers por equipo?**
- En Mundial 2026 son 20 (1 escudo + 1 equipo grupal + 18 jugadores). Si Panini cambió a 22 u otro número, ajustar `CATALOGO.stickersPorEquipo`.

**Q4: Equipos clasificados.**
- 48 equipos. Pasame: código FIFA 3 letras + nombre + grupo (A-L). Aceptá formato libre, vos lo estructuras.
- Si son muchos, podés pedir por grupos (4 equipos por vez). Mejor que pedir los 48 de golpe.

**Q5: Secciones "intro" del álbum.**
- Típicamente 9 láminas: "00" portada + FWC1-8 (logo Mundial sup/inf, mascotas, slogan, balón, emblemas de los hosts).
- Pedile que mire el álbum físico y dicte qué dice cada FWC.

**Q6: Secciones "history" del álbum.**
- Típicamente 11 láminas: FWC9-19 con Mundiales anteriores ganadores.
- En 2026 son: Italia 1934, Uruguay 1950, Alemania 1954, Brasil 1962, Alemania 1974, Argentina 1986, Brasil 1994, Brasil 2002, Italia 2006, Alemania 2014, Argentina 2022. Para 2030, probablemente reemplacen el más viejo por el del 2026.

**Confirmación final antes de ejecutar:** una vez tengás todos los datos, mostrá al usuario un resumen del catálogo armado y pedile confirmación antes de empezar las fases destructivas (especialmente Fase 6, reset). El usuario debe estar consciente de que `resetParaProximoMundial()` borra MUCHA data del backend.

**Steps de ejecución (en orden):**

```bash
# Fase 1: Backup del Mundial anterior (NUNCA SALTAR ESTO)
mkdir -p backups
curl -sL "https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec?action=publica" \
  > backups/mundial-anterior-final-$(date +%Y%m%d).json
# Verificar el backup es válido
node -e "const d=require('./backups/mundial-anterior-final-$(date +%Y%m%d).json'); console.log(d.ok === true ? 'OK' : 'FAIL');"

# Fase 2: Editar catalogo.json con los datos nuevos
# (Usa la herramienta de Edit/Write para reemplazar el contenido)

# Fase 3: Sincronizar catálogo a los HTMLs
npm run sync-catalog
# Esto reemplaza los bloques CATALOGO en apps-script-deploy/index.html y cambios/index.html

# Fase 4: Strings estáticos (HTML <title>, manifest.json, meta tags)
# Buscar y reemplazar "Mundial 2026" → "Mundial 2030" (o el año correspondiente)
# Archivos a tocar:
#   - apps-script-deploy/index.html (<title>, meta apple-mobile-web-app-title, meta description)
#   - cambios/index.html (<title>, meta description)
#   - index.html (raíz, landing)
#   - manifest.json (name, short_name, description)
# Adicionalmente: STORAGE_KEY rotation
#   - En apps-script-deploy/index.html, buscar 'panini_mundial_2026_v5' y rotar a
#     'panini_mundial_NEW_YEAR_v1'. Esto fuerza limpieza de localStorage en
#     PWAs cacheadas existentes. CRÍTICO para evitar mix de datos viejos+nuevos.

# Fase 5: Deploy del código
cd apps-script-deploy
clasp push -f
clasp version "vN Migración a Mundial NEW_YEAR"
# N debe ser la siguiente versión disponible. Verificar con `clasp versions` antes.
clasp redeploy -V N -d "vN Mundial NEW_YEAR" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg

# Fase 6: Reset del backend (NUCLEAR — confirmar con usuario antes)
# Esto se hace MANUALMENTE en https://script.google.com:
#   1. Usuario abre el proyecto Apps Script
#   2. Selecciona la función `resetParaProximoMundial` en el dropdown
#   3. Click "Ejecutar"
# Tu rol: instruir al usuario paso a paso, NO podés ejecutarla vos.

# Fase 7: Commit + push
cd ..
git add -A
git commit -m "Migración completa a Mundial NEW_YEAR"
git push

# Fase 8: Deploy a sandbox (opcional, si el usuario lo pidió)
# Si el usuario pidió SANDBOX en vez de migrar prod, en lugar de Fase 5 deployás a:
# AKfycbxO6ce9vpKOiFwRXCw9Th_R7O1PmBAKHJtCVZGKy3_IIAvaCQ_ZQgzMBSsiasd8g18
# Y no ejecutás Fase 6 (reset) en producción — solo en el sandbox.
```

**NO TOCAR durante migración:**
- `doggos.jpg` (fixture permanente del proyecto, ver README)
- `apps-script-deploy/.clasp.json` (scriptId del Apps Script)
- La URL del deployment de producción (`H-6eg`)

**Verificación post-deploy:**

1. Refrescar la PWA en el iPhone (cerrar app switcher + reabrir)
2. Verificar header dice "Álbum Panini Mundial NEW_YEAR"
3. Verificar los 48 equipos nuevos están en sus grupos correctos
4. Probar registrar una pegada
5. Probar el flujo de Cruzar (debe mostrar los equipos nuevos)
6. Probar la página pública `/cambios/` (debe mostrar el catálogo nuevo)

### Tarea 2: Deployar un bugfix o feature

**Trigger frases:** "deploy esto", "subí el cambio", "hay un bug en X"

```bash
# Después de hacer los edits con Edit/Write tool:
cd apps-script-deploy
clasp push -f
clasp version "vN descripción breve"
clasp redeploy -V N -d "vN descripción" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
cd ..
git add -A
git commit -m "vN descripción"
git push
```

**Para sandbox (staging)**, si el usuario pidió probar primero ahí:

```bash
cd /Users/juank4835/Documents/panini-sandbox-2026/apps-script-deploy
# Copiar código de producción reemplazando URLs
sed 's|panini-mundial-2026|panini-sandbox-2026|g' /Users/juank4835/Documents/panini-mundial-2026/apps-script-deploy/index.html > index.html
cp /Users/juank4835/Documents/panini-mundial-2026/apps-script-deploy/Code.js Code.js
clasp push -f
clasp version "vN sync con prod"
clasp redeploy -V N -d "vN" AKfycbxO6ce9vpKOiFwRXCw9Th_R7O1PmBAKHJtCVZGKy3_IIAvaCQ_ZQgzMBSsiasd8g18
```

### Tarea 3: Backup manual

```bash
mkdir -p backups
curl -sL "https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec?action=publica" \
  > backups/manual-$(date +%Y%m%d-%H%M).json
git add backups/ && git commit -m "Backup manual" && git push
```

### Tarea 4: Rollback de un deploy que rompió algo

```bash
# Listar versiones para encontrar la última buena
cd apps-script-deploy
clasp versions

# Redeploy a la versión anterior (N_OK = versión que sabés que funciona)
clasp redeploy -V N_OK -d "rollback a vN_OK" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
```

---

## Convenciones del proyecto

- **Español rolo (colombiano)** en todo: comentarios, mensajes de commit, UI, conversación con el usuario. Usar "tú/puedes/tienes/pega", nunca voseo argentino "vos/podés/tenés/pegá".
- **NO emojis** en código, UI, mockups, mensajes de commit ni respuestas. Solo símbolos simples (→ ← ✓ ✗ · ×). Exceptions: los emojis 🎴 🔴 ya existentes en share/copy headers — no agregar nuevos pero no removerlos sin que el usuario lo pida.
- **Convención de colores**: ámbar=repetidas, azul=sueltas, rojo=faltantes. Verde solo para finanzas (ganancias, sales). NO usar verde para "le doy" en intercambios.
- **Commits**: terminan con `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` cuando los hace un agente Claude.
- **Versionado**: cada deploy incrementa el número (v218, v219, ...). Conservar bajo de 200 versiones por proyecto (límite de Apps Script). Si llegás al límite, el usuario debe borrar versiones viejas desde script.google.com manualmente.
- **No tocar la app sin confirmación**: cambios riesgosos (reset, migración, refactor) requieren confirmación explícita del usuario antes de ejecutar.

---

## Archivos clave (en orden de importancia)

1. `catalogo.json` — datos del Mundial activo. Source of truth del catálogo.
2. `apps-script-deploy/index.html` — la app principal (privada, requiere login).
3. `apps-script-deploy/Code.js` — backend Apps Script (storage en PropertiesService).
4. `cambios/index.html` — página pública (GitHub Pages, vista read-only para vecinos + ofertas).
5. `docs/NUEVO-MUNDIAL.md` — guía detallada de migración (alternativa más larga a este archivo).
6. `docs/RUNBOOK.md` — procedimientos operativos detallados.
7. `scripts/sync-catalog.js` — herramienta que sincroniza catalogo.json → bloques CATALOGO en los HTMLs.
8. `.github/workflows/backup-weekly.yml` — backup automático semanal vía GitHub Actions.

---

## Anti-patterns (cosas NO hacer)

- ❌ **`clasp deploy` sin `redeploy`**: crea URL nueva, PWA del usuario queda huérfana. SIEMPRE `redeploy -V N <DEPLOYMENT_URL>`.
- ❌ **Renombrar el repo** `panini-mundial-2026`: rompe la URL de GitHub Pages, QRs impresos, links de ofertas activas. Aunque cambien Mundiales, el nombre del repo se mantiene.
- ❌ **Borrar `doggos.jpg`**: marca permanente del proyecto. Si por error se pierde, recuperar con `git show HEAD~N:doggos.jpg > doggos.jpg`.
- ❌ **Ejecutar `resetAll()` cuando el usuario quería migrar al próximo Mundial**: `resetAll` conserva precios/especiales. Para migración completa usar `resetParaProximoMundial()`.
- ❌ **Reset sin backup previo**: nunca ejecutar `resetParaProximoMundial()` sin antes haber hecho el snapshot completo.
- ❌ **Asumir que el agente puede ejecutar funciones en script.google.com**: el editor de Apps Script no es accesible programáticamente. Para ejecutar `resetParaProximoMundial()` el usuario debe abrir https://script.google.com manualmente y darle "Ejecutar".

---

## Glosario rápido

- **Pegada**: lámina pegada en el álbum (p=1)
- **Suelta**: lámina en mano sin pegar (s>=1, p=0)
- **Repetida**: lámina con más de 1 copia (p+s>=2). Las copias excedentes son tradeables.
- **Faltante**: lámina que no tengo (p=0, s=0)
- **Especiales**: stickers que no son "jugador común" — escudos (#1), equipos (#13), FWC, estrellas, 00 portada
- **Oferta**: link compartible con un set de IDs específicos para vender a un vecino. Vive 30 días en el backend.
- **Cruzar**: flujo bilateral de intercambio (yo doy X, recibo Y, opcional money excedente)
- **PWA**: Progressive Web App — la app instalada en home screen del iPhone via Safari "Añadir a pantalla de inicio"

---

## Si algo no está acá

Revisar en orden:
1. `README.md` — overview del proyecto
2. `docs/RUNBOOK.md` — procedimientos operativos detallados
3. `docs/NUEVO-MUNDIAL.md` — guía de migración detallada
4. `docs/MODELO.md` — modelo de datos
5. El código mismo (apps-script-deploy/index.html, Code.js)

Si después de revisar todo esto sigue sin claridad, **preguntar al usuario** en lugar de adivinar.
