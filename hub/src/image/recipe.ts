import { readFileSync } from 'node:fs';
import { TESTED_RANGES, formatVersion, type HarnessId } from '../doctor/ranges.ts';

export type RecipeOptions = {
  arch: 'x86_64' | 'arm64';
  node: string;
  /** Presence selects an agent image; omitted pins use doctor's tested minimums.
   * T-1716 owns config pin reading; T-1719 owns the pool-image caller. */
  harnesses?: Partial<Record<HarnessId, string>>;
};

/** Render only: installers run on the image builder, never on the hub. */
export function renderRecipe(options: RecipeOptions): string {
  if (options.arch !== 'x86_64' && options.arch !== 'arm64') throw new Error('unsupported image architecture');
  if (!/^v?\d+\.\d+\.\d+$/.test(options.node)) throw new Error('invalid Node image pin');
  let installers = '';
  if (options.harnesses !== undefined) {
    const pin = (id: HarnessId): string => {
      const value = options.harnesses?.[id] ?? formatVersion(TESTED_RANGES[id].min);
      if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`invalid harness pin: ${id}`);
      if (id === 'opencode' && !value.startsWith('2.')) throw new Error('OpenCode image pin must select v2');
      return value;
    };
    installers = `npm install -g @openai/codex@${pin('codex')} --prefix /usr/local\n`
      + 'test -x /usr/local/bin/codex\n'
      + `runuser -u runner -- bash -o pipefail -c 'curl -fsSL https://opencode.ai/v2/install | bash -s -- --version ${pin('opencode')}'\n`
      + `runuser -u runner -- bash -o pipefail -c 'curl -fsSL https://claude.ai/install.sh | bash -s -- ${pin('claude-code')}'\n`
      + 'test -x /home/runner/.opencode/bin/opencode\n'
      + 'ln -sf /home/runner/.opencode/bin/opencode /usr/local/bin/opencode\n'
      + 'test -x /home/runner/.local/bin/claude\n'
      + 'ln -sf /home/runner/.local/bin/claude /usr/local/bin/claude\n';
  }
  // Preserve the deployed executor template bytes and its snapshot-key digest.
  const base = readFileSync(new URL('../executor/droplet/provision.sh', import.meta.url), 'utf8')
    .replace('__NODE_VERSION__', options.node.startsWith('v') ? options.node : `v${options.node}`)
    .replaceAll('linux-x64', `linux-${options.arch === 'arm64' ? 'arm64' : 'x64'}`);
  return installers ? base.replace('touch /var/lib/cland-ready\n', `${installers}touch /var/lib/cland-ready\n`) : base;
}
