#!/bin/bash
# Downloads images from Wikimedia Commons by category, no registration needed.
# Usage: ./download-assets.sh [count_per_category]

COUNT=${1:-30}
OUT_DIR="assets/downloaded"
API="https://commons.wikimedia.org/w/api.php"

declare -A CATEGORIES=(
  ["flowers"]="Flowers"
  ["sky"]="Sky"
  ["water"]="Waves"
)

mkdir -p "$OUT_DIR"

download_category() {
  local NAME=$1
  local CAT=$2
  local DIR="$OUT_DIR/$NAME"
  mkdir -p "$DIR"

  echo "→ $NAME ($CAT)"

  # Get file list from category
  local FILES
  # Request 5x more candidates to account for webp/svg/gif being filtered
  local FETCH=$(( COUNT * 5 ))
  FILES=$(curl -s "${API}?action=query&list=categorymembers&cmtitle=Category:${CAT}&cmlimit=${FETCH}&cmtype=file&format=json" \
    | python3 -c "import sys,json; data=json.load(sys.stdin); [print(m['title']) for m in data['query']['categorymembers']]")

  local N=0
  while IFS= read -r TITLE; do
    [[ -z "$TITLE" ]] && continue

    # Get image URL
    local ENCODED
    ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$TITLE")
    local INFO
    INFO=$(curl -s "${API}?action=query&titles=${ENCODED}&prop=imageinfo&iiprop=url&format=json")

    local URL
    URL=$(echo "$INFO" | python3 -c "
import sys,json
data=json.load(sys.stdin)
pages=data['query']['pages']
for p in pages.values():
    ii=p.get('imageinfo',[])
    if ii: print(ii[0]['url'])
" 2>/dev/null)

    [[ -z "$URL" ]] && continue

    # Only jpg/jpeg/png
    EXT="${URL##*.}"
    EXT="${EXT%%\?*}"
    EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
    [[ "$EXT" != "jpg" && "$EXT" != "jpeg" && "$EXT" != "png" ]] && continue

    local FNAME
    FNAME=$(printf "%03d.%s" "$N" "$EXT")
    local DEST="$DIR/$FNAME"

    if curl -sL --max-time 30 -A "Mozilla/5.0 (compatible; xtc-toaster/1.0)" -o "$DEST" "$URL"; then
      # Verify it's actually an image (not an HTML error page)
      local MIME
      MIME=$(file --mime-type -b "$DEST")
      if [[ "$MIME" == image/* ]]; then
        N=$((N+1))
        echo "  [$N/$COUNT] $FNAME ($MIME)"
      else
        rm -f "$DEST"
      fi
    fi
    sleep 1

    [[ $N -ge $COUNT ]] && break
  done <<< "$FILES"

  echo "  Done: $N images → $DIR/"
}

for NAME in "${!CATEGORIES[@]}"; do
  download_category "$NAME" "${CATEGORIES[$NAME]}"
  sleep 3
done

echo ""
echo "All done → $OUT_DIR/"
