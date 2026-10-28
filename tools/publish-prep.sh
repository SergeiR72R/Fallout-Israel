#!/bin/bash
# Сборка и подготовка папки для публикации страницей: tools/publish-prep.sh OUTDIR
set -e
OUT=$1
npm run build >/dev/null
rm -rf "$OUT" && mkdir -p "$OUT"
python3 tools/build-artifact.py "$OUT/hamsin.html"
cp -r dist/art dist/backgrounds dist/sprites dist/portraits "$OUT/"
