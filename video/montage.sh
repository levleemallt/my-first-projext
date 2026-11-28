#!/usr/bin/env bash
# Финальный монтаж «Сотворение»: 9:16, 1080x1920, 25 fps, под монтажную версию музыки (208.75 с).
# Использование: montage.sh <папка_с_клипами> <edit.wav> <выход.mp4>
set -euo pipefail
C="$1"; A="$2"; OUT="$3"
V="fps=25,scale=1080:1920,setsar=1"

# Кусок 2: 4.8–9.2 с — врезка по пояс (скрываем огненную обнажённую фигуру).
CROP="crop=670:1190:205:0,scale=1080:1920,setsar=1"

ffmpeg -v error -y \
  -i "$C/m01b.mp4" -i "$C/m02.mp4" -i "$C/m03.mp4" -i "$C/m04.mp4" \
  -i "$C/m05.mp4" -i "$C/m06.mp4" -i "$C/m07.mp4" -i "$C/m08.mp4" \
  -i "$C/m09.mp4" -i "$C/m10.mp4" -i "$C/m10d.mp4" -i "$C/m11.mp4" \
  -i "$C/m12.mp4" -i "$C/m13.mp4" -i "$C/m14a.mp4" -i "$C/m14b.mp4" \
  -i "$A" \
  -filter_complex "
  [0:v]$V,trim=0:15,setpts=PTS-STARTPTS[v1];
  [1:v]$V,split=3[s2a][s2b][s2c];
  [s2a]trim=0:4.8,setpts=PTS-STARTPTS[v2a];
  [s2b]trim=4.8:9.2,setpts=PTS-STARTPTS,$CROP[v2b];
  [s2c]trim=9.2:15,setpts=PTS-STARTPTS[v2c];
  [2:v]$V,trim=0:15,setpts=PTS-STARTPTS[v3];
  [3:v]$V,trim=0:15,setpts=PTS-STARTPTS[v4];
  [4:v]$V,trim=0:14,setpts=PTS-STARTPTS[v5];
  [5:v]$V,trim=0:15,setpts=PTS-STARTPTS[v6];
  [6:v]$V,trim=0:15,setpts=PTS-STARTPTS[v7];
  [7:v]$V,trim=0:14.65,setpts=PTS-STARTPTS[v8];
  [8:v]$V,trim=0:16,setpts=PTS-STARTPTS[v9];
  [9:v]$V,trim=0:8.6,setpts=PTS-STARTPTS[v10a];
  [10:v]$V,trim=0.04:7.33,setpts=PTS-STARTPTS[v10d];
  [11:v]$V,trim=0:12,setpts=PTS-STARTPTS[v11];
  [12:v]$V,trim=0:11.96,setpts=PTS-STARTPTS[v12];
  [13:v]$V,trim=0:11,setpts=PTS-STARTPTS[v13];
  [14:v]$V,trim=0:12,setpts=PTS-STARTPTS[v14a];
  [15:v]$V,trim=0:11.25,setpts=PTS-STARTPTS,fade=t=out:st=9.25:d=2[v14b];
  [v1][v2a][v2b][v2c][v3][v4][v5][v6][v7][v8][v9][v10a][v10d][v11][v12][v13][v14a][v14b]concat=n=18:v=1:a=0[v];
  [16:a]atrim=0:208.75,asetpts=PTS-STARTPTS,afade=t=out:st=205.5:d=3.25[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
