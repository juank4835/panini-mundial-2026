# Despliegue en Google Apps Script

Esta carpeta contiene la versión del tracker para correr como Web App en
Google Apps Script. Sustituye al backend de GitHub Gist: cero tokens
expuestos, cero rate limits problemáticos.

## Pasos (~5 minutos, una sola vez)

### 1. Crear el proyecto

1. Abre https://script.google.com (sesión iniciada con tu cuenta de Google)
2. Click en **+ Nuevo proyecto** (arriba a la izquierda)
3. Renómbralo: arriba donde dice "Proyecto sin título" → escribe `Panini Mundial 2026`

### 2. Pegar el backend

1. En el panel izquierdo verás un archivo `Code.gs` (o `Código.gs`) ya creado
2. Borra TODO su contenido
3. Copia el contenido completo del archivo `Code.gs` de esta carpeta y pégalo
4. Guarda con **Ctrl+S** (o Cmd+S)

### 3. Crear el archivo HTML

1. En el panel izquierdo, junto a "Archivos", click en el **+** → **HTML**
2. Nómbralo exactamente: `index` (sin extensión, Apps Script le agrega `.html`)
3. Borra TODO su contenido (Apps Script crea un template por defecto)
4. Copia el contenido completo del archivo `index.html` de esta carpeta y pégalo
5. Guarda con **Ctrl+S**

### 4. Desplegar como Web App

1. Click en **Implementar** (arriba a la derecha) → **Nueva implementación**
2. Click en el ícono ⚙ junto a "Tipo de implementación" → selecciona **Aplicación web**
3. Configura:
   - **Descripción**: `v1` (o lo que quieras)
   - **Ejecutar como**: `Yo (tu@email.com)`
   - **Quién tiene acceso**: `Cualquier usuario` ← importante, así tu esposa puede entrar sin login
4. Click en **Implementar**
5. La primera vez te pedirá autorizar permisos:
   - "Autorizar acceso" → escoge tu cuenta
   - Aparecerá una pantalla "Google no ha verificado esta aplicación" — es normal porque es tuya
   - Click en **Configuración avanzada** → **Ir a Panini Mundial 2026 (no seguro)**
   - Da los permisos que pida (acceso a properties — para guardar el estado)

### 5. Copiar la URL del Web App

Al terminar te muestra una URL larga tipo:
`https://script.google.com/macros/s/AKfycbz.../exec`

Esa es la URL que vas a usar tú y tu esposa. Compártela y listo.

## Cómo actualizar el código después

Si modificas algo del código:

1. Cambia lo que necesites en `Code.gs` o `index.html` (en el editor de Apps Script)
2. **Implementar** → **Administrar implementaciones**
3. En tu implementación, click en el lápiz ✏ (editar)
4. **Versión** → selecciona **Nueva versión**
5. Click en **Implementar**

⚠️ **Importante**: la URL **NO cambia** si actualizas la versión de una implementación existente. Solo cambia si creas una **Nueva implementación** desde cero — eso evítalo, o tendrás que rerepartir el link.

## Quotas de Apps Script (free tier)

- **PropertiesService**: 50.000 lecturas + 50.000 escrituras por día por script
- **Tiempo de ejecución total**: 90 minutos/día (cada llamada dura ~50ms)
- **Llamadas a `google.script.run`**: sin límite documentado relevante

Para ti + esposa marcando láminas: **uso real estimado** = ~5.000 ops/día. **2% del límite.**

## Estructura de datos en el backend

El estado se guarda en `PropertiesService.getScriptProperties()` con estas keys:

- `client_<clientId>` → JSON del estado de cada navegador, ej: `{"ARG-5": 2, "COL-13": 1}`
- `__orden` → JSON del orden compartido de equipos
- `__version` → contador entero que se incrementa con cada cambio (para que los polls puedan saber si hubo cambios sin descargar todo)

Para ver lo guardado: en el editor de Apps Script ejecuta la función `debugDump()` (panel inferior).
Para borrar todo: `debugReset()` (¡destructivo!).

## Troubleshooting

**"google.script.run no disponible"** en consola del navegador → estás abriendo el `index.html` directamente desde tu disco, no por la URL del Web App. Solo funciona via la URL `/exec`.

**Login obligatorio para tu esposa** → revisa que en la implementación dejaste **Quién tiene acceso: Cualquier usuario**. Si pusiste "Cualquier usuario en TuEmpresa.com" requerirá Google Workspace.

**Cambios al código no se reflejan** → no creaste una nueva versión. Apps Script siempre sirve la última versión "publicada", no el código del editor. Pasos en sección "Cómo actualizar".
