#!/bin/sh
# Render shots one after another: tools/trailer/queue.sh dawn bazaar:preview ...  (logs in tools/out/trailer/logs/)
cd "$(dirname "$0")/../.." || exit 1
mkdir -p tools/out/trailer/logs
for s in "$@"; do
  name=${s%%:*}; mode=""; [ "$name" != "$s" ] && mode=${s#*:}
  log=tools/out/trailer/logs/$name${mode:+-p}.log
  node tools/trailer/shot.mjs "$name" $mode > "$log" 2>&1 || node tools/trailer/shot.mjs "$name" $mode > "$log" 2>&1
done
