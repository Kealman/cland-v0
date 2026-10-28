// T2: binary upload through the human frame protocol; native gateway covered below.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { connectUi, projectHub, tempProject } from './harness.ts';
import type { Artifact, TopicMessage } from '../src/protocol.ts';

test('artifact.upload stores two files on exactly one human message without a chip post', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const files = [{ name: '../picture.png', mime: 'image/png', data: Buffer.from('png bytes').toString('base64') }, { name: 'report.pdf', mime: 'application/pdf', data: Buffer.from('pdf bytes').toString('base64') }];
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const published = ui.waitFor(f => f.type === 'artifact' && (f.artifact as Artifact).title === 'report.pdf');
  const result = await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'Two files', files });
  assert.equal(result.ok, true, result.error);
  await published;
  const { message, artifacts } = result.value as { message: TopicMessage; artifacts: Artifact[] };
  assert.equal(message.from, 'human');
  assert.equal(message.text, 'Two files');
  assert.deepEqual(message.artifacts, artifacts);
  assert.equal(artifacts.length, 2);
  assert.deepEqual(ui.frames.filter(f => f.type === 'artifact').map(f => (f.artifact as Artifact).id), artifacts.map(a => a.id));
  for (const [i, ext] of ['.png', '.pdf'].entries()) {
    assert.ok(artifacts[i]!.path.endsWith(ext));
    assert.equal(artifacts[i]!.creator, 'human');
    assert.equal(await readFile(artifacts[i]!.path, 'utf8'), i === 0 ? 'png bytes' : 'pdf bytes');
  }
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.map(m => m.id), [message.id]);
});

test('artifact.upload validates every file and rolls back a rejected message', async t => {
  const root = await tempProject(t);
  const { writeFile, readdir, mkdir } = await import('node:fs/promises');
  await mkdir(`${root}/.cland`, { recursive: true });
  await writeFile(`${root}/.cland/config.toml`, '[artifacts]\nmax_upload_mb = 0.0009765625\n');
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const file = { name: 'ok.png', mime: 'image/png', data: 'YQ==' };
  for (const files of [[file, { ...file, data: Buffer.alloc(1025).toString('base64') }], Array(11).fill(file), [file, { ...file, data: '%' }]]) {
    const result = await ui.request({ type: 'artifact.upload', topic: 'general', files });
    assert.equal(result.ok, false);
    assert.equal((result as { code?: string }).code, 'invalid_argument');
    assert.deepEqual((await ui.request({ type: 'artifact.list', topic: 'general' })).value, { artifacts: [] });
    assert.deepEqual(await readdir(`${root}/.cland/artifacts`).catch(() => []), []);
    assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  }
  const failed = await ui.request({ type: 'artifact.upload', topic: 'agents', files: [file] });
  assert.equal(failed.ok, false);
  assert.deepEqual((await ui.request({ type: 'artifact.list' })).value, { artifacts: [] });
  assert.deepEqual(await readdir(`${root}/.cland/artifacts`), []);
});

test('gateway upload uses native bytes and ingress, preserves send authority and refuses sessions', async t => {
  const { testMessenger } = await import('./fakes/messenger.ts');
  const { inProcessSpoke } = await import('./harness.ts');
  const root = await tempProject(t);
  const remote = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery);
  const frame = { type: 'artifact.upload', topic: 'general', files: [{ name: 'photo', mime: 'image/png' }] };
  const receipt = remote.client.waitFor(f => f.type === 'result' && f.id === 'native-upload');
  remote.upload({ ...frame, caption: 'See https://example.test/file', id: 'native-upload' }, { chatId: '1', messageId: '2' }, [Buffer.from('native png')]);
  const first = await receipt;
  assert.equal(first.ok, true, String(first.error));
  const value = first.value as { message: TopicMessage; artifacts: Artifact[] };
  assert.equal(value.message.via, 'telegram');
  assert.equal(value.message.text, 'See [redacted]');
  assert.equal(await readFile(value.artifacts[0]!.path, 'utf8'), 'native png');
  assert.ok(value.artifacts[0]!.path.endsWith('.png'));
  const replay = remote.client.waitFor(f => f.type === 'result' && f.id === 'replay');
  remote.upload({ ...frame, id: 'replay' }, { chatId: '1', messageId: '2' }, [Buffer.from('different')]);
  assert.equal(((await replay).value as typeof value).message.id, value.message.id);
  const topic = ((await ui.request({ type: 'topic.create', title: 'Other' })).value as { topic: { id: string } }).topic.id;
  const forbidden = await remote.client.request({ ...frame, topic });
  assert.equal((forbidden as { code?: string }).code, 'forbidden');
  assert.equal(((await remote.client.request({ type: 'topic.send', topic: 'general', text: 'forged', artifacts: [value.artifacts[0]!.id] })) as { code?: string }).code, 'forbidden');
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'upload-session' });
  t.after(() => spoke.close());
  const { sessionUi } = await import('./session-credential-fixture.ts');
  const session = await sessionUi(t, hub.discovery);
  const refused = await session.request({ ...frame, as: { name: 'coord', sessionId: 'upload-session' } });
  assert.equal((refused as { code?: string }).code, 'forbidden');
  assert.equal(((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts.length, 1);
});

test('artifact.upload rejects registered secrets in text and binary while preserving clean bytes', async t => {
  const { mkdir, writeFile, readdir } = await import('node:fs/promises');
  const { testMessenger } = await import('./fakes/messenger.ts');
  const root = await tempProject(t);
  await mkdir(`${root}/.cland`, { recursive: true });
  const fakeSecret = 'made-up-upload-secret-1382';
  await writeFile(`${root}/.cland/secrets.toml`, `[speech]\nelevenlabs_key = "${fakeSecret}"\n`);
  const remote = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery);
  for (const [i, mime] of ['text/plain', 'application/octet-stream'].entries()) {
    const bytes = i === 0 ? Buffer.from(`text ${fakeSecret}`) : Buffer.concat([Buffer.from([0, 255]), Buffer.from(fakeSecret), Buffer.from([128, 0])]);
    const receipt = remote.client.waitFor(f => f.type === 'result' && f.id === `secret-${i}`);
    remote.upload({ type: 'artifact.upload', id: `secret-${i}`, topic: 'general', files: [{ name: `unsafe-${i}`, mime }] }, { chatId: '1', messageId: `secret-${i}` }, [bytes]);
    const result = await receipt;
    assert.equal(result.ok, false);
    assert.equal(result.code, 'secret-in-upload');
    const socket = await ui.request({ type: 'artifact.upload', topic: 'general', files: [{ name: `unsafe-${i}`, mime, data: bytes.toString('base64') }] });
    assert.equal((socket as { code?: string }).code, 'secret-in-upload');
    assert.ok(!JSON.stringify(socket).includes(fakeSecret));
    assert.ok(!JSON.stringify(result).includes(fakeSecret));
    assert.ok(String(result.error).includes(`unsafe-${i}`));
    assert.deepEqual((await ui.request({ type: 'artifact.list' })).value, { artifacts: [] });
    assert.deepEqual(await readdir(`${root}/.cland/artifacts`).catch(() => []), []);
    assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  }
  const bytes = Buffer.from([0, 255, 128, 1, 2]);
  const result = await ui.request({ type: 'artifact.upload', topic: 'general', files: [{ name: 'clean', mime: 'application/octet-stream', data: bytes.toString('base64') }] });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(await readFile((result.value as { artifacts: Artifact[] }).artifacts[0]!.path), bytes);
});
