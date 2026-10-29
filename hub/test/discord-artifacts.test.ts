// T2: production General frames and loopback Discord native receipts.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until, connectUi } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { abortable } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { FakeClock } from './fake-clock.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';

type StartupControl = {
  hold: (close: () => Promise<void>, state: import('../src/remote/state.ts').RemoteStore) => Promise<void>;
  stopped: () => void;
};
async function fixture(t: TestContext, publishHeld = true, startup?: StartupControl) {
  const exchange = await discordExchangeOwner(t, { publishHeld }).start();
  const { fake, run } = exchange; await fake.control('configure', {sendLimit:100});
  const { root } = await exchange.project();
  const config = defaultConfig('Rendering fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  await run(async () => {
    const acquired = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN } });
    try { await startup?.hold(exchange.close, state); }
    finally {
      hub = acquired;
      // close() may have run its registered stop before acquisition returned.
      // Keep startup pending until this late subject has actually stopped.
      if (exchange.signal.aborted) { await hub.stop(); startup?.stopped(); }
    }
  });
  exchange.signal.throwIfAborted();
  const subject = hub!;
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const send = (text: string, kind = 'report') => run(async () => {
    assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text, kind })).ok, true);
  });
  const settled = async (count: number) => {
    await until(() => state.outbox().filter(j => j.state === 'sent').length === count, { timeoutMs: 2000, what: 'exact durable rendered part settlements' });
    return fake.control('state');
  };
  return { root, coord, ...exchange, hub: subject, store, state, send, settled };
}

test('Discord agent image and PDF travel together once with header and later sent-above references', async t => {
  const f = await fixture(t);
  f.state.set('mute', 'true');
  const artifacts: string[] = [];
  for (const [name, bytes] of [['picture.png', 'PNG fixture'], ['report.pdf', 'PDF fixture']]) {
    const path = join(f.root, name!); await writeFile(path, bytes!);
    const created = await f.coord.call<{ artifact: { id: string } }>('artifact.create', { topic: 'general', kind: 'file', title: name, path });
    artifacts.push(created.artifact.id);
  }
  f.state.set('mute', 'false');
  assert.equal((await f.coord.call<{ok:boolean}>('send', { topic: 'general', text: 'Files', artifacts })).ok, true);
  const native = await f.settled(2);
  const files = native.messages.filter(m => m.content === 'coord · report');
  assert.equal(files.length, 1);
  const upload = native.requests.find(r => r.body.attachments);
  assert.ok(upload, 'multipart upload receipt');
  assert.deepEqual(upload.body.attachments, [{ id: 0, filename: 'A-1-picture-png.png' }, { id: 1, filename: 'A-2-report-pdf.pdf' }]);
  await f.coord.call('send', { topic: 'general', text: 'Again', artifacts });
  await f.settled(5);
  const after = await f.fake.control('state');
  assert.equal(after.requests.filter(r => r.body.attachments).length, 1);
  assert.equal(after.messages.filter(m => m.content.includes('(sent above)')).length, 2);
  await f.hub.stop();
});

async function artifacts(f: Awaited<ReturnType<typeof fixture>>, sizes: number[]) {
  f.state.set('mute', 'true');
  const ids: string[] = [];
  for (const [i, size] of sizes.entries()) {
    const path = join(f.root, `file-${i}.bin`); await writeFile(path, 'x'); await truncate(path, size);
    const result = await f.coord.call<{artifact:{id:string}}>('artifact.create', {topic:'general',kind:'file',title:`File ${i}`,path});
    ids.push(result.artifact.id);
  }
  f.state.set('mute', 'false'); return ids;
}

test('Discord repeated single artifact preserves the new short caption before one sent-above reference', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f, [32]);
  await f.coord.call('send', { topic: 'general', text: 'Original caption', artifacts: attached });
  const first = await f.settled(1);
  assert.equal(first.uploads.length, 1);
  assert.equal(first.messages[0]!.content, 'coord · report\nOriginal caption');
  await f.coord.call('send', { topic: 'general', text: 'A new short caption', artifacts: attached });
  const after = await f.settled(2);
  assert.equal(after.uploads.length, 1);
  assert.equal(after.messages.length, 2);
  assert.equal(after.messages[1]!.content, `coord · report\nA new short caption\n▣ ${attached[0]} File 0 (sent above)`);
  assert.equal(after.messages[1]!.content.match(/\(sent above\)/g)?.length, 1);
  await f.hub.stop();
});

test('Discord twelve artifacts totalling 30 MiB respect file count and request byte limits', async t => {
  const f = await fixture(t);
  const ids = await artifacts(f, Array(12).fill(2621440));
  await f.coord.call('send', {topic:'general',text:'Batch',artifacts:ids});
  const native = await f.settled(3);
  assert.equal(native.uploads.length, 12);
  assert.equal(new Set(native.uploads.map(u => u.name)).size, 12);
  assert.equal(native.uploads.reduce((n,u)=>n+u.size,0),31457280);
  for (const m of native.messages) {
    const files = native.uploads.filter(u=>u.message===m.id);
    assert.ok(files.length <= 10);
    assert.ok(files.reduce((n,u)=>n+u.size,0) <= 26214400);
  }
  await f.hub.stop();
});

test('Discord oversized 21 MiB artifact becomes one named path line', async t => {
  const f = await fixture(t);
  const ids = await artifacts(f,[22020096]);
  await f.coord.call('send', {topic:'general',text:'',artifacts:ids});
  const native = await f.settled(1);
  assert.equal(native.uploads.length,0);
  assert.equal(native.messages.length,1);
  assert.match(native.messages[0]!.content,/▣ A-1 File 0 · 22020096 bytes · \.cland\/artifacts\//);
  await f.hub.stop();
});

test('Discord mirrors an actual Telegram gateway photo upload once with its origin header', async t => {
  const f = await fixture(t); await f.hub.stop();
  const { testMessenger } = await import('./fakes/messenger.ts');
  const telegram = testMessenger();
  const owner = pacingOwner(t);
  f.stop(()=>owner.dispose());
  const hub = await owner.start(f.root,{},realClock,{hubOptions:{gatewayRemotes:[telegram]}});
  const received = owner.observe(async signal => {
    const raw = telegram.client.waitFor(frame=>frame.type==='result' && frame.id==='photo', 1000);
    try { return await abortable(raw,signal); }
    finally { await Promise.allSettled([raw]); }
  });
  void received.catch(()=>{});
  telegram.upload({type:'artifact.upload',topic:'general',id:'photo',files:[{name:'photo.png',mime:'image/png'}]}, {chatId:'101',messageId:'201'}, [Buffer.from('photo bytes')]);
  assert.equal((await received).ok,true);
  const frame = telegram.client.frames.find(frame=>frame.type==='message' && (frame.message as {via?:string}).via==='telegram');
  assert.ok(frame);
  const { DiscordRemote } = await import('../src/remote/discord.ts');
  const adapter = new DiscordRemote(f.api,DISCORD_TEST_TOKEN,realClock,{store:f.state, files:{root:f.root,artifact:id=>f.store.artifact(id)}});
  f.stop(()=>adapter.stop());
  await adapter.receive(frame as never); await adapter.receive(frame as never);
  const native = await f.fake.control('state');
  assert.equal(native.uploads.length,1);
  assert.equal(native.messages[0]!.content,'you (Telegram) · message');
  await adapter.stop(); await owner.dispose();
  await hub.stopped;
  assert.equal(telegram.stopped,true);
  assert.equal(owner.observations(),0);
});

test('Discord timed-out accepted multipart retries its original nonce without a second file publication', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f,[32]);
  f.state.set('mute','true');
  await f.coord.call('send',{topic:'general',text:'Retry',artifacts:attached});
  const ui = await connectUi(t,f.hub.discovery);
  const h = await ui.request({type:'topic.history',topic:'general'});
  const message = (h.value as {messages:import('../src/protocol.ts').Message[]}).messages.at(-1)!;
  await f.hub.stop(); f.state.set('mute','false');
  const { DiscordApi } = await import('../src/remote/discord-api.ts');
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const api = new DiscordApi(DISCORD_TEST_TOKEN,{apiRoot:f.fake.url,timeoutMs:50});
  const box = new DiscordOutbox(api,f.state,realClock,f.signal,{root:f.root,artifact:id=>f.store.artifact(id)});
  f.stop(()=>box.stop());
  await f.fake.control('fault',{response:'holdStored',method:'POST'});
  const held = f.run(signal=>f.fake.waitForHold(signal));
  const pending = f.run(()=>box.publication(ids.channel,message,'coord · report',false));
  await held; await pending;
  const native = await f.fake.control('state');
  assert.equal(native.messages.length,1);
  assert.equal(native.uploads.length,1);
  const attempts = native.requests.filter(r=>r.body.attachments);
  assert.equal(attempts.length,2);
  assert.equal(attempts[0]!.body.nonce,attempts[1]!.body.nonce);
  assert.equal(f.state.outbox().filter(j=>j.state==='sent').length,1);
  await box.stop();
});

test('Discord started artifact publication stays contiguous ahead of a later card', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f,[32,64]);
  const held = f.run(signal=>f.fake.waitForHold(signal));
  await f.fake.control('fault',{response:'hold',method:'POST'});
  await f.coord.call('send',{topic:'general',text:'First',artifacts:attached});
  await held;
  await f.coord.call('ask',{topic:'general',question:'Urgent?',options:['Keep']});
  await until(()=>f.state.outbox().some(j=>j.kind==='card'),{timeoutMs:2000,what:'durable later card'});
  await f.fake.control('release',{});
  const native = await f.settled(3);
  assert.equal(native.messages[1]!.content,'coord · report');
  assert.ok(native.messages[2]!.content.includes('Urgent?'));
  await f.hub.stop();
});

test('Discord fake rejects multipart envelope overflow with individually legal files', async t => {
  const f = await discordExchangeOwner(t).start();
  const { DiscordError } = await import('../src/remote/discord-api.ts');
  const body = new Blob([Buffer.alloc(13107200)]);
  await assert.rejects(f.api.createMessage(ids.channel, {nonce:'envelope-limit',content:'Header',files:[{name:'one.bin',body},{name:'two.bin',body}]}), (error: unknown) => error instanceof DiscordError && error.status === 400);
  const native = await f.fake.control('state');
  assert.equal(native.messages.length,0);
  assert.equal(native.uploads.length,0);
});

for (const aborted of [false,true]) test(`Discord Telegram-origin owner drains ${aborted ? 'aborted' : 'omitted'} setup before Store close`, async t => {
  const f = await fixture(t); await f.hub.stop();
  const { testMessenger } = await import('./fakes/messenger.ts');
  const telegram = testMessenger();
  const owner = pacingOwner(t); f.stop(()=>owner.dispose());
  const clock = new FakeClock(), abort = new AbortController();
  const starting = owner.start(f.root,{},realClock,{hubOptions:{gatewayRemotes:[telegram]},clock,signal:abort.signal,receipt:new Promise<void>(()=>{})});
  const rejected = assert.rejects(starting,/cancelled|aborted|deadline/); void rejected.catch(()=>{});
  const hub = await f.run(()=>owner.serving);
  if (aborted) abort.abort(new Error('aborted setup control')); else await clock.advance(1000);
  await rejected; await hub.stopped;
  assert.equal(telegram.stopped,true);
  assert.equal(owner.observations(),0);
  assert.doesNotThrow(()=>f.state.outbox());
});

test('Discord Telegram-origin owner joins an omitted photo result observer on cancellation', async t => {
  const f = await fixture(t); await f.hub.stop();
  const { testMessenger } = await import('./fakes/messenger.ts');
  const telegram = testMessenger();
  const owner = pacingOwner(t); f.stop(()=>owner.dispose());
  const hub = await owner.start(f.root,{},realClock,{hubOptions:{gatewayRemotes:[telegram]}});
  let joined = false;
  const observed = owner.observe(async signal=>{
    const raw = telegram.client.waitFor(frame=>frame.type==='result' && frame.id==='omitted-photo',100);
    try { return await abortable(raw,signal); }
    finally { await Promise.allSettled([raw]); joined=true; }
  });
  const rejected = assert.rejects(observed,/cancelled|no frame/); void rejected.catch(()=>{});
  await owner.dispose(); await rejected; await hub.stopped;
  assert.equal(joined,true);
  assert.equal(owner.observations(),0);
  assert.equal(telegram.stopped,true);
  assert.doesNotThrow(()=>f.state.outbox());
});

test('Discord partial file fallback never claims an unread file was sent above on repeat', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f,[32,64]);
  const held = f.run(signal=>f.fake.waitForHold(signal));
  await f.fake.control('fault',{response:'hold',method:'POST'});
  await f.coord.call('send',{topic:'general',text:'Partial',artifacts:attached}); await held;
  const { unlink } = await import('node:fs/promises');
  const missing = f.store.artifact(attached[1]!)!.path;
  await unlink(missing);
  await f.fake.control('release',{}); await f.settled(2);
  await writeFile(missing,'restored');
  await f.coord.call('send',{topic:'general',text:'Repeat',artifacts:attached});
  const native = await f.settled(5);
  assert.equal(native.uploads.length,1);
  const fallback = native.messages.find(m=>m.content.includes(attached[1]!) && !m.content.includes('file unavailable'));
  assert.ok(fallback);
  assert.ok(!fallback.content.includes('(sent above)'));
  assert.match(fallback.content,/not uploaded|delivery unconfirmed/);
  await f.hub.stop();
});

test('Discord small artifacts split at ten files independently of the byte budget', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f,Array(12).fill(32));
  await f.coord.call('send',{topic:'general',text:'Count boundary',artifacts:attached});
  const native = await f.settled(3);
  assert.deepEqual(native.messages.slice(1).map(m=>native.uploads.filter(u=>u.message===m.id).length),[10,2]);
  assert.equal(new Set(native.uploads.map(u=>u.name)).size,12);
  await f.hub.stop();
});

test('Discord accepted unknown multipart keeps artifact identity across reopen with a missing file', async t => {
  const f = await fixture(t);
  const attached = await artifacts(f,[32]);
  f.state.set('mute','true');
  await f.coord.call('send',{topic:'general',text:'Original',artifacts:attached});
  const ui = await connectUi(t,f.hub.discovery);
  const history = await ui.request({type:'topic.history',topic:'general'});
  const message = (history.value as {messages:import('../src/protocol.ts').Message[]}).messages.at(-1)!;
  await f.hub.stop(); f.state.set('mute','false');
  const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
  const abort = new AbortController();
  const files = {root:f.root,artifact:(id:string)=>f.store.artifact(id)};
  const original = new DiscordOutbox(f.api,f.state,realClock,AbortSignal.any([f.signal,abort.signal]),files);
  f.stop(()=>original.stop());
  const held = f.run(signal=>f.fake.waitForHold(signal));
  await f.fake.control('fault',{response:'holdStored',method:'POST'});
  const sending = f.run(()=>original.publication(ids.channel,message,'coord · report',false));
  await held;
  const { DatabaseSync, backup } = await import('node:sqlite');
  const reader = new DatabaseSync(join(f.root,'.cland/hub.db'),{readOnly:true});
  const snapshot = join(f.root,'unknown.db');
  try { await backup(reader,snapshot); } finally { reader.close(); }
  abort.abort(); await sending; await original.stop();
  await until(()=>f.fake.receipts().held===0 && f.fake.receipts().handlers===0,{timeoutMs:2000,what:'aborted accepted multipart native close receipt'});
  const { unlink } = await import('node:fs/promises');
  const path = f.store.artifact(attached[0]!)!.path; await unlink(path);
  const recovered = new Store(snapshot); f.afterDrain(()=>recovered.close());
  const state = recovered.remotes.forMessenger('discord');
  const box = new DiscordOutbox(f.api,state,realClock,f.signal,files); f.stop(()=>box.stop());
  await f.run(()=>box.resume());
  assert.equal(state.outbox().filter(j=>j.state==='sent').length,1);
  await writeFile(path,'restored');
  await f.run(()=>box.publication(ids.channel,{...message,id:'later-attachment'},'coord · report',false));
  const native = await f.fake.control('state');
  assert.equal(native.uploads.length,1);
  assert.equal(native.messages.length,2);
  assert.match(native.messages[1]!.content,/\(sent above\)/);
  await box.stop();
});
