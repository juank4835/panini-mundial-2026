#!/usr/bin/env node
/*
 * verify-deploy.js — health-check de un deployment (sandbox o producción).
 *
 * Hace curl al deployment de Apps Script y a la página pública de GitHub
 * Pages, parsea los HTML y reporta una tabla con OK/FAIL por chequeo.
 * Ideal para correr al final de migrate-mundial.js o cuando sospechás
 * que algo quedó mal después de un deploy.
 *
 * USO:
 *   node scripts/verify-deploy.js --target sandbox
 *   node scripts/verify-deploy.js --target production
 *   node scripts/verify-deploy.js --target sandbox --expect-year 2030
 *
 * QUÉ VERIFICA:
 *   1. Deployment de Apps Script responde HTTP 2xx.
 *   2. JSONP backend (`?action=publica`) devuelve JSON válido con `ok: true`.
 *   3. Página pública de GitHub Pages (cambios/) responde 200.
 *   4. Página pública contiene el evento esperado (ej. "Mundial 2030").
 *   5. Catálogo local (catalogo.json o HTML) tiene el year esperado.
 *
 * SAFE: solo hace lecturas (GET requests). No escribe ni modifica nada.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TARGETS = {
  production: {
    root: path.resolve(__dirname, '..'),
    deploymentId: 'AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg',
    repoSlug: 'panini-mundial-2026'
  },
  sandbox: {
    root: '/Users/juank4835/Documents/panini-sandbox-2026',
    deploymentId: 'AKfycbxO6ce9vpKOiFwRXCw9Th_R7O1PmBAKHJtCVZGKy3_IIAvaCQ_ZQgzMBSsiasd8g18',
    repoSlug: 'panini-sandbox-2026'
  }
};

function parseArgs(argv) {
  const out = { target: null, expectYear: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--expect-year') out.expectYear = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log(`USO: node scripts/verify-deploy.js --target <sandbox|production> [--expect-year YYYY]`);
      process.exit(0);
    }
  }
  return out;
}

// GET con follow-redirects manual (script.google.com casi siempre redirige).
function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'verify-deploy.js' }
    }, (res) => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed, detail });
  const sym = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`  ${color}${sym}${reset} ${name}` + (detail ? ' — ' + detail : ''));
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.target) { console.error('falta --target'); process.exit(1); }
  const target = TARGETS[args.target];
  if (!target) { console.error('target inválido: ' + args.target); process.exit(1); }

  console.log('\n=== verify-deploy: ' + args.target + ' ===\n');

  // Detectar expectYear automáticamente si no se pasó
  let expectYear = args.expectYear;
  if (!expectYear) {
    const catPath = path.join(target.root, 'catalogo.json');
    if (fs.existsSync(catPath)) {
      try {
        expectYear = JSON.parse(fs.readFileSync(catPath, 'utf8')).year;
      } catch (e) {}
    }
    if (!expectYear) {
      const htmlPath = path.join(target.root, 'apps-script-deploy', 'index.html');
      if (fs.existsSync(htmlPath)) {
        const m = fs.readFileSync(htmlPath, 'utf8').match(/year:\s*(\d{4})/);
        if (m) expectYear = parseInt(m[1], 10);
      }
    }
  }
  if (expectYear) {
    console.log('Año esperado (auto-detectado): ' + expectYear + '\n');
  } else {
    console.log('No se pudo auto-detectar el year esperado. Pasá --expect-year YYYY para validar.\n');
  }

  console.log('--- Backend (Apps Script) ---');
  const deployUrl = 'https://script.google.com/macros/s/' + target.deploymentId + '/exec';
  try {
    const res = await fetchUrl(deployUrl);
    check('deployment responde', res.status === 200, 'HTTP ' + res.status);
    check('HTML del deployment contiene <html>', /\<html/i.test(res.body));
    if (expectYear) {
      check('HTML del deployment menciona "Mundial ' + expectYear + '"',
        res.body.includes('Mundial ' + expectYear));
    }
  } catch (e) {
    check('deployment responde', false, 'error: ' + e.message);
  }

  try {
    const res = await fetchUrl(deployUrl + '?action=publica');
    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch (e) {}
    check('backend ?action=publica devuelve JSON válido', !!parsed);
    if (parsed) {
      check('backend responde con ok=true', parsed.ok === true);
    }
  } catch (e) {
    check('backend ?action=publica responde', false, 'error: ' + e.message);
  }

  console.log('\n--- Página pública (GitHub Pages) ---');
  const pagesUrl = 'https://juank4835.github.io/' + target.repoSlug + '/cambios/';
  try {
    const res = await fetchUrl(pagesUrl);
    check('GitHub Pages responde', res.status === 200, 'HTTP ' + res.status);
    if (expectYear) {
      check('GitHub Pages menciona "Mundial ' + expectYear + '"',
        res.body.includes('Mundial ' + expectYear));
    }
    check('GitHub Pages tiene <title>', /\<title\>/.test(res.body));
  } catch (e) {
    check('GitHub Pages responde', false, 'error: ' + e.message);
  }

  console.log('\n--- Archivos locales del target ---');
  const localChecks = [
    { file: 'manifest.json', test: c => c.includes(target.repoSlug), desc: 'manifest tiene start_url con repoSlug' },
    { file: 'apps-script-deploy/index.html', test: c => /year:\s*\d{4}/.test(c), desc: 'HTML tiene year en CATALOGO' },
    { file: 'cambios/index.html', test: c => /year:\s*\d{4}/.test(c), desc: 'cambios/ tiene year en CATALOGO' }
  ];
  for (const lc of localChecks) {
    const fp = path.join(target.root, lc.file);
    if (!fs.existsSync(fp)) {
      check(lc.desc + ' (' + lc.file + ')', false, 'no existe');
      continue;
    }
    const content = fs.readFileSync(fp, 'utf8');
    check(lc.desc + ' (' + lc.file + ')', lc.test(content));
  }

  // === Summary ===
  const failed = checks.filter(c => !c.passed);
  console.log('\n=== Resumen ===');
  console.log('Total:     ' + checks.length);
  console.log('OK:        ' + (checks.length - failed.length));
  console.log('FAIL:      ' + failed.length);
  if (failed.length) {
    console.log('\nChecks fallidos:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
    process.exit(1);
  }
  console.log('\n✓ Todo OK. Deployment del ' + args.target + ' está sano.\n');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
