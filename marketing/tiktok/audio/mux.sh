#!/usr/bin/env bash
# يدمج الصوت مع المقاطع الصامتة الناتجة من build.js، ويضبط العلوّ على ‎-14 LUFS (مستوى تيك توك).
# الاستخدام: FFMPEG=ffmpeg bash marketing/tiktok/audio/mux.sh <مجلد الصوت>
set -euo pipefail
FF=${FFMPEG:-ffmpeg}; A=$1; D=$(cd "$(dirname "$0")/.." && pwd)
for id in 00-teaser 01-final-grade 02-absence 03-qr-attendance; do
  src="$D/silent/$id.mp4"
  for kind in "" "-music"; do
    "$FF" -y -loglevel error -i "$src" -i "$A/$id$kind.wav" -map 0:v -map 1:a -c:v copy \
      -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 -c:a aac -b:a 160k -shortest -movflags +faststart "$D/$id$kind.mp4"
    echo "$D/$id$kind.mp4"
  done
done
