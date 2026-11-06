#!/bin/bash
# Project system dependencies; runs once as root on the image builder.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -q -y -o DPkg::Lock::Timeout=600)
retry() { local n=0; until "$@"; do n=$((n + 1)); [ "$n" -lt 10 ] || return 1; sleep 10; done; }
retry "${APT[@]}" update
# Chrome Headless Shell: Playwright's Ubuntu 24.04 Chromium runtime dependencies.
# Install as root before the non-root runner's npm ci downloads the pinned shell.
retry "${APT[@]}" install --no-install-recommends libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2
NVIM_VERSION=v0.12.5
NVIM_SHA256=bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875
cd /tmp
curl -fsSLO "https://github.com/neovim/neovim/releases/download/$NVIM_VERSION/nvim-linux-x86_64.tar.gz"
echo "$NVIM_SHA256  nvim-linux-x86_64.tar.gz" | sha256sum -c -
mkdir -p /opt/nvim
tar -xzf nvim-linux-x86_64.tar.gz -C /opt/nvim
ln -sf /opt/nvim/nvim-linux-x86_64/bin/nvim /usr/local/bin/nvim
# Seed the project's resolver cache from the verified system installation.
install -d -o runner -g runner "/home/runner/cland/.cache/nvim/$NVIM_VERSION"
ln -s /opt/nvim/nvim-linux-x86_64 "/home/runner/cland/.cache/nvim/$NVIM_VERSION/nvim-linux-x86_64"
printf '{"tag":"%s","digest":"%s"}\n' "$NVIM_VERSION" "$NVIM_SHA256" > /home/runner/cland/.cache/nvim/.cland-installed.json
chown -R runner:runner /home/runner/cland/.cache
