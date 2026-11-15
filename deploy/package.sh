#!/usr/bin/env sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive_path=${1:-/tmp/hsc-deploy.tar.gz}
# Include the current working files, not only the older GitHub version.
tar -C "$project_dir" \
  --exclude='node_modules' --exclude='dist' --exclude='target' --exclude='build' \
  --exclude='.DS_Store' --exclude='*.tsbuildinfo' \
  --exclude='*.dylib' --exclude='*.so' --exclude='*.dll' \
  --exclude='frontend/.env' --exclude='frontend/.env.*' \
  -czf "$archive_path" \
  .dockerignore .mvn mvnw pom.xml src path_engine frontend compose.yaml deploy DEPLOYMENT.md
printf '部署包已生成：%s\n' "$archive_path"
