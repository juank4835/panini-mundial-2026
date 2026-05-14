#!/usr/bin/env node
/*
 * migrate-mundial.js — orquestador de migración a un nuevo Mundial.
 *
 * Reemplaza el flujo manual de 6 fases (backup + edit catalogo + sync +
 * sed strings + clasp deploy + git) con un solo comando. Lo único que
 * QUEDA manual es ejecutar `resetParaProximoMundial()` en el editor de
 * Apps Script (Google no permite invocarla de afuera de forma segura) y
 * verificar la PWA en el iPhone.
 *
 * USO:
 *   node scripts/migrate-mundial.js --target sandbox --config ./mig-2030.json --dry-run
 *   node scripts/migrate-mundial.js --target sandbox --config ./mig-2030.json --apply
 *   node scripts/migrate-mundial.js --target production --config ./mig-2030.json --apply
 *
 *   npm run migrate-mundial -- --target sandbox --config ./mig-2030.json --dry-run
 *
 * INPUT JSON (ver scripts/migration-example.json):
 *   {
 *     "evento": "Mundial 2030",
 *     "year": 2030,
 *     "stickersPorEquipo": 20,
 *     "secciones": { "intro": [...], "history": [...] },
 *     "equipos": [{ "code": "COL", "name": "Colombia", "grupo": "A" }, ...]
 *   }
 *
 * QUÉ HACE EN ORDEN:
 *   1. Pre-flight validation (catalogo bien formado, clasp instalado, no
 *      hay cambios git uncommitted, target accesible).
 *   2. Backup del estado actual del target via JSONP `?action=publica`.
 *   3. Sobrescribe catalogo.json del target con el JSON de input.
 *   4. Corre sync-catalog para propagar a HTMLs del target.
 *   5. Reemplaza strings estáticos: "Mundial OLD" → "Mundial NEW" en
 *      title/manifest/meta. Rota STORAGE_KEY, ORDER_KEY, FIN_KEY,
 *      VIEW_MODE_KEY al año nuevo.
 *   6. clasp push + version + redeploy al deploymentId del target.
 *   7. git add + commit + push.
 *   8. Imprime resumen con pasos manuales pendientes.
 *
 * SAFETY:
 *   - --dry-run: muestra qué pasaría sin ejecutar nada destructivo.
 *   - Si target=production, requiere flag explícito --confirm-production
 *     ADEMÁS de --apply. Esto evita deploys accidentales a prod.
 *   - Backup automático antes de cualquier cambio. Si algún paso falla,
 *     el backup queda en backups/.
 *   - Si git working tree no está limpio, aborta (evita mezclar cambios).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// === Configuración de targets ===
//
// Cada target apunta a un folder local distinto + su deploymentId. El
// script de producción vive en el repo `panini-mundial-2026` y el de
// sandbox en `panini-sandbox-2026` (folder paralelo).
const TARGETS = {
  production: {
    root: path.resolve(__dirname, '..'),  // este mismo repo
    deploymentId: 'AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg',
    repoSlug: 'panini-mundial-2026'
  },
  sandbox: {
    root: '/Users/juank4835/Documents/panini-sandbox-2026',
    deploymentId: 'AKfycbxO6ce9vpKOiFwRXCw9Th_R7O1PmBAKHJtCVZGKy3_IIAvaCQ_ZQgzMBSsiasd8g18',
    repoSlug: 'panini-sandbox-2026'
  }
};

// === Args parsing ===
function parseArgs(argv) {
  const out = { target: null, config: null, apply: false, dryRun: false, confirmProduction: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--config') out.config = argv[++i];
    else if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--confirm-production') out.confirmProduction = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error('Arg desconocido: ' + a); process.exit(1); }
  }
  return out;
}

function printHelp() {
  console.log(`migrate-mundial.js — migración de Mundial

USO:
  node scripts/migrate-mundial.js --target <sandbox|production> --config <path.json> [--dry-run | --apply]

FLAGS:
  --target              sandbox | production  (requerido)
  --config              path al JSON de migración (requerido)
  --dry-run             imprime el plan sin ejecutar nada
  --apply               ejecuta la migración
  --confirm-production  requerido junto a --apply cuando target=production

EJEMPLOS:
  node scripts/migrate-mundial.js --target sandbox --config ./mig.json --dry-run
  node scripts/migrate-mundial.js --target sandbox --config ./mig.json --apply
  node scripts/migrate-mundial.js --target production --config ./mig.json --apply --confirm-production
`);
}

// === Helpers ===
function log(msg) { console.log('[migrate] ' + msg); }
function err(msg) { console.error('[migrate] ✗ ' + msg); }
function ok(msg)  { console.log('[migrate] ✓ ' + msg); }

function sh(cmd, opts = {}) {
  log('$ ' + cmd);
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
}

function gitWorkingTreeClean(root) {
  try {
    const out = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
    return out.trim() === '';
  } catch (e) {
    return false;
  }
}

// === Pre-flight validation ===
function validateConfig(cfg) {
  const errors = [];
  if (!cfg.evento || typeof cfg.evento !== 'string') errors.push('evento debe ser string');
  if (!Number.isInteger(cfg.year)) errors.push('year debe ser entero');
  if (!Number.isInteger(cfg.stickersPorEquipo)) errors.push('stickersPorEquipo debe ser entero');
  if (!Array.isArray(cfg.equipos) || cfg.equipos.length !== 48) {
    errors.push('equipos debe tener exactamente 48 entradas (encontradas: ' +
      (Array.isArray(cfg.equipos) ? cfg.equipos.length : 'N/A') + ')');
  } else {
    // Verificar grupos: 12 grupos A-L, 4 equipos cada uno.
    const gruposExpected = 'ABCDEFGHIJKL'.split('');
    const porGrupo = {};
    for (const e of cfg.equipos) {
      if (!e.code || !e.name || !e.grupo) {
        errors.push('equipo malformado: ' + JSON.stringify(e));
        continue;
      }
      porGrupo[e.grupo] = (porGrupo[e.grupo] || 0) + 1;
    }
    for (const g of gruposExpected) {
      if (porGrupo[g] !== 4) {
        errors.push('grupo ' + g + ' tiene ' + (porGrupo[g] || 0) + ' equipos (esperado: 4)');
      }
    }
    const gruposExtra = Object.keys(porGrupo).filter(g => !gruposExpected.includes(g));
    if (gruposExtra.length) errors.push('grupos inesperados: ' + gruposExtra.join(','));
  }
  if (!cfg.secciones || !Array.isArray(cfg.secciones.intro) || !Array.isArray(cfg.secciones.history)) {
    errors.push('secciones.intro y secciones.history deben ser arrays');
  }
  return errors;
}

// === Strings rotation ===
// Reemplaza "Mundial OLD_YEAR" → "Mundial NEW_YEAR" y rota STORAGE_KEYS
// en archivos del target.
function rotateStrings(targetRoot, oldYear, newYear) {
  const files = [
    path.join(targetRoot, 'apps-script-deploy', 'index.html'),
    path.join(targetRoot, 'cambios', 'index.html'),
    path.join(targetRoot, 'index.html'),
    path.join(targetRoot, 'manifest.json')
  ].filter(f => fs.existsSync(f));

  const replacements = [
    // Textos visibles
    [new RegExp(`Mundial ${oldYear}`, 'g'), `Mundial ${newYear}`],
    [new RegExp(`Panini ${oldYear}`, 'g'), `Panini ${newYear}`],
    // STORAGE_KEYS (incluye VIEW_MODE_KEY, ORDER_KEY, STORAGE_FIN_KEY que
    // todos comparten el prefijo `panini_mundial_YEAR_`)
    [new RegExp(`panini_mundial_${oldYear}_v\\d+`, 'g'), `panini_mundial_${newYear}_v1`],
    [new RegExp(`panini_mundial_${oldYear}_`, 'g'), `panini_mundial_${newYear}_`]
  ];

  const summary = [];
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8');
    let after = before;
    let count = 0;
    for (const [pat, rep] of replacements) {
      after = after.replace(pat, () => { count++; return rep; });
    }
    if (after !== before) {
      fs.writeFileSync(f, after, 'utf8');
      summary.push({ file: path.relative(targetRoot, f), changes: count });
    }
  }
  return summary;
}

// === Sync-catalog wrapper ===
// Corre el sync-catalog.js dentro del targetRoot. Lo invocamos como
// subprocess con cwd del target. El script existe en cada repo (lo
// copiamos al sandbox si hace falta).
function runSyncCatalog(targetRoot) {
  const syncPath = path.join(targetRoot, 'scripts', 'sync-catalog.js');
  if (!fs.existsSync(syncPath)) {
    // Sandbox puede no tener su propia copia — usamos la de producción.
    const prodSync = path.resolve(__dirname, 'sync-catalog.js');
    log('sandbox no tiene scripts/sync-catalog.js, ejecutando con paths del target');
    // Estrategia simple: copiar temporalmente y ejecutar con cwd=target.
    const targetScriptsDir = path.join(targetRoot, 'scripts');
    if (!fs.existsSync(targetScriptsDir)) fs.mkdirSync(targetScriptsDir, { recursive: true });
    fs.copyFileSync(prodSync, syncPath);
  }
  sh('node scripts/sync-catalog.js', { cwd: targetRoot });
}

// === Clasp deploy ===
function deployClasp(targetRoot, deploymentId, newYear) {
  const appDir = path.join(targetRoot, 'apps-script-deploy');
  sh('clasp push -f', { cwd: appDir });

  // Crear nueva versión. El nombre incluye el año + timestamp para que
  // sea único y descriptivo.
  const versionLabel = `Migración a Mundial ${newYear}`;
  const versionOut = sh(`clasp version "${versionLabel}"`, { cwd: appDir });
  // Parse: "Created version N"
  const m = versionOut.match(/Created version (\d+)/);
  if (!m) throw new Error('No se pudo parsear el número de versión del output de clasp:\n' + versionOut);
  const versionN = m[1];

  sh(`clasp redeploy -V ${versionN} -d "v${versionN} ${versionLabel}" ${deploymentId}`, { cwd: appDir });
  return versionN;
}

// === Backup ===
function doBackup(targetRoot, deploymentId, label) {
  const backupsDir = path.join(targetRoot, 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outFile = path.join(backupsDir, `pre-migration-${label}-${stamp}.json`);
  const url = `https://script.google.com/macros/s/${deploymentId}/exec?action=publica`;
  sh(`curl -sL "${url}" > "${outFile}"`);
  // Verificar que el backup es JSON válido
  const raw = fs.readFileSync(outFile, 'utf8');
  try { JSON.parse(raw); } catch (e) {
    throw new Error('Backup parece corrupto (no es JSON válido): ' + outFile);
  }
  return outFile;
}

// === Git commit + push ===
function gitCommitAndPush(targetRoot, newYear, versionN) {
  sh('git add -A', { cwd: targetRoot });
  // Verificar si hay cambios para commitear (si no, salir limpiamente)
  const status = sh('git status --porcelain', { cwd: targetRoot });
  if (!status.trim()) {
    log('git: no hay cambios para commitear');
    return null;
  }
  const msg = `v${versionN} Migración a Mundial ${newYear}\n\nMigración automatizada via scripts/migrate-mundial.js.\nCatalogo, strings, STORAGE_KEYs y deployment actualizados al Mundial ${newYear}.\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`;
  // Escribir el mensaje a archivo temporal para preservar formato.
  const msgFile = path.join(targetRoot, '.git', 'MIGRATE_COMMIT_MSG');
  fs.writeFileSync(msgFile, msg, 'utf8');
  try {
    sh('git commit -F "' + msgFile + '"', { cwd: targetRoot });
    sh('git push', { cwd: targetRoot });
  } finally {
    try { fs.unlinkSync(msgFile); } catch (e) {}
  }
  return msg.split('\n')[0];
}

// === Main ===
function main() {
  const args = parseArgs(process.argv);

  if (!args.target) { err('falta --target'); printHelp(); process.exit(1); }
  if (!args.config) { err('falta --config'); printHelp(); process.exit(1); }
  if (!args.apply && !args.dryRun) { err('falta --apply o --dry-run'); printHelp(); process.exit(1); }
  if (args.apply && args.dryRun) { err('no podés pasar --apply y --dry-run a la vez'); process.exit(1); }

  const target = TARGETS[args.target];
  if (!target) { err('target inválido: ' + args.target + ' (válidos: sandbox, production)'); process.exit(1); }

  // Seguridad extra para producción
  if (args.target === 'production' && args.apply && !args.confirmProduction) {
    err('para target=production con --apply necesitás también --confirm-production');
    err('producción tiene datos vivos. Doble check antes de seguir.');
    process.exit(1);
  }

  // Verificar que el target root existe
  if (!fs.existsSync(target.root)) {
    err('target root no existe: ' + target.root);
    process.exit(1);
  }

  // Cargar config
  const configPath = path.resolve(args.config);
  if (!fs.existsSync(configPath)) { err('config no encontrado: ' + configPath); process.exit(1); }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (e) { err('config no es JSON válido: ' + e.message); process.exit(1); }

  log('=== Pre-flight ===');
  log('target: ' + args.target + ' (' + target.root + ')');
  log('config: ' + configPath);
  log('modo: ' + (args.dryRun ? 'DRY-RUN' : 'APPLY'));

  // Validar config
  const cfgErrors = validateConfig(cfg);
  if (cfgErrors.length) {
    err('config tiene errores:');
    for (const e of cfgErrors) err('  - ' + e);
    process.exit(1);
  }
  ok('config válido (' + cfg.equipos.length + ' equipos en 12 grupos × 4)');

  // Detectar año actual del target. Preferimos catalogo.json (source of
  // truth en producción). Si no existe (típico en sandbox), lo extraemos
  // del CATALOGO embebido en apps-script-deploy/index.html. El script
  // crea catalogo.json en el target al final aunque no exista antes.
  const targetCatalogPath = path.join(target.root, 'catalogo.json');
  let oldYear;
  if (fs.existsSync(targetCatalogPath)) {
    const currentCat = JSON.parse(fs.readFileSync(targetCatalogPath, 'utf8'));
    oldYear = currentCat.year;
    log('año detectado en catalogo.json del target: ' + oldYear);
  } else {
    const targetHtml = path.join(target.root, 'apps-script-deploy', 'index.html');
    if (!fs.existsSync(targetHtml)) { err('no encontré ni catalogo.json ni apps-script-deploy/index.html en target'); process.exit(1); }
    const htmlContent = fs.readFileSync(targetHtml, 'utf8');
    const yearMatch = htmlContent.match(/year:\s*(\d{4})/);
    if (!yearMatch) { err('no pude extraer el year del CATALOGO embebido en ' + targetHtml); process.exit(1); }
    oldYear = parseInt(yearMatch[1], 10);
    log('año detectado en HTML del target (no había catalogo.json): ' + oldYear);
  }
  const newYear = cfg.year;
  log('migración: Mundial ' + oldYear + ' → Mundial ' + newYear);

  if (oldYear === newYear) {
    err('año target (' + newYear + ') es igual al actual. No es migración.');
    process.exit(1);
  }

  // Verificar git working tree limpio (solo si --apply)
  if (args.apply) {
    if (!gitWorkingTreeClean(target.root)) {
      err('git working tree no está limpio en ' + target.root);
      err('committeá o stashea cambios pendientes antes de migrar.');
      process.exit(1);
    }
    ok('git working tree limpio');

    // Verificar clasp instalado
    try { execSync('clasp --version', { stdio: 'pipe' }); ok('clasp instalado'); }
    catch (e) { err('clasp no está instalado. Instálalo: npm i -g @google/clasp'); process.exit(1); }
  }

  // === PLAN ===
  log('');
  log('=== Plan de ejecución ===');
  const plan = [
    '1. Backup del estado actual via JSONP (curl al deployment)',
    '2. Sobrescribir ' + path.relative(target.root, targetCatalogPath),
    '3. Correr sync-catalog → propaga CATALOGO a HTMLs',
    '4. Rotar strings: "Mundial ' + oldYear + '" → "Mundial ' + newYear + '" + STORAGE_KEYs',
    '5. clasp push -f + clasp version + clasp redeploy (deploymentId ' + target.deploymentId.slice(0, 12) + '...)',
    '6. git add + commit + push'
  ];
  for (const p of plan) log('  ' + p);
  log('');
  log('Después de ejecutar este script, FALTA (manual):');
  log('  - Abrir https://script.google.com → proyecto del ' + args.target);
  log('  - Ejecutar la función `resetParaProximoMundial`');
  log('  - Refrescar la PWA en el iPhone');

  if (args.dryRun) {
    log('');
    ok('--dry-run: no se ejecutó nada. Pasá --apply para correr.');
    return;
  }

  // === APPLY ===
  log('');
  log('=== Ejecución ===');

  log('[1/6] Backup...');
  const backupFile = doBackup(target.root, target.deploymentId, args.target);
  ok('backup → ' + path.relative(target.root, backupFile));

  log('[2/6] Sobrescribir catalogo.json...');
  // Mantener fields auxiliares que pueden no venir en cfg (totalEquipos, etc.)
  const newCat = {
    _comment: 'Catálogo activo. Generado por scripts/migrate-mundial.js — editar manualmente si hace falta y re-correr sync-catalog.',
    evento: cfg.evento,
    year: cfg.year,
    albumPublisher: cfg.albumPublisher || 'Panini',
    albumTitle: cfg.albumTitle || ('Álbum Panini ' + cfg.evento),
    stickersPorEquipo: cfg.stickersPorEquipo,
    totalEquipos: cfg.equipos.length,
    totalLaminasJugadores: cfg.equipos.length * cfg.stickersPorEquipo,
    totalLaminasEspeciales: (cfg.secciones.intro.length + cfg.secciones.history.length),
    totalLaminasAlbum: cfg.equipos.length * cfg.stickersPorEquipo + cfg.secciones.intro.length + cfg.secciones.history.length,
    secciones: cfg.secciones,
    equipos: cfg.equipos
  };
  fs.writeFileSync(targetCatalogPath, JSON.stringify(newCat, null, 2) + '\n', 'utf8');
  ok('catalogo.json actualizado');

  log('[3/6] sync-catalog...');
  runSyncCatalog(target.root);
  ok('CATALOGO propagado a HTMLs');

  log('[4/6] Rotar strings estáticos...');
  const rotSummary = rotateStrings(target.root, oldYear, newYear);
  for (const s of rotSummary) ok(s.file + ' (' + s.changes + ' replaces)');

  log('[5/6] clasp deploy...');
  const versionN = deployClasp(target.root, target.deploymentId, newYear);
  ok('deployado como v' + versionN);

  log('[6/6] git commit + push...');
  const commitFirstLine = gitCommitAndPush(target.root, newYear, versionN);
  if (commitFirstLine) ok('commit: ' + commitFirstLine);

  // === Resumen final ===
  log('');
  log('========================================');
  log('  MIGRACIÓN APLICADA — v' + versionN);
  log('========================================');
  log('Target:     ' + args.target);
  log('Mundial:    ' + oldYear + ' → ' + newYear);
  log('Deployment: ' + target.deploymentId);
  log('Backup:     ' + path.relative(target.root, backupFile));
  log('');
  log('PASOS MANUALES PENDIENTES:');
  log('');
  log('  1. Reset del backend (Apps Script no permite invocar funciones de afuera):');
  log('     → Abrir https://script.google.com');
  log('     → Entrar al proyecto del ' + args.target);
  log('     → Seleccionar función `resetParaProximoMundial`');
  log('     → Click Ejecutar');
  log('');
  log('  2. Verificar la PWA en el iPhone:');
  log('     → Cerrar la PWA del app switcher');
  log('     → Abrir Safari en la URL del deployment');
  log('     → Volver a la PWA del home screen');
  log('     → Header debe decir: "Álbum Panini ' + cfg.evento + '"');
  log('');
  log('  3. URL pública para vecinos:');
  log('     https://juank4835.github.io/' + target.repoSlug + '/cambios/');
  log('');
}

try {
  main();
} catch (e) {
  err('FATAL: ' + (e.stack || e.message));
  process.exit(1);
}
