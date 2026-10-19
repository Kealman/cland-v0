// No network fallback: setup runs the unchanged official commands against these installer scripts.
import { join } from 'node:path';
import { shellQuote } from '../../src/accounts/registry.ts';
import { recordCall } from './setup-profile.ts';

const args = process.argv.slice(2);
recordCall('curl', args);
const installers = {
  'https://claude.ai/install.sh': ['claude-code', 'claude', '.local/bin'],
  'https://chatgpt.com/codex/install.sh': ['codex', 'codex', '.local/bin'],
  'https://opencode.ai/v2/install': ['opencode', 'opencode', '.opencode/bin'],
} as const;
const url = args.find(arg => Object.hasOwn(installers, arg));
if (!url || !process.env.FAKE_INSTALLER_DIR || !process.env.HOME) {
  process.stderr.write(`fake curl: unsupported installer ${JSON.stringify(args)}\n`);
  process.exitCode = 22;
} else {
  const [harness, binary, folder] = installers[url as keyof typeof installers];
  if (['1', harness].includes(process.env.FAKE_INSTALL_FAILS ?? '')) process.stdout.write('#!/bin/sh\nexit 1\n');
  else {
    const destination = join(process.env.HOME, folder);
    process.stdout.write(`#!/bin/sh\nset -eu\nmkdir -p ${shellQuote(destination)}\ncp ${shellQuote(join(process.env.FAKE_INSTALLER_DIR, binary))} ${shellQuote(join(destination, binary))}\nchmod +x ${shellQuote(join(destination, binary))}\n`);
  }
}
