/**
 * Backend del álbum Panini Mundial 2026 — Google Apps Script Web App.
 *
 * Modelo per-cliente: cada navegador escribe en su propia entrada
 * (key "client_<clientId>"). El total mostrado en el frontend es la
 * suma de todas las entradas client_*. Sin race conditions porque
 * cada cliente solo escribe lo suyo.
 *
 * Almacenamiento: PropertiesService (50k lecturas y 50k escrituras
 * por día por script — más que suficiente para 2-5 personas).
 */

const KEY_PREFIX = 'client_';
const ORDEN_KEY = '__orden';
const VERSION_KEY = '__version';

/** Sirve el HTML al hacer GET de la URL del Web App. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Álbum Panini Mundial 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Lee el estado completo. El frontend pasa la versión que tiene
 * actualmente; si el servidor no tiene cambios desde entonces,
 * devuelve { unchanged: true } y el frontend no re-renderiza.
 */
function pullState(sinceVersion) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const currentVersion = parseInt(all[VERSION_KEY] || '0', 10);

  if (sinceVersion != null && parseInt(sinceVersion, 10) >= currentVersion) {
    return { unchanged: true, version: currentVersion };
  }

  const clients = {};
  for (const key in all) {
    if (key.indexOf(KEY_PREFIX) === 0) {
      const cid = key.substring(KEY_PREFIX.length);
      try {
        clients[cid] = JSON.parse(all[key]);
      } catch (e) { /* ignorar entradas corruptas */ }
    }
  }

  let orden = null;
  if (all[ORDEN_KEY]) {
    try { orden = JSON.parse(all[ORDEN_KEY]); } catch (e) {}
  }

  return {
    unchanged: false,
    version: currentVersion,
    clients: clients,
    orden: orden
  };
}

/** Actualiza el archivo de un cliente (su contribución). */
function pushState(clientId, myState) {
  if (!clientId || typeof clientId !== 'string') {
    throw new Error('clientId requerido');
  }
  if (typeof myState !== 'object' || myState === null) {
    throw new Error('myState debe ser objeto');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(KEY_PREFIX + clientId, JSON.stringify(myState));
    const v = parseInt(props.getProperty(VERSION_KEY) || '0', 10) + 1;
    props.setProperty(VERSION_KEY, String(v));
    return { ok: true, version: v };
  } finally {
    lock.releaseLock();
  }
}

/** Actualiza el orden compartido de equipos (last-write-wins). */
function pushOrden(orden) {
  if (!Array.isArray(orden)) throw new Error('orden debe ser array');

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(ORDEN_KEY, JSON.stringify(orden));
    const v = parseInt(props.getProperty(VERSION_KEY) || '0', 10) + 1;
    props.setProperty(VERSION_KEY, String(v));
    return { ok: true, version: v };
  } finally {
    lock.releaseLock();
  }
}

/** Borra la contribución de un cliente. Solo el dueño debería llamarlo. */
function deleteClient(clientId) {
  if (!clientId) return { ok: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(KEY_PREFIX + clientId);
    const v = parseInt(props.getProperty(VERSION_KEY) || '0', 10) + 1;
    props.setProperty(VERSION_KEY, String(v));
    return { ok: true, version: v };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper de mantenimiento: ver desde el editor de Apps Script
 * todo lo que hay almacenado. No se llama desde el frontend.
 */
function debugDump() {
  const all = PropertiesService.getScriptProperties().getProperties();
  Logger.log(JSON.stringify(all, null, 2));
}

/** Helper de mantenimiento: borrar TODO el estado. Usar con cuidado. */
function debugReset() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('Reset completo');
}
