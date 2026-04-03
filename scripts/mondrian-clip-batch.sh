#!/usr/bin/env bash
# mondrian-clip-batch.sh — mondrian-фильтр для всех mp4 в директории
#
# Usage:
#   ./scripts/mondrian-clip-batch.sh [clips_dir] [output_dir]
#
# Аргументы:
#   clips_dir     — директория с клипами (по умолчанию: batch-out/clips)
#   output_dir    — куда сохранять результаты (по умолчанию: batch-out/clips-mondrian)
#
# Обрабатывает файлы последовательно (слабая машина).
# Уже обработанные клипы пропускаются автоматически.

set -e
cd "$(dirname "$0")/.."

CLIPS_DIR="${1:-batch-out/clips}"
OUT_DIR="${2:-batch-out/clips-mondrian}"

if [[ ! -d "$CLIPS_DIR" ]]; then
  echo "Директория не найдена: $CLIPS_DIR"
  exit 1
fi

CLIPS=("$CLIPS_DIR"/*.mp4)

# Фильтруем — не обрабатываем уже готовые mondrian-файлы если они лежат рядом
TOTAL=0
for C in "${CLIPS[@]}"; do
  [[ -f "$C" ]] && (( TOTAL++ )) || true
done

echo "=== mondrian clip batch: $TOTAL клипов из $CLIPS_DIR ==="
echo ""

DONE=0
SKIP=0

for CLIP in "${CLIPS[@]}"; do
  [[ -f "$CLIP" ]] || continue

  BASENAME=$(basename "$CLIP" .mp4)
  OUT_FILE="$OUT_DIR/${BASENAME}-mondrian.mp4"

  if [[ -f "$OUT_FILE" && -s "$OUT_FILE" ]]; then
    echo "SKIP $(basename "$CLIP") (уже есть)"
    (( SKIP++ )) || true
    continue
  fi

  bash "$(dirname "$0")/mondrian-clip.sh" "$CLIP" "$OUT_DIR"
  (( DONE++ )) || true
done

echo ""
echo "=== Готово: обработано $DONE, пропущено $SKIP ==="
ls -lh "$OUT_DIR"/*.mp4 2>/dev/null | awk '{print $5, $9}' || echo "(нет файлов)"
