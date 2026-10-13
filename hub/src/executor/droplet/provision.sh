#!/bin/bash
# Prepared image builder. Versions and digest are substituted from the prepare key.
set -euo pipefail
exec >> /var/log/cland-provision.log 2>&1
export DEBIAN_FRONTEND=noninteractive
systemctl disable --now apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service || true
APT=(apt-get -q -y -o DPkg::Lock::Timeout=600)
retry() { local n=0; until "$@"; do n=$((n + 1)); [ "$n" -lt 10 ] || return 1; sleep 10; done; }
retry "${APT[@]}" update
retry "${APT[@]}" install --no-install-recommends git curl ca-certificates build-essential python3 jq lsof xz-utils procps locales
locale-gen en_US.UTF-8
update-locale LANG=en_US.UTF-8
NODE_VERSION=__NODE_VERSION__
NVIM_VERSION=__NVIM_VERSION__
NVIM_SHA256=__NVIM_SHA256__
cd /tmp
curl -fsSLO "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" | grep " node-$NODE_VERSION-linux-x64.tar.xz\$" | sha256sum -c -
mkdir -p /opt/node
tar -xJf "node-$NODE_VERSION-linux-x64.tar.xz" -C /opt/node --strip-components=1
for b in node npm npx; do ln -sf "/opt/node/bin/$b" "/usr/local/bin/$b"; done
curl -fsSLO "https://github.com/neovim/neovim/releases/download/$NVIM_VERSION/nvim-linux-x86_64.tar.gz"
echo "$NVIM_SHA256  nvim-linux-x86_64.tar.gz" | sha256sum -c -
mkdir -p /opt/nvim
tar -xzf nvim-linux-x86_64.tar.gz -C /opt/nvim
ln -sf /opt/nvim/nvim-linux-x86_64/bin/nvim /usr/local/bin/nvim
useradd --create-home --shell /bin/bash runner
install -d -m 700 -o runner -g runner /home/runner/.ssh
install -m 600 -o runner -g runner /root/.ssh/authorized_keys /home/runner/.ssh/authorized_keys
touch /var/lib/cland-ready
