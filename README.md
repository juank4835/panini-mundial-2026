# Panini Tracker

App personal para trackear el álbum Panini de la Copa Mundial. Diseñada para reutilizarse en cada edición (2026, 2030, 2034…) cambiando solo el catálogo de equipos.

> ### Si llegaste porque salió un Mundial nuevo
>
> - **Humano**: leé `docs/NUEVO-MUNDIAL.md` para la guía paso a paso.
> - **Agente LLM (Claude, GPT, etc.)**: leé `CLAUDE.md` — tiene la receta completa con IDs, comandos y qué pedirle al usuario.

## Qué hace

Maneja todo el ciclo del coleccionista: pegadas, repetidas, faltantes, cambios bilaterales con vecinos, ventas con descuentos por volumen, ofertas personalizadas por link compartido, finanzas detalladas (precios, especiales, movimientos).

Stack: HTML/JS/CSS puro + Google Apps Script como backend + GitHub Pages para la vista pública. Sin frameworks. Single-file index.html. PWA instalable en iPhone.

## Estructura del repo

```
panini-mundial-2026/
│
├── catalogo.json                 ← CATÁLOGO DEL MUNDIAL ACTIVO
│                                    Editar acá cuando salga el próximo Mundial.
│                                    Define equipos, grupos, especiales, totales.
│
├── apps-script-deploy/           ← LA APP (privada, requiere login)
│   ├── index.html                  HTML monolítico de la app (~18k líneas)
│   ├── Code.js                     Backend en Apps Script (Google Sheets storage)
│   ├── appsscript.json             Manifest del proyecto
│   └── .clasp.json                 Config local de clasp (scriptId)
│
├── cambios/                      ← PÁGINA PÚBLICA (GitHub Pages)
│   └── index.html                  Lo que ven los vecinos via QR/link.
│                                    Read-only del state del álbum + ofertas.
│
├── docs/                         ← DOCUMENTACIÓN
│   ├── MODELO.md                   Detalle del modelo de datos
│   ├── RUNBOOK.md                  Cómo deployar / debuggear / restore
│   └── NUEVO-MUNDIAL.md            Paso a paso para preparar la próxima edición
│
├── manifest.json                 ← PWA manifest (iconos, nombre, theme)
├── icon-*.png                    ← Iconos para el home screen
├── doggos.jpg                    ← Avatar del footer · FIXTURE PERMANENTE (no reemplazar)
├── index.html                    ← Landing pública (redirige al Apps Script URL)
│
└── mockup-*.html                 ← Prototipos de UI durante el desarrollo
                                     (referencia histórica, no en producción)
```

## URLs activas

- **App (privada)**: `https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec`
- **Vista pública**: `https://juank4835.github.io/panini-mundial-2026/cambios/`
- **Repo**: `https://github.com/juank4835/panini-mundial-2026`

> **Importante**: el deployment URL (`...H-6eg`) está pinned a la PWA instalada en el iPhone y aparece en QR/links que ya circularon. Nunca recrearlo — solo `clasp redeploy` al mismo `deploymentId`.

## Workflow de despliegue

Ver `docs/RUNBOOK.md`. Resumen:

```bash
cd apps-script-deploy
clasp push -f
clasp version "v218 descripción del cambio"
clasp redeploy -V 218 -d "v218 descripción" AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg
git add . && git commit -m "..." && git push
```

## Preparar el próximo Mundial (2030)

Ver `docs/NUEVO-MUNDIAL.md`. En resumen:

1. Editar `catalogo.json`: nuevo evento, año, equipos, grupos, especiales
2. Backup del estado actual del 2026 (export desde la app)
3. Reset de PropertiesService en Apps Script
4. Deploy con clasp
5. Actualizar copy/branding si aplica

Toma ~1 día cuando salga el catálogo oficial de Panini.

## Notas históricas

- **`panini-pacho-2026`** (repo archivado): era el ambiente de pruebas durante el desarrollo. Reemplazado por este repo como fuente única.
- **`legacy.html`**: versión anterior monolítica conservada por referencia.

## Convenciones

- Commits en español con co-author de Claude
- Sin emojis en código ni en mensajes
- Versionado via descripción de `clasp deploy` (v201, v202, …)
- Datos del catálogo y branding: español rolo (Colombia)
