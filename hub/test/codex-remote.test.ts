// T2: frame launch and delivery with a recording fake Host and scripted Codex; no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath, symlink } from 'node:fs/promises';
import { setRoleKey } from '../src/roles/editor.ts';
import { join, dirname } from 'node:path';
import { CodexAdapter } from '../src/adapters/codex.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { localHost } from '../src/host/local.ts';
import type { Host, HostCommand } from '../src/host/host.ts';
import { ScriptedCodex, deferred } from './fakes/scripted-codex.ts';
import { projectHub, connectUi, tempProject, eventually, inProcessSpoke } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';

test('remote Codex frame launch uses a session forward and host sandbox paths', async t => {
  const root = await tempProject(t);
  const remote = await tempProject(t);
  const hostTemp = join(remote, 'temp-root');
  const hostTempAlias = join(remote, 'tmp-alias');
  await mkdir(hostTemp);
  await symlink(hostTemp, hostTempAlias);
  const run = dirname(fixtureSocketPath(remote, 'remote'));
  const localSocket = fixtureSocketPath(root, 'forward');
  const layout = { discoveryFile: join(remote, 'hub.json'), runDirectory: run, logDirectory: join(remote, 'log'), node: '/remote/node', cli: '/remote/cli', spoke: '/remote/spoke' };
  const native = new ScriptedCodex();
  native.thread = 'remote-thread';
  native.handlers.set('thread/start', () => ({ thread: { id: native.thread, status: { type: 'idle' } } }));
  const commands: HostCommand[] = [], versions: HostCommand[] = [];
  const forwards: string[] = [], releases: string[] = [], stops: number[] = [];
  let exit = deferred<{code: number | null; signal: string | null}>();
  let alive = false;
  let refuseRealpath = false;
  const base = localHost();
  const canonicalized: string[] = [];
  const host: Host = { ...base, name: 'f1', layout: () => layout,
    realpath: async path => { canonicalized.push(path); if (refuseRealpath) throw new Error('synthetic remote realpath failure'); return base.realpath(path === '/tmp' ? hostTempAlias : path); },
    run: async command => { versions.push(command); return {code: 0, stdout: 'codex 0.160.0', stderr: ''}; },
    spawn: async command => { commands.push(command); exit = deferred<{code:number|null;signal:string|null}>(); alive = true; return {pid: 99191, exited: exit.promise}; },
    identity: async pid => ({pid, pidStarted: 'start', pidIdentity: 'linux:fake-host:123'}),
    alive: async () => alive,
    fileType: async path => path.endsWith('.sock') ? 'other' : base.fileType(path),
    stop: async row => { stops.push(row.pid!); alive = false; exit.resolve({code: 0, signal: null}); return true; },
    forward: async (id, endpoint) => { assert.ok('socket' in endpoint); assert.equal(dirname(endpoint.socket), run); forwards.push(id); return {socket: localSocket}; },
    unforward: async id => { releases.push(id); },
  };
  let adapter!: CodexAdapter;
  const { discovery } = await projectHub(t, root, {}, {hosts: [host], adapters: [boundary => {
    adapter = new CodexAdapter(boundary, {bin: 'fake-codex', env: fixtureEnvironment(root, process.env), connect: async socket => { assert.equal(socket, localSocket, 'RPC connects only through the session forward'); native.closed = false; return native; }});
    return adapter;
  }]});
  await mkdir(join(remote, '.git'), {recursive: true});
  const rolesFile = join(root, '.cland/roles.toml');
  let roles = await readFile(rolesFile, 'utf8');
  roles = setRoleKey(roles, 'implementer', 'launch', 'writable_roots', ['.']);
  roles = setRoleKey(roles, 'implementer', 'launch', 'network', 'local');
  await writeFile(rolesFile, roles);
  const ui = await connectUi(t, discovery);
  await ui.request({type: 'subscribe'});
  const launched = await ui.request({type: 'session.launch', name: 'remote', harness: 'codex', host: 'f1', cwd: remote, role: 'implementer', sandbox: {mode: 'workspace-write', writableRoots: [remote], network: 'local'}});
  assert.equal(launched.ok, true, launched.error);
  const row = commands[0]!;
  assert.equal(versions.length, 1);
  assert.deepEqual(versions[0]!.args, ['--version']);
  assert.equal(row.cwd, remote);
  assert.ok(row.args.includes(`unix://${join(run, `cx-${forwards[0]!.replace(/-/g, '').slice(0,12)}.sock`)}`));
  const policy = row.args.filter(arg => arg.startsWith('permissions.')).join('');
  assert.ok(policy.includes(remote), policy);
  assert.ok(policy.includes(join(remote, '.git')), policy);
  assert.ok(policy.includes(await realpath(run)), policy);
  assert.ok(policy.includes(await realpath(hostTempAlias)), policy);
  assert.ok(!policy.includes(root), policy);
  for (const path of [remote, join(remote, '.git'), run, '/tmp']) assert.ok(canonicalized.includes(path), `host realpath: ${path}`);
  assert.ok(!row.args.join(' ').includes('danger-full-access'));
  for (const socket of [localSocket, row.args[2]!.slice(7)]) assert.ok(Buffer.byteLength(socket) + 1 <= 104, socket);
  const peer = await inProcessSpoke(t, {discover: true, cwd: root, name: 'remote', sessionId: forwards[0]!, launchToken: row.env.CLAND_LAUNCH_TOKEN!});
  await peer.waitForPresence(['remote']);
  native.complete('turn-1');
  const sent = await ui.request({type: 'topic.send', topic: 'general', to: ['remote'], text: '@remote remote delivery'});
  assert.equal(sent.ok, true, sent.error);
  await eventually('scripted native delivery receipt', () => native.calls.find(call => JSON.stringify(call.params).includes('remote delivery')));
  const listedState = async () => {
    const reply = await ui.request({type: 'session.list'});
    return (reply.value as {processes: HarnessProcessView[]}).processes.find(process => process.sessionId === forwards[0])?.state;
  };
  // Withhold the native idle publication: capabilities still contain idle, but this row is busy.
  assert.equal(await listedState(), 'busy');
  const idlePublished = eventually('exact remote idle row', async () => await listedState() === 'idle' || undefined);
  native.state('idle');
  await idlePublished;
  assert.equal(await listedState(), 'idle');
  adapter.unwatch(forwards[0]!);
  native.removeAllListeners();
  const resumed = await ui.request({type: 'session.resume', session: 'remote'});
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal(native.count('thread/resume'), 1);
  assert.deepEqual(forwards, [forwards[0], forwards[0]], 'resume reacquires the same session forward');
  const stopped = await ui.request({type: 'session.stop', session: 'remote'});
  assert.equal(stopped.ok, true, stopped.error);
  assert.deepEqual(stops, [99191]);
  assert.deepEqual(releases, [forwards[0]]);
  assert.equal(alive, false);
  const before = commands.length;
  roles = setRoleKey(roles, 'implementer', 'launch', 'writable_roots', [root]);
  await writeFile(rolesFile, roles);
  const refused = await ui.request({type: 'session.launch', name: 'absolute', harness: 'codex', host: 'f1', cwd: remote, role: 'implementer'});
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /host f1.*absolute writable root/);
  assert.equal(commands.length, before, 'absolute hub roots refuse before native launch');
  roles = setRoleKey(roles, 'implementer', 'launch', 'writable_roots', ['missing-root']);
  await writeFile(rolesFile, roles);
  const missing = await ui.request({type: 'session.launch', name: 'missing', harness: 'codex', host: 'f1', cwd: remote, role: 'implementer'});
  assert.equal(missing.ok, false);
  assert.match(missing.error!, /cannot resolve launch policy on host f1/);
  assert.equal(commands.length, before);
  roles = setRoleKey(roles, 'implementer', 'launch', 'writable_roots', ['.']);
  await writeFile(rolesFile, roles);
  layout.runDirectory = join(remote, 'x'.repeat(110));
  const long = await ui.request({type: 'session.launch', name: 'long', harness: 'codex', host: 'f1', cwd: remote, role: 'implementer'});
  assert.equal(long.ok, false);
  assert.match(long.error!, /Codex socket exceeds 104 bytes on host f1/);
  assert.ok(long.error!.includes(layout.runDirectory), 'refusal names the original run path');
  assert.equal(commands.length, before);
  layout.runDirectory = run;
  native.handlers.set('thread/start', () => { throw new Error('frame handshake refused'); });
  const failed = await ui.request({type:'session.launch',name:'failed',harness:'codex',host:'f1',cwd:remote,role:'implementer'});
  assert.equal(failed.ok,false);
  assert.match(failed.error!,/frame handshake refused/);
  const afterFailure = (await ui.request({type:'session.list'})).value as {pendingStops:unknown[]};
  assert.deepEqual(afterFailure.pendingStops,[],'failed frame launch settles recovery after cancellation');
  assert.equal(releases.at(-1),forwards.at(-1),'failed handshake releases its own session forward');
  delete (layout as Partial<typeof layout>).runDirectory;
  const missingLayout = await ui.request({type:'session.launch',name:'missing-layout',harness:'codex',host:'f1',cwd:remote,role:'implementer'});
  assert.equal(missingLayout.ok,false);
  assert.match(missingLayout.error!,/host f1.*runDirectory/);
  assert.equal(commands.length,before+1,'missing run layout refuses before native spawn');
  const missingResume = await ui.request({type:'session.resume',session:'remote',relaunch:true});
  assert.equal(missingResume.ok,true,missingResume.error);
  const missingResumeValue = missingResume.value as {found:boolean;reason:string};
  assert.equal(missingResumeValue.found,false);
  assert.match(missingResumeValue.reason,/host f1.*runDirectory/);
  assert.equal(commands.length,before+1,'missing relaunch layout refuses before native spawn');
  layout.runDirectory = run;
  refuseRealpath = true;
  const unresolved = await ui.request({type:'session.launch',name:'unresolved-policy',harness:'codex',host:'f1',cwd:remote,role:'implementer'});
  assert.equal(unresolved.ok,false);
  assert.match(unresolved.error!,/cannot resolve launch policy on host f1.*synthetic remote realpath failure/);
  assert.equal(commands.length,before+1,'sandbox policy resolution failure cannot spawn');
});
