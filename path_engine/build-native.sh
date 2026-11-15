#!/usr/bin/env sh
set -eu
engine_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
output_dir="$engine_dir/../src/main/resources/lib"
mkdir -p "$output_dir"
if [ -z "${JAVA_HOME:-}" ]; then
  if [ "$(uname -s)" = Darwin ]; then
    JAVA_HOME=$(/usr/libexec/java_home)
  else
    JAVA_HOME=$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")
  fi
fi
case "$(uname -s)" in
  Darwin)
    "${CXX:-clang++}" -std=c++17 -O2 -dynamiclib \
      -I"$JAVA_HOME/include" -I"$JAVA_HOME/include/darwin" \
      "$engine_dir/AStar.cpp" "$engine_dir/NativePathProvider.cpp" \
      -o "$output_dir/libPathEngine.dylib"
    ;;
  Linux)
    "${CXX:-g++}" -std=c++17 -O2 -fPIC -shared \
      -I"$JAVA_HOME/include" -I"$JAVA_HOME/include/linux" \
      "$engine_dir/AStar.cpp" "$engine_dir/NativePathProvider.cpp" \
      -o "$output_dir/libPathEngine.so"
    ;;
  *) echo '请使用 path_engine/CMakeLists.txt 编译当前平台的 PathEngine。' >&2; exit 1 ;;
esac
echo "原版 C++ A* 引擎已编译到 $output_dir"
