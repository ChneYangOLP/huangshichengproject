#!/usr/bin/env sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
mkdir -p "$task_root/frontend/public/wasm"
em++ "$task_root/path_engine/AStar.cpp" \
  "$task_root/deploy/github-pages/WasmPathProvider.cpp" \
  -I "$task_root/path_engine" -std=c++17 -O3 --no-entry \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node \
  -sALLOW_MEMORY_GROWTH=1 \
  '-sEXPORTED_FUNCTIONS=["_hsc_find_path","_malloc","_free"]' \
  '-sEXPORTED_RUNTIME_METHODS=["HEAP32"]' \
  '-sINCOMING_MODULE_JS_API=["locateFile","wasmBinary"]' \
  -o "$task_root/frontend/public/wasm/astar.mjs"
