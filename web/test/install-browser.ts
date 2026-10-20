// Install only the pinned test shell, in this checkout; never inspect a human browser.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';

import { browserCache } from './prerequisite.ts';
const root = await mkdtemp(join(tmpdir(), 'wi-'));
try {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/playwright-core/cli.js', import.meta.url)), 'install', 'chromium', '--only-shell', ...process.argv.slice(2)], {
    cwd: root, env: fixtureEnvironment(root, process.env, { PLAYWRIGHT_BROWSERS_PATH: browserCache, TMPDIR: root, TMP: root, TEMP: root }), stdio: 'inherit',
  });
  process.exitCode = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally { await rm(root, { recursive: true, force: true }); }
