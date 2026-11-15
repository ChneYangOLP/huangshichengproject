#!/usr/bin/env sh
# For a fresh Ubuntu server. See https://docs.docker.com/engine/install/ubuntu/
set -eu
if [ "$(id -u)" != 0 ]; then
  echo '请使用 sudo sh deploy/install-docker-ubuntu.sh' >&2
  exit 1
fi
. /etc/os-release
if [ "${ID:-}" != ubuntu ]; then
  echo '此安装脚本仅适用于 Ubuntu；其他系统请按 Docker 官方文档安装。' >&2
  exit 1
fi
apt-get update
apt-get install -y ca-certificates curl
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location \
  --output /etc/apt/keyrings/docker.asc https://download.docker.com/linux/ubuntu/gpg
chmod 0644 /etc/apt/keyrings/docker.asc
docker_arch=$(dpkg --print-architecture)
ubuntu_release=${UBUNTU_CODENAME:-$VERSION_CODENAME}
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' \
  "Suites: $ubuntu_release" 'Components: stable' "Architectures: $docker_arch" \
  'Signed-By: /etc/apt/keyrings/docker.asc' > /etc/apt/sources.list.d/docker.sources
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
