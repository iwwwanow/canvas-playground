#!/bin/bash
# Download photos and videos from Pexels by category.
# Reads PEXELS_API_KEY from .env or environment.

COUNT=${1:-30}   # per category
OUT_DIR="assets/downloaded"

source .env 2>/dev/null || true
if [[ -z "$PEXELS_API_KEY" ]]; then
  echo "Error: PEXELS_API_KEY not set"; exit 1
fi

QUERIES=("flowers" "sky" "ocean waves" "abstract texture" "forest" "sunset")

download_photos() {
  local QUERY=$1
  local SLUG="${QUERY// /-}"
  local DIR="$OUT_DIR/photos/$SLUG"
  mkdir -p "$DIR"
  echo "→ photos: $QUERY"

  local PAGE=1
  local N=0
  while [[ $N -lt $COUNT ]]; do
    local RESP
    RESP=$(curl -s "https://api.pexels.com/v1/search?query=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$QUERY")&per_page=20&page=$PAGE" \
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

download_videos() {
  local QUERY=$1
  local SLUG="${QUERY// /-}"
  local DIR="$OUT_DIR/videos/$SLUG"
  mkdir -p "$DIR"
  echo "→ videos: $QUERY"

  local RESP
  RESP=$(curl -s "https://api.pexels.com/videos/search?query=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$QUERY")&per_page=15&orientation=landscape" \
    -H "Authorization: $PEXELS_API_KEY")

  local N=0
  while IFS= read -r URL; do
    [[ -z "$URL" ]] && continue
    local FNAME
    FNAME=$(printf "%03d.mp4" "$N")
    if curl -sL --max-time 60 -o "$DIR/$FNAME" "$URL"; then
      N=$((N+1))
      echo "  [$N] $FNAME"
    fi
    sleep 0.5
  done < <(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for v in d.get('videos',[]):
    files=sorted(v.get('video_files',[]), key=lambda f: f.get('width',0))
    # pick ~720p
    chosen=next((f for f in files if f.get('width',0)>=640), files[0] if files else None)
    if chosen: print(chosen['link'])
" 2>/dev/null)

  echo "  Done: $N videos → $DIR/"
}

for Q in "${QUERIES[@]}"; do
  download_photos "$Q"
  download_videos "$Q"
  sleep 1
done

echo ""
echo "All done → $OUT_DIR/"
