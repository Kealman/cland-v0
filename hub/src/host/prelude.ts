import { readFileSync } from 'node:fs';

let authHelper: string | undefined;

/** Render only explicit host bootstrap inputs; never inherit the hub environment.
 * providerSteps is trusted provider-owned shell, not user configuration.
 */
export function renderPrelude({ hostKey, hostPublicKey, providerSteps }: {
  hostKey: string; hostPublicKey: string; providerSteps: string;
}): string {
  authHelper ??= readFileSync(new URL('./cland-auth.sh', import.meta.url), 'utf8');
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  return `#!/bin/bash
set -eu
umask 077
install -d -m 755 /etc/ssh/sshd_config.d
printf '%s\\n' ${quote(hostKey.trimEnd())} > /etc/ssh/ssh_host_ed25519_key
printf '%s\\n' ${quote(hostPublicKey.trimEnd())} > /etc/ssh/ssh_host_ed25519_key.pub
chmod 600 /etc/ssh/ssh_host_ed25519_key
chmod 644 /etc/ssh/ssh_host_ed25519_key.pub
cat > /etc/ssh/sshd_config.d/60-cland.conf <<'CONF'
HostKey /etc/ssh/ssh_host_ed25519_key
StreamLocalBindUnlink yes
ClientAliveInterval 15
ClientAliveCountMax 4
MaxSessions 32
PasswordAuthentication no
CONF
systemctl restart ssh || systemctl restart sshd
${providerSteps}
install -d -m 755 /cland/auth /usr/local/sbin /etc/sudoers.d
cat > /usr/local/sbin/cland-auth <<'CLAND_AUTH_HELPER'
${authHelper}CLAND_AUTH_HELPER
chmod 755 /usr/local/sbin/cland-auth
printf '%s\\n' 'runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth' > /etc/sudoers.d/cland-auth
chmod 440 /etc/sudoers.d/cland-auth
install -d -o runner -g runner -m 700 /home/runner/.codex
printf '%s\\n' 'cli_auth_credentials_store = "file"' > /home/runner/.codex/config.toml
chown runner:runner /home/runner/.codex/config.toml
chmod 600 /home/runner/.codex/config.toml
`;
}
