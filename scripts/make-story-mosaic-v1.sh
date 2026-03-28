#!/bin/bash
set -e

# ─── Mosaic Color Story — witch house tempo ──────────────────────────────────
#
# Inputs (6 clips, all 1080×1920, 5s each, solid-color mosaic 12×12):
#   0: mosaic-clip00-color.mp4
#   1: mosaic-clip01-color.mp4
#   2: mosaic-clip02-color.mp4
#   3: mosaic-clip03-color.mp4
#   4: mosaic-clip04-color.mp4
#   5: mosaic-clip05-color.mp4
#
# Edit structure (13 shots, ~11.4s total):
#   [v0]  clip04  2.0s  zoom 1.05x  — slow dark open
#   [v1]  clip01  0.30s zoom 1.3x   — flash
#   [v2]  clip02  1.20s zoom OUT    — breathe back
#   [v3]  clip04  0.20s zoom 1.5x   — micro hit
#   [v4]  clip05  0.25s zoom 1.0x   — micro hit
#   [v5]  clip03  1.80s zoom 1.2x   — settle
#   [v6]  clip00  0.30s zoom 1.8x   — extreme flash
#   [v7]  clip02  0.20s zoom 1.0x   — beat
#   [v8]  clip04  2.50s zoom 1.05x  — slow breathe
#   [v9]  clip01  0.35s zoom 1.4x   — flash
#   [v10] clip05  1.20s zoom 1.0x   — settle
#   [v11] clip03  0.30s zoom 2.0x   — extreme close flash
#   [v12] clip00  0.80s zoom OUT    — hold / fade territory

FONT_THIN=/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf
OUT=batch-out/story-mosaic-color-v1.mp4
ACCENT="0xff115c"
LABEL_FILTER="drawtext=fontfile='${FONT_THIN}':text='xtc-toaster':fontcolor=${ACCENT}:fontsize=36:x=(w-tw)/2:y=80"

# ─── crop macros ─────────────────────────────────────────────────────────────
# zoom 1.05x  → crop 1029×1829 @ (25,45)
# zoom 1.2x   → crop 900×1600  @ (90,160)
# zoom 1.3x   → crop 831×1477  @ (124,221)
# zoom 1.4x   → crop 771×1371  @ (154,274)
# zoom 1.5x   → crop 720×1280  @ (180,320)
# zoom 1.8x   → crop 600×1067  @ (240,426)
# zoom 2.0x   → crop 540×960   @ (270,480)
# zoom OUT     → scale 972×1728, pad to 1080×1920 with black

FILTER=$(cat <<'FILTEOF'
[4:v]trim=start=0.5:duration=2.0,setpts=PTS-STARTPTS,crop=1029:1829:25:45,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v0];
[1:v]trim=start=1.0:duration=0.3,setpts=PTS-STARTPTS,crop=831:1477:124:221,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v1];
[2:v]trim=start=0.5:duration=1.2,setpts=PTS-STARTPTS,scale=972:1728,pad=1080:1920:54:96:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v2];
[4:v]trim=start=3.0:duration=0.2,setpts=PTS-STARTPTS,crop=720:1280:180:320,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v3];
[5:v]trim=start=2.0:duration=0.25,setpts=PTS-STARTPTS,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v4];
[3:v]trim=start=0.5:duration=1.8,setpts=PTS-STARTPTS,crop=900:1600:90:160,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v5];
[0:v]trim=start=1.5:duration=0.3,setpts=PTS-STARTPTS,crop=600:1067:240:426,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v6];
[2:v]trim=start=3.0:duration=0.2,setpts=PTS-STARTPTS,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v7];
[4:v]trim=start=0.0:duration=2.5,setpts=PTS-STARTPTS,crop=1029:1829:25:45,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v8];
[1:v]trim=start=2.5:duration=0.35,setpts=PTS-STARTPTS,crop=771:1371:154:274,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v9];
[5:v]trim=start=1.0:duration=1.2,setpts=PTS-STARTPTS,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v10];
[3:v]trim=start=0.3:duration=0.3,setpts=PTS-STARTPTS,crop=540:960:270:480,scale=1080:1920,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v11];
[0:v]trim=start=3.5:duration=0.8,setpts=PTS-STARTPTS,scale=972:1728,pad=1080:1920:54:96:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80[v12];
[v0][v1][v2][v3][v4][v5][v6][v7][v8][v9][v10][v11][v12]concat=n=13:v=1:a=0[out]
FILTEOF
)

ffmpeg -y \
  -i batch-out/mosaic-clip00-color.mp4 \
  -i batch-out/mosaic-clip01-color.mp4 \
  -i batch-out/mosaic-clip02-color.mp4 \
  -i batch-out/mosaic-clip03-color.mp4 \
  -i batch-out/mosaic-clip04-color.mp4 \
  -i batch-out/mosaic-clip05-color.mp4 \
  -filter_complex "$FILTER" \
  -map "[out]" \
  -r 24 -c:v libx264 -pix_fmt yuv420p -crf 18 \
  "$OUT"

echo "Done → $OUT"
