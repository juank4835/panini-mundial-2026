# Backups del estado del álbum

Acá viven los snapshots automáticos y manuales del estado del backend.

## Tipos de backups

### Automático (semanal)

GitHub Actions corre cada lunes a las 8am COT (`.github/workflows/backup-weekly.yml`) y descarga el snapshot del estado público del álbum vía `?action=publica`. Se commitea acá como `auto-YYYY-MM-DD.json`.

**Qué incluye:**
- Estado de cada lámina (pegada/suelta)
- Precios de referencia
- Especiales (overrides por id)
- Descuentos por volumen

**Qué NO incluye:**
- Movimientos de finanzas (requieren auth)
- Estado completo del FIN_KEY (precios + movs + descuentos)

### Manual (antes de cambios riesgosos)

```bash
curl -sL "https://script.google.com/macros/s/AKfycbxb6U2M25Ah4ZyWu_C8PCQQGzpFzFs6a2VOsmDhTgehVi8V1tUm66LxYKntDFCx9H-6eg/exec?action=publica" \
  > backups/manual-$(date +%Y%m%d-%H%M).json
```

### Pre-migración a próximo Mundial

Antes de empezar la migración a Mundial 2030, hacer:
- `backups/mundial-2026-final-YYYYMMDD.json` (estado público vía curl)
- `backups/finanzas-2026-final-YYYYMMDD.json` (export manual desde la app)

## Restore

Para restaurar un snapshot, usar la función `importState` y/o `importFinanzas` del Apps Script (ver `Code.js`).
