#!/bin/sh
# Verifica las fórmulas del libro con LibreOffice. Uso: sh tools/verificar.sh ejemplos/caso5.json carpeta_temporal
set -e
CASO=$1; T=$2; PY=${PY:-python3}
B=$(basename "$CASO" .json)
node tools/plan-json.mjs "$CASO" "$T/$B.plan.json" "${ENSAYOS:-2000}" >/dev/null
$PY -I tools/plan_a_xlsx.py "$T/$B.plan.json" "$T/$B.xlsx" >/dev/null
mkdir -p "$T/recalc"
soffice --headless --calc --convert-to xlsx --outdir "$T/recalc" "$T/$B.xlsx" >/dev/null 2>&1
$PY -I tools/verificar_xlsx.py "$T/$B.plan.json" "$T/recalc/$B.xlsx"
