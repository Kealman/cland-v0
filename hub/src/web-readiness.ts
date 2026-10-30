// Shared report-only preflight for suite workers and standalone Web probes.
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { webBundleState } from './web-bundle.ts';

export async function webReadiness(root: string): Promise<string[]> {
  const findings: string[] = [];
  const bundle = await webBundleState(root);
  if (bundle.state !== 'current') findings.push(`${bundle.detail}; run npm run build`);
  try {
    await stat(join(root, 'node_modules'));
    const require = createRequire(pathToFileURL(join(root, 'web/package.json')));
    for (const name of ['react', 'react-dom', 'playwright-core']) await stat(require.resolve(name));
  } catch { findings.push('node_modules is not resolvable for Web; run npm install'); }
  return findings;
}

export async function reportWebReadiness(root: string, emit: (line: string) => void = console.warn): Promise<void> {
  const findings = await webReadiness(root);
  emit(`Web prerequisites (report only): ${findings.length ? findings.join('; ') : 'current web/dist and resolvable node_modules'}`);
}
