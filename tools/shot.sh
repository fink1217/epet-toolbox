#!/usr/bin/env bash
# 用無頭 Chrome 截圖：tools/shot.sh <網址路徑> <輸出檔> [寬] [高]
# 例：tools/shot.sh index.html out.png 1280 2200
base="${SHOT_BASE:-http://127.0.0.1:8765/}"
url="$base$1"
out="$2"
w="${3:-1280}"
h="${4:-2000}"
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
prof="$(mktemp -d)"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" \
  --window-size="$w,$h" --virtual-time-budget=6000 --screenshot="$out" "$url" 2>/dev/null
rm -rf "$prof"
ls -la "$out"
