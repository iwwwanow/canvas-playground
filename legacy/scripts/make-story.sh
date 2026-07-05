#!/bin/bash
set -e

FONT=/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf
FONT_THIN=/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf
OUT=batch-out/story-reel-v1.mp4
ACCENT="0xff115c"

# clip processing macro: scale to fit 1080 wide, pad to 1080x1920, add labels
# usage: clip <input_stream> <start> <dur> <label_values> <output_stream>
make_clip() {
  local IN=$1 START=$2 DUR=$3 VALS=$4 OUT_S=$5
  echo "[${IN}:v]trim=start=${START}:duration=${DUR},setpts=PTS-STARTPTS,\
scale=w=1080:h=1080:force_original_aspect_ratio=decrease,\
pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,\
drawtext=fontfile='${FONT_THIN}':text='xtc-toaster':fontcolor=${ACCENT}:fontsize=36:x=(w-tw)/2:y=80,\
drawtext=fontfile='${FONT}':text='${VALS}':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[${OUT_S}]"
}

FILTER=$(cat <<'EOF'
[0:v]trim=start=2:duration=1.5,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=12  h=12  min=15':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v0];
[1:v]trim=start=1:duration=1.0,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=12  h=12  min=8':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v1];
[2:v]trim=start=3:duration=2.0,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=12  h=12  min=8':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v2];
[3:v]trim=start=2:duration=2.5,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=14  h=14  min=6':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v3];
[4:v]trim=start=4:duration=1.0,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=8  h=8  min=50':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v4];
[3:v]trim=start=5:duration=1.5,setpts=PTS-STARTPTS,scale=w=1080:h=1080:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Thin.ttf':text='xtc-toaster':fontcolor=0xff115c:fontsize=36:x=(w-tw)/2:y=80,drawtext=fontfile='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf':text='t=14  h=14  min=6':fontcolor=white:fontsize=58:x=(w-tw)/2:y=h-110[v5];
[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[out]
EOF
)

ffmpeg -y \
  -i batch-out/mosaic-frames-v6/preview.mp4 \
  -i batch-out/mosaic-frames-v3-v1/preview.mp4 \
  -i batch-out/mosaic-frames-v4-v1/preview.mp4 \
  -i batch-out/mosaic-frames-v4-v2/preview.mp4 \
  -i batch-out/mosaic-frames-v5/preview.mp4 \
  -filter_complex "$FILTER" \
  -map "[out]" \
  -r 30 -c:v libx264 -pix_fmt yuv420p -crf 18 \
  "$OUT"

echo "Done → $OUT"
