// Preloaded only by the real-process CLI import guards.
import { registerHooks } from 'node:module';
import { writeFileSync } from 'node:fs';

const sourceRoot = new URL('../../../src/', import.meta.url).href;
const urls = new Set<string>();
const output = process.env.CLAND_TEST_IMPORT_COUNTS!;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === process.env.CLAND_TEST_IMPORT_FAILURE) throw new Error('test subcommand import failure');
    const resolved = nextResolve(specifier, context);
    if (resolved.url.startsWith(sourceRoot)) urls.add(resolved.url);
    return resolved;
  },
});
process.on('exit', () => writeFileSync(output, JSON.stringify([...urls])));
