#!/bin/bash
# Download targeted photos to fill gaps in hue×tone grid.
# Reads PEXELS_API_KEY from .env or environment.

COUNT=${1:-30}
OUT_DIR="assets/downloaded"

source .env 2>/dev/null || true
if [[ -z "$PEXELS_API_KEY" ]]; then
  echo "Error: PEXELS_API_KEY not set"; exit 1
fi

# New categories targeting missing hue/tone cells:
# - Dark tones (0–25%): night scenes, dark rock, deep water
# - Bright/pale tones (83–100%): snow, white sand, bright fog
# - Magenta/Pink (few assets): bougainvillea, rose petals, pink flamingo
# - Violet/Purple (few assets): lavender, purple mountains, wisteria
# - Green (underrepresented): moss, fern, jungle canopy
QUERIES=(
  "night forest dark"
  "dark ocean depth"
  "black volcanic rock"
  "dark storm clouds night"
  "white snow field"
  "bright white sand beach"
  "pale fog mist"
  "bougainvillea pink flowers"
  "pink rose petals closeup"
  "lavender field purple"
  "wisteria purple flowers"
  "moss green texture"
  "fern leaves green"
  "jungle canopy green"
)

urlencode() {
  python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"
}

download_photos() {
  local QUERY=$1
  local SLUG="${QUERY// /-}"
  local DIR="$OUT_DIR/photos/$SLUG"
  mkdir -p "$DIR"

  # skip if already has enough photos
  local EXISTING
  EXISTING=$(ls "$DIR"/*.jpg 2>/dev/null | wc -l)
  if [[ $EXISTING -ge $COUNT ]]; then
    echo "  skip $SLUG (already $EXISTING photos)"
    return
  fi

  echo "→ photos: $QUERY"

  local PAGE=1
  local N=$EXISTING
  while [[ $N -lt $COUNT ]]; do
    local RESP
    RESP=$(curl -s "https://api.pexels.com/v1/search?query=$(urlencode "$QUERY")&per_page=20&page=$PAGE" \
      -H "Authorization: $PEXELS_API_KEY")

    local URLS
    URLS=$(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d.get('photos',[]):
    print(p['src']['large'])
" 2>/dev/null)

    [[ -z "$URLS" ]] && break

    while IFS= read -r URL; do
      [[ -z "$URL" ]] && continue
      local FNAME
      FNAME=$(printf "%03d.jpg" "$N")
      if curl -sL --max-time 20 -o "$DIR/$FNAME" "$URL"; then
        N=$((N+1))
        echo "  [$N/$COUNT] $FNAME"
      fi
      [[ $N -ge $COUNT ]] && break
      sleep 0.3
    done <<< "$URLS"

    PAGE=$((PAGE+1))
  done
  echo "  Done: $N photos → $DIR/"
}

for Q in "${QUERIES[@]}"; do
  download_photos "$Q"
  sleep 0.5
done

echo ""
echo "All done → $OUT_DIR/"
