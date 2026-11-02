// Repository documentation reader for contracts spanning multiple subsystems.
import { readFileSync } from 'node:fs';

export function hubReference(): string {
  const index = readFileSync(new URL('../hub/README.md', import.meta.url), 'utf8');
  const paths = [...index.matchAll(/^[-] \[[^\n]+\]\(\.\.\/(docs\/hub\/[^)]+\.md)\)$/gm)].map(match => match[1]!);
  if (!paths.length) throw new Error('hub documentation index has no subsystem pointers');
  return paths.map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n');
}
