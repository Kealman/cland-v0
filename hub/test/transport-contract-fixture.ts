// Fake-only binding for the shared contract; production transport and fakes remain unedited.
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, writeFile, readFile, readdir, readlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, fixtureProcessCensus, cleanupOwnedProcesses } from './process-cleanup.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { AGENT_PROTOCOL, LineDecoder, parseRequest } from '../src/host/agent/protocol.ts';
import type { ContractFixture, TransportEndpoint } from './transport-contract.ts';

// Inspect actual descriptors, not argv or a monkeypatched listen method.
async function tcpListeners(pids: number[], root: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  if (process.platform === 'darwin') {
    try {
      return execFileSync('lsof', ['-nP', '-a', '-p', pids.join(','), '-iTCP', '-sTCP:LISTEN', '-Fpfn'],
        { cwd: root, env: fixtureEnvironment(root, process.env, env), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    } catch (error) {
      if ((error as { status?: number }).status === 1 && !(error as { stdout?: string }).stdout?.length) return [];
      throw error;
    }
  }
  assert.equal(process.platform, 'linux', 'native listener inspection requires Linux or macOS');
  const inodes = new Set<string>();
  for (const pid of pids) {
    for (const fd of await readdir(`/proc/${pid}/fd`)) {
      try { const match = /^socket:\[(\d+)\]$/.exec(await readlink(`/proc/${pid}/fd/${fd}`)); if (match) inodes.add(match[1]!); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  const rows = [];
  for (const family of ['tcp', 'tcp6']) {
    for (const line of (await readFile(`/proc/self/net/${family}`, 'utf8')).trim().split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields[3] === '0A' && inodes.has(fields[9]!)) rows.push(line);
    }
  }
  return rows;
}
export async function sshContractFixture(t: TestContext): Promise<ContractFixture> {
  // Host-selected paths must remain short even under the stage's deep TMPDIR.
  const root = await mkdtemp('/tmp/tc-');
  const previousCwd = process.cwd();
  process.chdir(root); // Carrier children inherit the disposable cwd, never the live project.
  const db = new DatabaseSync(':memory:');
  const servers: net.Server[] = [], sockets = new Set<net.Socket>();
  let transport: SshTransport | undefined;
  const cleanup = ownDirectory(undefined, root, { beforeRemove: async () => cleanupOwnedProcesses(fixtureProcessCensus(root)) });
  t.after(async () => {
    await transport?.stop();
    await cleanupOwnedProcesses(fixtureProcessCensus(root));
    for (const socket of sockets) socket.destroy();
    for (const server of servers) if (server.listening) await new Promise<void>(r => server.close(() => r()));
    db.close(); process.chdir(previousCwd); await cleanup();
  });
  const host = await createFakeHost(root, 'one');
  const env = fixtureEnvironment(root, process.env, {
    CLAND_FAKE_HOSTS: 'one', CLAND_FAKE_HOST_ROOT: root,
    CLAND_SSH_BIN: new URL('./fakes/fake-ssh.ts', import.meta.url).pathname,
  });
  const records = new HostRecords(db), secrets = new HostSecretStore(root, records);
  const record = secrets.register({ id: 'one', address: 'one', user: 'agent', clientKeyPath: join(host.directory, 'client-key'), knownHosts: `one ${host.key}\n` });
  const paths = hostPaths(root, 'one');
  const supervisor = join(root, 'supervisor');
  // The stub agent is already listening; --check proves it needs no supervisor.
  await writeFile(supervisor, '#!/bin/sh\n[ "$1" = --check ]\n', { mode: 0o700 });
  const hubSocket = fixtureSocketPath(root, 'hub'), spokeSocket = fixtureSocketPath(root, 'spoke');
  for (const path of [hubSocket, spokeSocket, paths.gitSocket, paths.agentSocket, paths.controlSocket, ...['hub','spoke','git','agent'].map(n => join(host.run, n+'.sock'))]) assert.ok(Buffer.byteLength(path) + 1 < 104, path);
  function track(socket: net.Socket) { sockets.add(socket); socket.on('error', () => socket.destroy()); socket.once('close', () => sockets.delete(socket)); }
  async function listen(path: string, accept: (socket: net.Socket) => void) {
    const server = net.createServer({ allowHalfOpen: true }, socket => { track(socket); accept(socket); }); servers.push(server);
    await new Promise<void>((r,j) => { server.once('error',j); server.listen(path,r); });
    await chmod(path, 0o600);
  }
  const input = Buffer.from([0,255,13,10,1,128]), reply = Buffer.concat([Buffer.from('reply:'), input]);
  const seen = new Map<string, number>();
  for (const [name,path] of [['hub.sock',hubSocket],['spoke.sock',spokeSocket],['git.sock',paths.gitSocket]]) {
    await listen(path!, socket => { const chunks: Buffer[] = []; socket.on('data', b => chunks.push(b)); socket.on('end', () => {
      const bytes = Buffer.concat(chunks); if (bytes.equals(input)) seen.set(name!, (seen.get(name!) ?? 0)+1);
      socket.end(Buffer.concat([Buffer.from('reply:'), bytes]));
    }); });
  }
  await listen(join(host.run,'agent.sock'), socket => {
    const decoder = new LineDecoder();
    socket.on('data', bytes => { for (const line of decoder.push(bytes)) {
      const request = parseRequest(line);
      const result = request.op === 'hello' ? {protocol:AGENT_PROTOCOL,version:'stub',pid:process.pid,bootId:'stub'} : { bytes: request.args.bytes, marker: 'agent-reply' };
      socket.write(JSON.stringify({id:request.id,ok:request.op !== 'hello' || request.args.secret === secrets.readSecret('one'),result})+'\n');
    } });
  });
  // Positive native control, before any carrier starts; no connection is made.
  const control = net.createServer(); servers.push(control);
  await new Promise<void>(r => control.listen(0,'127.0.0.1',r));
  assert.ok((await tcpListeners([process.pid], root, env)).length > 0, 'native scan detects planted TCP listener');
  await new Promise<void>(r => control.close(() => r()));
  assert.deepEqual(await tcpListeners([process.pid], root, env), []);
  transport = new SshTransport({root,record,secrets,hubSocket,spokeSocket,remoteRun:host.run,supervisor,agentCommand:['stub'],env,random:()=>0.5});
  return {
    transport, run:host.run,
    async exchange(endpoint: TransportEndpoint) {
      if (endpoint === 'agent.sock') {
        const client = await AgentClient.connect(paths.agentSocket,secrets.readSecret('one'));
        try { assert.deepEqual(await client.request('contract-echo',{bytes:input.toString('base64')},1000),{bytes:input.toString('base64'),marker:'agent-reply'}); }
        finally { await client.close(); }
        return;
      }
      const before = seen.get(endpoint) ?? 0;
      const bytes = await new Promise<Buffer>((resolve,reject) => {
        const socket = net.createConnection({path:join(host.run,endpoint),allowHalfOpen:true}); track(socket);
        socket.setTimeout(1000,()=>socket.destroy(new Error('contract exchange incomplete'))); socket.once('error',reject);
        const chunks: Buffer[] = []; socket.on('connect',()=>socket.end(input)); socket.on('data',b=>chunks.push(b));
        socket.on('end',()=>{socket.destroy();resolve(Buffer.concat(chunks));});
      });
      assert.deepEqual(bytes,reply,endpoint); assert.equal(seen.get(endpoint),before+1,`${endpoint} stub received exact binary bytes`);
    },
    drop:()=>hostControl('kill-master','one',env),
    async assertNoTcp() {
      const pids = fixtureProcessCensus(root).map(p=>p.pid).filter(pid=>pid !== process.pid);
      assert.ok(pids.length > 0, 'native census includes live fake carrier');
      assert.deepEqual(await tcpListeners([process.pid,...pids],root,env),[],'hub stubs and host/carrier processes bind no TCP listeners');
    },
  };
}
