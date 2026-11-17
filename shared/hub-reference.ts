// Repository documentation reader for contracts spanning multiple subsystems.
import { readFileSync } from 'node:fs';

export function hubReference(read: (url: URL) => string = url => readFileSync(url, 'utf8')): string {
  const index = read(new URL('../hub/README.md', import.meta.url));
  const paths: string[] = [];
  for (const [number, line] of index.split('\n').entries()) {
    const pointer = /\[[^\]\n]+\]\(\.\.\/(docs\/hub\/[^)\s#]+\.md)(?:#[^)\s]*)?(?:[ \t]+(?:"(?:\\[^\n]|[^"\\\n])*"|'(?:\\[^\n]|[^'\\\n])*'|\((?:\\[^\n]|[^()\\\n])*\)))?[ \t]*\)/g;
    if (line.replace(pointer, '').includes('../docs/hub/')) {
      throw new Error(`hub/README.md:${number + 1}: malformed subsystem pointer: ${line}`);
    }
    paths.push(...[...line.matchAll(pointer)].map(match => match[1]!));
  }
  if (!paths.length) throw new Error('hub documentation index has no subsystem pointers');
  return paths.map(path => read(new URL(`../${path}`, import.meta.url))).join('\n');
}
