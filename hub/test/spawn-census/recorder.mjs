// Test-only preload. Patch CommonJS and ESM exports without changing call arguments.
import cp from 'node:child_process';
import { openSync, writeSync, realpathSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// ESM filesystem bindings change when a native-boundary test synchronizes mocks.
const writeRecord = writeSync;

const root = process.env.TEST_SPAWN_CENSUS_ROOT;
if (root) {
  const repo = realpathSync(process.env.TEST_SPAWN_CENSUS_REPO);
  const target = process.argv[1];
  if (process.env.NODE_TEST_CONTEXT && target && /\.test\.[cm]?[jt]s$/.test(target)) {
    process.env.TEST_SPAWN_CENSUS_TEST = relative(repo, realpathSync(resolve(target)));
  }
  const log = resolve(root, `${process.pid}.jsonl`);
  // Sandboxed descendants may forbid every write. Leave their behavior intact;
  // their parent's sandbox-exec launch is recorded as a coverage gap.
  const fd = (() => {
    try { return openSync(log, 'a', 0o600); }
    catch (error) {
      if (['EPERM', 'EACCES', 'EROFS'].includes(error.code)) return null;
      throw error;
    }
  })();
  let depth = 0;
  for (const method of fd === null ? [] : ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    const original = cp[method];
    cp[method] = function (...args) {
      // exec calls the exported execFile; count the outer call only.
      if (!depth) {
        const stack = new Error().stack?.split('\n').slice(1) ?? [];
        let helper = '(outside hub/src, hub/test, nvim/test)';
        for (const frame of stack) {
          if (frame.includes('/spawn-census/recorder.mjs')) continue;
          const match = frame.match(/(?:file:\/\/)?([^\s()]*\/(?:hub\/src|hub\/test|nvim\/test)\/[^():]+):\d+:\d+/);
          if (!match) continue;
          const name = frame.trim().replace(/^at /, '').split(' (')[0];
          helper = relative(repo, decodeURI(match[1])) + (frame.includes(' (') ? ` ${name}` : '');
          break;
        }
        const options = args.find((arg, index) => index > 0 && arg && typeof arg === 'object' && !Array.isArray(arg));
        const shell = method === 'exec' || method === 'execSync' || options?.shell;
        const command = method === 'fork' ? process.execPath : shell ? (typeof options?.shell === 'string' ? options.shell : process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : '/bin/sh') : args[0];
        const firstArgument = method === 'fork' ? String(args[0]) : shell ? (process.platform === 'win32' ? '/d' : '-c') : Array.isArray(args[1]) ? args[1][0] ?? null : null;
        const gap = basename(String(command)) === 'sandbox-exec' ? 'sandbox may deny census log writes' : options?.env && !(options.env.NODE_OPTIONS?.includes(import.meta.url) || options.env.NODE_OPTIONS?.includes(fileURLToPath(import.meta.url))) ? 'NODE_OPTIONS replaced or omitted' : options?.env && (options.env.TEST_SPAWN_CENSUS_ROOT !== root || options.env.TEST_SPAWN_CENSUS_REPO !== process.env.TEST_SPAWN_CENSUS_REPO || (process.env.TEST_SPAWN_CENSUS_TEST && options.env.TEST_SPAWN_CENSUS_TEST !== process.env.TEST_SPAWN_CENSUS_TEST)) ? 'census configuration or attribution omitted' : null;
        const line = Buffer.from(JSON.stringify({ timestamp: new Date().toISOString(), command: basename(String(command)), firstArgument, testFile: process.env.TEST_SPAWN_CENSUS_TEST ?? '(suite infrastructure)', helper, gap }) + '\n');
        for (let offset = 0; offset < line.length;) offset += writeRecord(fd, line, offset, line.length - offset);
      }
      depth++;
      try { return Reflect.apply(original, this, args); }
      finally { depth--; }
    };
    Object.defineProperty(cp[method], 'name', { value: original.name });
    Object.defineProperty(cp[method], 'length', { value: original.length });
    if (original[promisify.custom]) {
      const wrapped = cp[method];
      Object.defineProperty(wrapped, promisify.custom, { value: (...args) => {
        const { promise, resolve, reject } = Promise.withResolvers();
        promise.child = wrapped(...args, (error, stdout, stderr) => {
          if (error !== null) { error.stdout = stdout; error.stderr = stderr; reject(error); }
          else resolve({ stdout, stderr });
        });
        return promise;
      } });
    }
  }
  syncBuiltinESMExports();
}
