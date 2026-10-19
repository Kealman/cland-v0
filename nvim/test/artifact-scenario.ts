// Scripted artifact files and protocol events for recorded client screens; no hub rules.
import { mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Scenario } from './stub-hub.ts';
import { STUB_NOW } from './fixtures/clock.ts';
type Row = Record<string, unknown>;
export function artifactMessage(s: Scenario, artifact: Row, text = `▣ ${artifact.id} ${artifact.kind} · ${artifact.title}`, attached = false): Row {
  const topic = String(artifact.topic), messages = (s.messages ??= {});
  const message = { id: `artifact-message-${artifact.id}-${(messages[topic] ?? []).length}`, from: artifact.creator, fromKind: artifact.creatorKind, fromRole: artifact.creatorRole, via: 'hub', to: [], topic, ts: STUB_NOW, text, ...(attached ? { artifacts: [{ ...artifact }] } : { artifact: { ...artifact } }) };
  (messages[topic] ??= []).push(message);
  return { type: 'message', topic: { id: topic, title: s.topics?.find(t => t.id === topic)?.title ?? topic }, message };
}
export function createScenarioArtifact(s: Scenario, root: string, request: Row, actor = { name: 'human', role: '', kind: 'human' }): { artifact: Row; events: Row[] } {
  const artifacts = s.artifacts ??= [], id = `A-${artifacts.length + 1}`;
  const title = String(request.title), slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ext = request.kind === 'diagram' ? '.mmd' : request.kind === 'page' ? '.html' : '.md';
  const path = join(root, '.cland/artifacts', `${id}-${slug}${request.folder ? '' : ext}`);
  const file = request.folder ? join(path, 'index.md') : path;
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, String(request.content ?? ''));
  const artifact = { id, kind: request.kind, title, path, topic: request.topic, status: request.status ?? 'shared', creator: actor.name, creatorRole: actor.role || null, creatorKind: actor.kind, time: STUB_NOW, ...(request.folder ? { folder: true, entry: 'index.md' } : {}) };
  artifacts.push(artifact);
  const events: Row[] = [{ type: 'artifact', artifact: { ...artifact } }];
  if (artifact.status !== 'draft') events.push(artifactMessage(s, artifact));
  return { artifact, events };
}
export function changeScenarioArtifact(s: Scenario, root: string, request: Row): { artifact: Row; events: Row[] } {
  const artifact = s.artifacts?.find(a => a.id === request.artifact);
  if (!artifact) throw new Error(`no such artifact ${request.artifact}`);
  const events: Row[] = [];
  switch (request.type) {
    case 'artifact.keep': artifact.kept = request.kept; break;
    case 'artifact.promote': {
      const destination = join(root, String(request.path)); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(String(artifact.path), destination); artifact.promoted = request.path; break;
    }
    case 'artifact.move': {
      const folder = s.artifacts?.find(a => a.id === request.folder)!;
      const name = String(request.name ?? 'moved.md');
      renameSync(String(artifact.path), join(String(folder.path), name));
      artifact.movedTo = { folder: folder.id, path: name };
      events.push({ type: 'artifact', artifact: { ...folder } }); break;
    }
    case 'prompt.send': artifact.status = 'sent'; events.push(artifactMessage(s, artifact, readFileSync(String(artifact.path), 'utf8'), true)); break;
  }
  // History snapshots resolve creation chips against the latest artifact metadata.
  for (const messages of Object.values(s.messages ?? {})) for (const message of messages) {
    if ((message.artifact as Row | undefined)?.id === artifact.id) message.artifact = { ...artifact };
  }
  events.unshift({ type: 'artifact', artifact: { ...artifact } });
  return { artifact, events };
}
