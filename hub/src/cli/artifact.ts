// The same artifact frames as spokes and the UI; relative files resolve in the calling shell.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { Artifact } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

import { ARTIFACT_USAGE } from './usage.ts';
export { ARTIFACT_USAGE } from './usage.ts';

export async function runArtifact(args: string[], cwd = process.cwd()): Promise<number> {
  const [verb, ...rest] = args;
  const command = verb === 'new' ? 'create' : verb;
  if (!command || !['create', 'list', 'promote', 'keep', 'move', 'archive', 'open'].includes(command)) throw new Error(ARTIFACT_USAGE.trim());
  const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: {
    kind: { type: 'string' }, title: { type: 'string' }, topic: { type: 'string' }, path: { type: 'string' },
    content: { type: 'string' }, 'content-file': { type: 'string' }, json: { type: 'boolean' },
    folder: { type: 'boolean' }, entry: { type: 'string' },
    release: { type: 'boolean' }, name: { type: 'string' },
  } });
  const count = command === 'promote' || command === 'move' ? 2 : ['keep', 'archive', 'open'].includes(command) ? 1 : 0;
  if (positionals.length !== count) throw new Error(ARTIFACT_USAGE.trim());
  const allowed: Record<string, string[]> = {
    create: ['kind', 'title', 'topic', 'path', 'content', 'content-file', 'folder', 'entry'],
    list: ['topic'], promote: [], keep: ['release'], move: ['name'], archive: [], open: [],
  };
  for (const option of Object.keys(values)) {
    if (option !== 'json' && !allowed[command]!.includes(option)) throw new Error(`--${option} is not accepted by artifact ${verb}`);
  }
  if (values['content-file'] !== undefined && (values.content !== undefined || values.path !== undefined)) throw new Error('give exactly one of --path, --content or --content-file');
  if (command === 'create' && (!values.kind || !values.title || !values.topic)) throw new Error(ARTIFACT_USAGE.trim());
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const contentFile = values['content-file'];
  const content = contentFile === undefined ? values.content : readFileSync(contentFile === '-' ? 0 : resolve(cwd, contentFile), 'utf8');
  const frame = command === 'open' ? { type: 'artifact.list', artifact: positionals[0] } :
    command === 'keep' ? { type: 'artifact.keep', artifact: positionals[0], kept: !values.release } :
    command === 'move' ? { type: 'artifact.move', artifact: positionals[0], folder: positionals[1], ...(values.name !== undefined ? { name: values.name } : {}) } :
    command === 'archive' ? { type: 'artifact.archive', artifact: positionals[0] } :
    command === 'promote' ? { type: 'artifact.promote', artifact: positionals[0], path: positionals[1] } : command === 'list' ? { type: 'artifact.list', ...(values.topic !== undefined ? { topic: values.topic } : {}) } : {
    type: 'artifact.create', kind: values.kind, title: values.title, topic: values.topic,
    ...(values.path !== undefined ? { path: resolve(cwd, values.path) } : {}), ...(content !== undefined ? { content } : {}),
    ...(values.folder !== undefined ? { folder: values.folder } : {}), ...(values.entry !== undefined ? { entry: values.entry } : {}),
  };
  const value = await askHubFrame(d, frame) as { artifact?: Artifact; artifacts?: Artifact[]; files?: string[]; editable?: boolean; path?: string; followUp?: { error: string } };
  if (command === 'open') {
    const a = value.artifact!;
    const path = a.folder ? join(a.path, a.entry!) : a.path;
    await access(path);
    value.path = path;
    if (!values.json) {
      if (value.editable !== true) throw new Error('agents cannot edit the human’s or an Aide’s artifacts; use open --json to read their path');
      return openEditor(path, cwd);
    }
  }
  if (value.followUp) process.stderr.write(`artifact ${command} committed; follow-up failed: ${value.followUp.error}\n`);
  const describe = (a: Artifact) => `${a.id} ${a.kind} · ${a.title}  ${a.creator} · ${a.fileDeleted ? 'file deleted' : a.promoted ? `promoted: ${a.promoted}` : a.status} · ${a.time}  ${a.path}`;
  process.stdout.write((values.json ? JSON.stringify(value) : value.artifact ? describe(value.artifact) : (value.artifacts ?? []).map(describe).join('\n')) + '\n');
  return 0;
}

function openEditor(path: string, cwd: string): Promise<number> {
  // Editor configuration may include quoted arguments. The artifact path is a separate
  // shell parameter, never interpolated into that configuration.
  const editor = process.env.VISUAL?.trim() || process.env.EDITOR?.trim() || 'nvim';
  const child = spawn('/bin/sh', ['-c', `exec ${editor} "$1"`, 'cland-artifact', path], { cwd, stdio: 'inherit' });
  const ignore = () => {};
  process.on('SIGINT', ignore); process.on('SIGQUIT', ignore);
  return new Promise((done) => {
    const finish = (code: number) => {
      process.off('SIGINT', ignore); process.off('SIGQUIT', ignore); done(code);
    };
    child.once('error', err => { process.stderr.write(`cland: cannot start editor: ${err.message}\n`); finish(1); });
    child.once('exit', (code) => finish(code ?? 1));
  });
}
