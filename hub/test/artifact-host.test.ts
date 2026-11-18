// T2: artifact source operations through public creation and recording Host ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifact } from '../src/hub/artifacts.ts';
import { recordingHost } from './recording-host.ts';
import { Store } from '../src/hub/store.ts';
import { tempProject } from './harness.ts';

test('artifact source type and binary bytes are read only on the supplied Host', async t => {
  const root = await tempProject(t);
  const store = new Store(':memory:');
  t.after(() => store.close());
  const calls: string[] = [];
  const host = { ...recordingHost(root), fileType: async (path: string) => { calls.push(`type:${path}`); return 'file' as const; }, readFile: async (path: string) => { calls.push(`read:${path}`); return new Uint8Array([0, 255, 10]); } };
  const artifact = await createArtifact(store, root, { type: 'artifact.create', id: 'file', kind: 'file', title: 'Bytes', path: 'bytes.bin', topic: 'general' },
    { name: 'worker', cwd: '/host-only', kind: 'agent', role: () => null }, () => {}, work => work(), () => {}, async () => { throw new Error('legacy read must not run'); }, undefined, host);
  assert.deepEqual(calls, ['type:/host-only/bytes.bin', 'read:/host-only/bytes.bin']);
  assert.deepEqual(await readFile(artifact.path), Buffer.from([0, 255, 10]));
});

test('folder source listing and nested files remain on its Host', async t => {
  const root = await tempProject(t);
  const store = new Store(':memory:');
  t.after(() => store.close());
  const calls: string[] = [];
  const host = { ...recordingHost(root), fileType: async () => 'directory' as const, listFolder: async (path: string) => { calls.push(`list:${path}`); return ['index.md', 'nested/data.bin']; }, readFile: async (path: string) => { calls.push(`read:${path}`); return Buffer.from(path.endsWith('.md') ? '# Entry' : 'nested bytes'); } };
  const artifact = await createArtifact(store, root, { type: 'artifact.create', id: 'folder', kind: 'note', title: 'Folder', path: 'folder', topic: 'general' },
    { name: 'worker', cwd: '/host-only', kind: 'agent', role: () => null }, () => {}, work => work(), () => {}, readFile, undefined, host);
  assert.deepEqual(calls, ['list:/host-only/folder', 'read:/host-only/folder/index.md', 'read:/host-only/folder/nested/data.bin']);
  assert.equal(artifact.entry, 'index.md');
  assert.equal(await readFile(`${artifact.path}/nested/data.bin`, 'utf8'), 'nested bytes');
});

test('session frames resolve relative paths through Sessions Host while human frames use local', async t => {
  const { startHub, inProcessSpoke } = await import('./harness.ts');
  const { Sessions } = await import('../src/adapters/sessions.ts');
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { writeFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  const hub = await startHub({ control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} } });
  t.after(() => hub.close());
  const table = new ProcessTable(':memory:', hub.core.clock);
  const calls: string[] = [];
  const host = { ...recordingHost(root), fileType: async (path: string) => { calls.push(`type:${path}`); return 'file' as const; }, readFile: async (path: string) => { calls.push(`read:${path}`); return Buffer.from('session bytes'); } };
  const sessions = new Sessions({ root, core: hub.core, table, hosts: [host] });
  hub.dispatcher.useSessions(sessions);
  t.after(async () => { await sessions.close(); table.close(); });
  const spoke = await inProcessSpoke(t, { hub, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  const result = await spoke.call<{ artifact: import('../src/protocol.ts').Artifact }>('artifact.create', { kind: 'file', title: 'Session', path: 'absent.bin', topic: 'general' });
  assert.ok(result.artifact, JSON.stringify(result));
  assert.equal(await readFile(result.artifact.path, 'utf8'), 'session bytes');
  assert.deepEqual(calls, [`type:${root}/absent.bin`, `read:${root}/absent.bin`]);
  await writeFile(`${root}/human.txt`, 'human bytes');
  const { createSocketEdge } = await import('../src/hub/socket.ts');
  const { fixtureSocketPath } = await import('../../test-support/socket-path.ts');
  const { sessionUi } = await import('./session-credential-fixture.ts');
  const { TEST_SECRET } = await import('./harness.ts');
  const socket = fixtureSocketPath(root, 'artifact-host.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await sessionUi(t, { root, socket, secret: TEST_SECRET }, 'cli');
  t.after(() => ui.close());
  const human = await ui.request({ type: 'artifact.create', kind: 'file', title: 'Human', path: 'human.txt', topic: 'general' });
  assert.equal(human.ok, true, JSON.stringify(human));
  assert.equal(await readFile((human.value as { artifact: { path: string } }).artifact.path, 'utf8'), 'human bytes');
  assert.equal(calls.length, 2);
});

test('upload checks stored attachment types on local Host while new bytes stay in the frame', async t => {
  const { uploadArtifacts } = await import('../src/hub/artifact-upload.ts');
  const root = await tempProject(t);
  const store = new Store(':memory:');
  t.after(() => store.close());
  const existing = await createArtifact(store, root, { type: 'artifact.create', id: 'existing', kind: 'note', title: 'Existing', content: 'old', topic: 'general' },
    { name: 'human', cwd: root, kind: 'human', role: () => null }, () => {}, work => work(), () => {}, readFile);
  const calls: string[] = [];
  const host = { ...recordingHost(root), fileType: async (path: string) => { calls.push(path); return 'missing' as const; }, readFile: async () => { throw new Error('upload bytes are frame-owned'); } };
  await assert.rejects(uploadArtifacts(store, root, { type: 'artifact.upload', id: 'upload', topic: 'general', artifacts: [existing.id], files: [{ name: 'new.txt', mime: 'text/plain', data: 'bmV3' }] }, undefined, 50, artifacts => artifacts, () => {}, () => undefined, work => work(), () => new Date(), undefined, undefined, false, host), /artifact file unavailable/);
  assert.deepEqual(calls, [existing.path]);
  assert.equal(store.artifacts().length, 1);
});
