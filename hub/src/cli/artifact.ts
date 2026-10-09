// The same artifact frames as spokes and the UI; relative files resolve in the calling shell.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { Artifact } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

export const ARTIFACT_USAGE = `  artifact create --kind prompt|note|page|diagram|file --title <title> --topic <topic>
                  --path <file> | --content <text> | --content-file <file|-> (stdin with -)
  artifact promote <A-id> <project-relative-path> [--json]
  artifact list [--topic <topic>] [--json]
                  persistent files shown in topics; all commands accept --json
`;

export async function runArtifact(args: string[], cwd = process.cwd()): Promise<number> {
  const [command, ...rest] = args;
  if (command !== 'create' && command !== 'list' && command !== 'promote') throw new Error(`usage: cland artifact create|list|promote\n${ARTIFACT_USAGE}`);
  const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: {
    kind: { type: 'string' }, title: { type: 'string' }, topic: { type: 'string' }, path: { type: 'string' },
    content: { type: 'string' }, 'content-file': { type: 'string' }, json: { type: 'boolean' },
  } });
  if (command === 'promote' ? positionals.length !== 2 : positionals.length !== 0) throw new Error(ARTIFACT_USAGE.trim());
  if (values['content-file'] !== undefined && (values.content !== undefined || values.path !== undefined)) throw new Error('give exactly one of --path, --content or --content-file');
  if (command === 'create' && (!values.kind || !values.title || !values.topic)) throw new Error(ARTIFACT_USAGE.trim());
  if (command === 'promote' && [values.kind, values.title, values.topic, values.path, values.content, values['content-file']].some(v => v !== undefined)) throw new Error('artifact promote accepts only the artifact id, project-relative destination and --json');
  if (command === 'list' && [values.kind, values.title, values.path, values.content, values['content-file']].some((v) => v !== undefined)) throw new Error('artifact list accepts only --topic and --json');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const contentFile = values['content-file'];
  const content = contentFile === undefined ? values.content : readFileSync(contentFile === '-' ? 0 : resolve(cwd, contentFile), 'utf8');
  const frame = command === 'promote' ? { type: 'artifact.promote', artifact: positionals[0], path: positionals[1] } : command === 'list' ? { type: 'artifact.list', ...(values.topic !== undefined ? { topic: values.topic } : {}) } : {
    type: 'artifact.create', kind: values.kind, title: values.title, topic: values.topic,
    ...(values.path !== undefined ? { path: resolve(cwd, values.path) } : {}), ...(content !== undefined ? { content } : {}),
  };
  const value = await askHubFrame(d, frame) as { artifact?: Artifact; artifacts?: Artifact[]; followUp?: { error: string } };
  if (value.followUp) process.stderr.write(`artifact promoted; notification failed: ${value.followUp.error}\n`);
  const describe = (a: Artifact) => `${a.id} ${a.kind} · ${a.title}  ${a.creator} · ${a.fileDeleted ? 'file deleted' : a.promoted ? `promoted: ${a.promoted}` : a.status} · ${a.time}  ${a.path}`;
  process.stdout.write((values.json ? JSON.stringify(value) : value.artifact ? describe(value.artifact) : (value.artifacts ?? []).map(describe).join('\n')) + '\n');
  return 0;
}
