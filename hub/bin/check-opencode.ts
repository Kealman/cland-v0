#!/usr/bin/env node
// Opt-in release check; never imported by npm test. Network failures leave the tested range untouched.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { adapterEventNames, compareEventNames, compareOpenCodeContract, OPERATIONS, type OpenApi } from '../src/doctor/opencode-contract.ts';
import { OpenCodeCleanupError, smokeOpenCode } from '../src/doctor/opencode-smoke.ts';
import { compareVersions, formatVersion, parseVersion, TESTED_RANGES } from '../src/doctor/ranges.ts';

const exec = promisify(execFile);
const installedRoot = fileURLToPath(new URL('../../', import.meta.url));
const root = process.env.CLAND_TEST_OPENCODE_CHECK_ROOT ?? installedRoot;
const cli = join(installedRoot, 'hub/bin/cland.ts');
const source = (version: string, path: string) => `https://raw.githubusercontent.com/anomalyco/opencode/v${version}/${path}`;
async function download(url: string): Promise<Buffer> {
  // Offline CLI fixtures retain the real fetch/tar/binary/tracker boundaries; production uses upstream URLs.
  const origin = process.env.CLAND_TEST_OPENCODE_CHECK_ORIGIN;
  if (origin) url = new URL(new URL(url).pathname, origin).href;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const json = async (url: string) => JSON.parse((await download(url)).toString('utf8'));

let version = 'unknown';
let preserveScratch = false;
const scratch = await mkdtemp(join(tmpdir(), 'cland-opencode-check-'));
try {
  const registry = await json('https://registry.npmjs.org/@opencode/cli');
  const versions = Object.keys(registry.versions).filter(v => /^2\.\d+\.\d+$/.test(v));
  versions.sort((a, b) => compareVersions(parseVersion(a)!, parseVersion(b)!));
  version = versions.at(-1) ?? 'unknown';
  if (version === 'unknown') throw new Error('registry contains no stable OpenCode 2.x release');
  const tested = formatVersion(TESTED_RANGES.opencode.min);
  console.log(`OpenCode release check: tested ${tested}, newest stable 2.x ${version}`);
  const docs = await Promise.all([tested, version].map(v => json(source(v, 'packages/protocol/openapi.json')) as Promise<OpenApi>));
  const errors = compareOpenCodeContract(docs[0]!, docs[1]!);
  const eventFiles = ['session-event.ts', 'permission.ts', 'form.ts'];
  const upstreamEvents = await Promise.all([tested, version].map(async v => (await Promise.all(eventFiles.map(p => download(source(v, `packages/schema/src/${p}`))))).join('\n')));
  const adapter = await Promise.all(['hub/src/adapters/opencode.ts', 'hub/src/adapters/opencode/state.ts'].map(p => readFile(join(root, p), 'utf8')));
  const names = adapterEventNames(adapter);
  if (!names.length) throw new Error('no adapter event names found');
  errors.push(...compareEventNames(names, upstreamEvents[0]!, upstreamEvents[1]!));
  if (errors.length) throw new Error(`contract changed:\n${errors.slice(0, 40).join('\n')}`);
  console.log(`${OPERATIONS.length} wire operations and ${names.length} adapter event names compatible`);

  if (!['darwin', 'linux'].includes(process.platform) || !['arm64', 'x64'].includes(process.arch)) throw new Error(`unsupported smoke platform ${process.platform}/${process.arch}`);
  const platformPackage = `@opencode/cli-${process.platform}-${process.arch}`;
  const pkg = await json(`https://registry.npmjs.org/${platformPackage}/${version}`);
  const archive = await download(pkg.dist.tarball);
  const [algorithm, digest] = String(pkg.dist.integrity).split('-');
  if (algorithm !== 'sha512' || createHash('sha512').update(archive).digest('base64') !== digest) throw new Error('binary package integrity mismatch');
  const tarball = join(scratch, 'opencode.tgz');
  const binaryRoot = join(scratch, 'binary');
  await mkdir(binaryRoot);
  await writeFile(tarball, archive);
  await exec('tar', ['-xzf', tarball, '-C', binaryRoot], { timeout: 30_000 });
  const bin = join(binaryRoot, 'package/bin/opencode');
  await chmod(bin, 0o755);
  await smokeOpenCode(bin, join(scratch, 'probe'), version);
  console.log(`OpenCode ${version}: authenticated HTTP/SSE and fake-provider smoke passed`);

  // Widen only after every check and cleanup has passed. Leave the verified lower bound intact.
  const ranges = join(root, 'hub/src/doctor/ranges.ts');
  const text = await readFile(ranges, 'utf8');
  const v = parseVersion(version)!;
  const below = [v[0], v[1], v[2] + 1];
  const pattern = /(opencode: \{ min: \[[\d, ]+\], below: )\[[\d, ]+\]/;
  if (!pattern.test(text)) throw new Error('cannot locate OpenCode tested range; no range updated');
  const next = text.replace(pattern, `$1[${below.join(', ')}]`);
  await writeFile(`${ranges}.tmp`, next);
  await rename(`${ranges}.tmp`, ranges);
  console.log(`PASS: tested range now >=${tested} <${below.join('.')}. Review and commit ranges.ts before the release dry run.`);
} catch (error) {
  preserveScratch = error instanceof OpenCodeCleanupError;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}\nTested range unchanged.`);
  // The release Coordinator owns filing; never write tracker files or use GitHub Issues.
  try {
    const { stdout } = await exec(process.execPath, [cli, 'task', 'list', '--kind', 'category', '--state', 'open', '--json'], { cwd: root });
    const bugs = (JSON.parse(stdout).items as Array<{ id: string; title: string }>).find(item => item.title === 'Bugs');
    if (!bugs) throw new Error('no open Bugs category');
    const body = `## Summary\n\nOpenCode ${version} failed the release-time compatibility check. The tested range was kept unchanged.\n\n${message}\n\n## Acceptance criteria\n\n- [ ] The release-time OpenCode contract and fake-provider check passes for ${version}.\n`;
    const filed = await exec(process.execPath, [cli, 'task', 'create', `OpenCode ${version} release compatibility check failed`, '--size', 'S', '--parent', bugs.id, '--label', 'bug', '--label', 'needs-triage', '--body', body, '--json'], { cwd: root });
    console.error(`Bug filed: ${JSON.parse(filed.stdout).item.id}`);
  } catch (filingError) {
    console.error(`Bug filing failed; release blocked: ${filingError instanceof Error ? filingError.message : String(filingError)}`);
  }
  process.exitCode = 1;
} finally {
  if (preserveScratch) console.error(`Cleanup incomplete; scratch retained at ${scratch}`);
  else await rm(scratch, { recursive: true, force: true });
}
