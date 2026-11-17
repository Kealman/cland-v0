import { validateInlineArtifact, INLINE_ARTIFACT_BYTES } from '../artifact-input.ts';
// The same artifact frames as spokes and the UI; relative files resolve in the calling shell.
import { read } from 'node:fs';
import { actorOf } from './actor.ts';
import { parseArgs } from 'node:util';
import { access, open } from 'node:fs/promises';
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
    'retry-key': { type: 'string' }, content: { type: 'string' }, 'content-file': { type: 'string' }, json: { type: 'boolean' },
    before: { type: 'string' }, folder: { type: 'boolean' }, entry: { type: 'string' },
    release: { type: 'boolean' }, name: { type: 'string' }, as: { type: 'string' },
  } });
  const count = command === 'promote' || command === 'move' ? 2 : ['keep', 'archive', 'open'].includes(command) ? 1 : 0;
  if (positionals.length !== count) throw new Error(ARTIFACT_USAGE.trim());
  const allowed: Record<string, string[]> = {
    create: ['retry-key', 'as', 'kind', 'title', 'topic', 'path', 'content', 'content-file', 'folder', 'entry'],
    list: ['topic', 'before'], promote: [], keep: ['release'], move: ['name'], archive: [], open: [],
  };
  for (const option of Object.keys(values)) {
    if (option !== 'json' && !allowed[command]!.includes(option)) throw new Error(`--${option} is not accepted by artifact ${verb}`);
  }
  if (values['content-file'] !== undefined && (values.content !== undefined || values.path !== undefined)) throw new Error('give exactly one of --path, --content or --content-file');
  if (command === 'create' && (!values.kind || !values.title || !values.topic)) throw new Error(ARTIFACT_USAGE.trim());
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const contentFile = values['content-file'];
  const content = contentFile === undefined ? values.content : await inlineFile(contentFile === '-' ? 0 : resolve(cwd, contentFile));
  validateInlineArtifact(content);
  const frame = command === 'open' ? { type: 'artifact.list', artifact: positionals[0] } :
    command === 'keep' ? { type: 'artifact.keep', artifact: positionals[0], kept: !values.release } :
    command === 'move' ? { type: 'artifact.move', artifact: positionals[0], folder: positionals[1], ...(values.name !== undefined ? { name: values.name } : {}) } :
    command === 'archive' ? { type: 'artifact.archive', artifact: positionals[0] } :
    command === 'promote' ? { type: 'artifact.promote', artifact: positionals[0], path: positionals[1] } : command === 'list' ? { type: 'artifact.list', ...(values.before !== undefined ? { before: values.before } : {}), ...(values.topic !== undefined ? { topic: values.topic } : {}) } : {
    type: 'artifact.create', ...(values['retry-key'] !== undefined ? { retryKey: values['retry-key'] } : {}), kind: values.kind, title: values.title, topic: values.topic,
    ...(values.path !== undefined ? { path: resolve(cwd, values.path) } : {}), ...(content !== undefined ? { content } : {}),
    ...(values.folder !== undefined ? { folder: values.folder } : {}), ...(values.entry !== undefined ? { entry: values.entry } : {}),
  };
  const as = command === 'create' ? actorOf(values, process.env, { err: s => process.stderr.write(s) }) : undefined;
  const value = await askHubFrame(d, { ...frame, ...(as ? { as } : {}) }) as { artifact?: Artifact; artifacts?: Artifact[]; before?: string; more?: boolean; files?: string[]; editable?: boolean; path?: string; followUp?: { error: string } };
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
  if (!values.json && value.more) process.stdout.write(`more: cland artifact list --before ${value.before}${values.topic ? ` --topic ${values.topic}` : ''}\n`);
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

/** Read at most the admission limit plus one byte, including pipes/stdin. */
async function inlineFile(path: string | 0): Promise<string> {
  const file = path === 0 ? undefined : await open(path, 'r');
  try {
    const bytes = Buffer.alloc(INLINE_ARTIFACT_BYTES + 1);
    let count = 0;
    while (count < bytes.length) {
      const length = file ? (await file.read(bytes, count, bytes.length - count, null)).bytesRead :
        await new Promise<number>((resolve, reject) => read(0, bytes, count, bytes.length - count, null, (error, length) => error ? reject(error) : resolve(length)));
      if (!length) break;
      count += length;
    }
    if (count > INLINE_ARTIFACT_BYTES) validateInlineArtifact('x'.repeat(count));
    const content = bytes.subarray(0, count).toString('utf8');
    validateInlineArtifact(content);
    return content;
  } finally { await file?.close(); }
}
