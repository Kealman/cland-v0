// T2: lint policy reads isolated Git objects through an in-process Git adapter; no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LINT_BASELINE, testLintPolicy } from '../src/test-lint-policy.ts';

const file = 'hub/test/debt.test.ts';
const tiers = 'hub/test/tiers.json';
const baseline = (count: number) => JSON.stringify({ version: 1, files: { [file]: { 'wall-clock-assertion': count } } });
const oid = (text: string) => createHash('sha1').update(text).digest('hex');

test('lint preserves the dev freeze with stale or missing origin/dev while refusing growth', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-lint-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  // The dev freeze records debt added since the stale pre-freeze commit.
  const before = new Map([[tiers, JSON.stringify({ version: 1, tests: { [file]: 'T2' } })], [file, '']]);
  const frozen = new Map(before).set(file, 'assert.ok(Date.now() - started < 1000);').set(LINT_BASELINE, baseline(1));
  const candidate = new Map(frozen);
  const commits = new Map([['before', before], ['frozen', frozen], ['candidate', candidate]]);
  const refs = new Map([['refs/heads/dev', 'frozen'], ['dev', 'frozen'], ['origin/dev', 'before'], ['HEAD', 'candidate']]);
  const resolve = (ref: string) => refs.get(ref) ?? ref;
  const missing = () => Object.assign(new Error('missing Git object'), { code: 128 });
  const execute = (args: string[]): string => {
    if (args[0] === 'merge-base') {
      const base = resolve(args[1]!);
      if (!commits.has(base)) throw missing();
      return base;
    }
    if (args[0] === 'rev-parse') return args[1] === 'frozen^' ? 'before' : resolve(args[1]!);
    if (args[0] === 'log') return 'frozen';
    if (args[0] === 'show') {
      const colon = args[1]!.indexOf(':');
      const text = commits.get(resolve(args[1]!.slice(0, colon)))?.get(args[1]!.slice(colon + 1));
      if (text === undefined) throw missing();
      return text;
    }
    if (args[0] === 'ls-tree') return [...commits.get(resolve(args.at(-1)!))!].map(([path, text]) => `100644 blob ${oid(text)}\t${path}\0`).join('');
    throw new Error(`unexpected Git command: ${args.join(' ')}`);
  };
  const fakeExec = (_command: string, args: string[], _options: unknown, callback: (error: Error | null, stdout?: string | Buffer, stderr?: string) => void) => {
    assert.equal(_command, 'git');
    if (args[0] === 'cat-file') return { stdin: new Writable({ write(chunk, _encoding, done) {
      const blobs = new Map([...commits.values()].flatMap(snapshot => [...snapshot.values()].map(text => [oid(text), text])));
      const output = Buffer.concat(String(chunk).trim().split('\n').map(hash => {
        const content = Buffer.from(blobs.get(hash)!);
        return Buffer.concat([Buffer.from(`${hash} blob ${content.length}\n`), content, Buffer.from('\n')]);
      }));
      queueMicrotask(() => callback(null, output, ''));
      done();
    } }) };
    queueMicrotask(() => {
      try { callback(null, execute(args), ''); } catch (error) { callback(error as Error); }
    });
    return {};
  };
  Object.defineProperty(fakeExec, promisify.custom, { value: (command: string, args: string[], options: unknown) => new Promise((resolve, reject) => {
    fakeExec(command, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
  }) });
  const nativeExec = childProcess.execFile;
  childProcess.execFile = fakeExec as typeof childProcess.execFile;
  syncBuiltinESMExports();
  t.after(() => { childProcess.execFile = nativeExec; syncBuiltinESMExports(); });

  for (const remote of ['stale', 'missing', 'only remote']) {
    if (remote === 'missing') refs.delete('origin/dev');
    if (remote === 'only remote') {
      refs.delete('refs/heads/dev'); refs.delete('dev');
      refs.set('origin/dev', 'frozen');
    }
    candidate.set(LINT_BASELINE, baseline(1));
    for (const [path, text] of candidate) await writeFile(join(root, path), text);
    assert.deepEqual(await testLintPolicy(root), [], `${remote}: unchanged disk freeze`);
    assert.deepEqual(await testLintPolicy(root, { tree: 'HEAD', head: 'HEAD' }), [], `${remote}: unchanged committed freeze`);
    candidate.set(LINT_BASELINE, baseline(2));
    await writeFile(join(root, LINT_BASELINE), baseline(2));
    for (const options of [{}, { tree: 'HEAD', head: 'HEAD' }]) {
      const findings = await testLintPolicy(root, options);
      assert.ok(findings.some(f => f.rule === 'lint-baseline' && f.message === `baseline grew: ${file} [wall-clock-assertion]`), `${remote}: refuses growth ${JSON.stringify(findings)}`);
    }
  }
});
