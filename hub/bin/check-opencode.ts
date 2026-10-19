#!/usr/bin/env node
// Opt-in informational release check; network/probe errors fail, compatibility differences do not.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterEventNames, compareEventNames, compareOpenCodeContract, OPERATIONS, type OpenApi } from '../src/doctor/opencode-contract.ts';
import { compareVersions, formatVersion, parseVersion, TESTED_RANGES } from '../src/doctor/ranges.ts';

const installedRoot = fileURLToPath(new URL('../../', import.meta.url));
const source = (version: string, path: string) => `https://raw.githubusercontent.com/anomalyco/opencode/v${version}/${path}`;
async function download(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return res.text();
}

type CheckOptions = {
  root?: string;
  download?: (url: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
};

/** The CLI's read-only probe, with offline downloads and captured output for recorded-document tests. */
export async function runOpenCodeCheck(options: CheckOptions = {}): Promise<0 | 1> {
  const root = options.root ?? installedRoot;
  const get = options.download ?? download;
  const out = options.stdout ?? console.log;
  const err = options.stderr ?? console.error;
  const json = async (url: string) => JSON.parse(await get(url));
  try {
    const registry = await json('https://registry.npmjs.org/@opencode/cli');
    const versions = Object.keys(registry.versions).filter(v => /^2\.\d+\.\d+$/.test(v));
    versions.sort((a, b) => compareVersions(parseVersion(a)!, parseVersion(b)!));
    const version = versions.at(-1);
    if (!version) throw new Error('registry contains no stable OpenCode 2.x release');
    const tested = formatVersion(TESTED_RANGES.opencode.min);
    out(`OpenCode release check (informational): tested ${tested}, newest stable 2.x ${version}`);
    const docs = await Promise.all([tested, version].map(v => json(source(v, 'packages/protocol/openapi.json')) as Promise<OpenApi>));
    const differences = compareOpenCodeContract(docs[0]!, docs[1]!);
    const eventFiles = ['session-event.ts', 'permission.ts', 'form.ts'];
    const upstreamEvents = await Promise.all([tested, version].map(async v => (await Promise.all(eventFiles.map(p => get(source(v, `packages/schema/src/${p}`))))).join('\n')));
    const adapter = await Promise.all(['hub/src/adapters/opencode.ts', 'hub/src/adapters/opencode/state.ts'].map(p => readFile(join(root, p), 'utf8')));
    const names = adapterEventNames(adapter);
    if (!names.length) throw new Error('no adapter event names found');
    differences.push(...compareEventNames(names, upstreamEvents[0]!, upstreamEvents[1]!));
    if (differences.length) out(`Differences (informational; include in the release report):\n${differences.join('\n')}`);
    else out(`${OPERATIONS.length} wire operations and ${names.length} adapter event names compatible`);
    return 0;
  } catch (error) {
    err(`OpenCode release check could not complete: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runOpenCodeCheck();
