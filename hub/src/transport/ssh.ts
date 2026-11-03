import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { hostPaths } from '../host/records.ts';
import type { HostRecord, HostSecretStore } from '../host/records.ts';
import { sshBinaries } from '../host/ssh-binaries.ts';
import { AgentClient } from '../host/agent-client.ts';
import { realClock } from '../hub/clock.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { claimTransport, ReconnectPolicy } from './transport.ts';
import type { Transport, HostTunnelStatus } from './transport.ts';
const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
// This is OpenSSH configuration quoting, independent of the remote shell.
const configPath = (path: string) => '"' + path.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
class ControlEndpointFenced extends Error {}
/** A refused native connect proves the endpoint is absent. Every other outcome
 * stays fenced, including successful connect followed by peer close. */
async function controlEndpointAbsent(path: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ path });
    let absent = false;
    socket.once('error', (error: NodeJS.ErrnoException) => { absent = error.code === 'ENOENT' || error.code === 'ECONNREFUSED'; });
    socket.once('connect', () => socket.destroy());
    socket.setTimeout(1000, () => socket.destroy());
    socket.once('close', () => resolve(absent));
  });
}
export type SshOptions = {
  root: string; record: HostRecord; secrets: Pick<HostSecretStore, 'readSecret'>;
  hubSocket: string; spokeSocket: string; remoteRun: string;
  /** Installed absolute path, not shell source. Code delivery is a separate owner. */
  supervisor: string; agentCommand: string[];
  env?: NodeJS.ProcessEnv; clock?: Clock; random?: () => number;
  log?: (message: string) => void;
};
/** Shell and secret travel solely in SSH stdin. No child inherits the secret in argv. */
export function bootstrapScript(o: SshOptions): string {
  if (!o.agentCommand.length) throw new Error('agent command required');
  const secret = o.secrets.readSecret(o.record.id);
  return `set -eu\numask 077\nrun=${quote(o.remoteRun)}\nmkdir -p "$run"\nchmod 700 "$run"\nif sh ${quote(o.supervisor)} --check "$run"; then exit 0; fi\nprintf '%s' ${quote(secret)} > "$run/secret"\nchmod 600 "$run/secret"\nexport CLAND_HOST_SECRET=$(cat "$run/secret")\nexport CLAND_HOST_RUN_DIR="$run"\nsetsid nohup sh ${quote(o.supervisor)} "$run" ${o.agentCommand.map(quote).join(' ')} </dev/null >>"$run/supervisor.log" 2>&1 &\n`;
}
export async function sshArguments(o: SshOptions): Promise<string[]> {
  const paths = hostPaths(o.root, o.record.id);
  return ['-a', '-x', '-F', '/dev/null', '-i', (await readFile(paths.clientKeyPath, 'utf8')).trim(),
    ...['BatchMode=yes','IdentitiesOnly=yes','ExitOnForwardFailure=yes','ServerAliveInterval=15','ServerAliveCountMax=4','StrictHostKeyChecking=yes','GlobalKnownHostsFile=/dev/null','KnownHostsCommand=none','VerifyHostKeyDNS=no','UpdateHostKeys=no',`UserKnownHostsFile=${configPath(paths.knownHosts)}`].flatMap(v => ['-o',v])];
}
export class SshTransport implements Transport {
  readonly kind = 'ssh' as const; readonly host: string;
  readonly #o: SshOptions; readonly #clock: Clock; readonly #policy: ReconnectPolicy;
  #state: HostTunnelStatus; #running = false; #loop?: Promise<void>; #release: (() => void) | undefined;
  #children = new Map<ChildProcess, () => Promise<void>>(); #retry: (() => void) | undefined; #watch?: ClockTimer;
  constructor(options: SshOptions) {
    for (const path of [options.remoteRun, options.hubSocket, options.spokeSocket, options.supervisor]) {
      if (!isAbsolute(path) || /[:\n\r\0]/.test(path)) throw new Error('transport requires absolute Unix socket and installed code paths');
    }
    this.#o = options; this.host = options.record.id; this.#clock = options.clock ?? realClock;
    this.#policy = new ReconnectPolicy(this.#clock, options.random);
    this.#state = { name: this.host, state: 'down', since: null, lastProbe: null, reconnects: 0 };
  }
  status(): HostTunnelStatus { return structuredClone(this.#state); }
  #now(): string { return this.#clock.now().toISOString(); }
  #stateTo(state: HostTunnelStatus['state']): void { if (state !== this.#state.state || this.#state.since === null) { this.#state.state = state; this.#state.since = this.#now(); } }
  async start(): Promise<void> {
    if (this.#running) return;
    this.#release = claimTransport(this.#o.root, this); this.#running = true;
    this.#policy.observe();
    this.#watch = this.#clock.setInterval(() => { if (this.#policy.observe()) this.wake(); },1000);
    this.#loop = this.#run();
  }
  wake(): void { this.#retry?.(); }
  async stop(): Promise<void> {
    this.#running = false; this.#clock.clearInterval(this.#watch); this.wake();
    await Promise.all([...this.#children.values()].map(terminate => terminate()));
    await this.#loop; this.#release?.(); this.#release = undefined; this.#stateTo('down');
  }
  #launch(args: string[], input = '') {
    const child = spawn(sshBinaries(this.#o.env ?? process.env).ssh, args, { env: this.#o.env, detached: true, stdio: ['pipe','ignore','ignore'] });
    const closed = new Promise<number>((resolve) => { child.once('error', () => {}); child.once('close', code => { this.#children.delete(child); resolve(code ?? 255); }); });
    const terminate = async () => {
      if (child.exitCode !== null || child.signalCode !== null) { await closed; return; }
      child.kill('SIGTERM');
      const kill = setTimeout(() => child.kill('SIGKILL'), 2000);
      try { await closed; } finally { clearTimeout(kill); }
    };
    this.#children.set(child, terminate);
    child.stdin.on('error', () => {}); child.stdin.end(input);
    // Native deadlines remain real even when the policy clock is injected.
    const deadline = setTimeout(() => child.kill('SIGKILL'), 10000);
    return { child, terminate, closed: closed.finally(() => clearTimeout(deadline)), keep: () => clearTimeout(deadline) };
  }
  async #command(args: string[], input = ''): Promise<boolean> {
    if (!this.#running) return false;
    return await this.#launch(args, input).closed === 0;
  }
  async #probe(): Promise<boolean> {
    let client: AgentClient | undefined; let ok = false;
    try { client = await AgentClient.connect(hostPaths(this.#o.root,this.host).agentSocket,this.#o.secrets.readSecret(this.host)); ok = true; }
    catch { /* A failed authenticated round trip is a down receipt. */ }
    finally { await client?.close(); }
    this.#state.lastProbe = { at: this.#now(), ok }; return ok;
  }
  async #pause(ms: number): Promise<void> {
    await new Promise<void>(resolve => {
      const timer = this.#clock.setTimeout(() => done(),ms);
      const done = () => { this.#clock.clearTimeout(timer); this.#retry = undefined; resolve(); };
      this.#retry = done;
      if (!this.#running) done();
    });
  }
  async #run(): Promise<void> {
    const o = this.#o, paths = hostPaths(o.root,this.host), destination = `${o.record.user}@${o.record.address}`;
    try {
      const base = await sshArguments(o);
      while (this.#running) {
        this.#stateTo('connecting');
        delete this.#state.reason;
        try {
          // Exit the old owner and reap its socket before creating a multiplexing master.
          await this.#command([...base,'-S',paths.controlSocket,'-O','exit',destination]);
          if (!this.#running) break;
          // Exit success alone is not a cleanup receipt; failed exit is safe only
          // when the exact native endpoint positively refuses a connection.
          if (!await controlEndpointAbsent(paths.controlSocket)) throw new ControlEndpointFenced();
          if (!this.#running) break;
          await unlink(paths.controlSocket).catch(error => { if (error.code !== 'ENOENT') throw error; });
          if (!await this.#command([...base,destination,'sh -s'],bootstrapScript(o))) throw new Error('bootstrap refused');
          if (!this.#running) break;
          const master = this.#launch([...base,'-N','-M','-S',paths.controlSocket,'-o','ControlMaster=yes','-o','StreamLocalBindUnlink=yes',
            '-R',`${o.remoteRun}/hub.sock:${o.hubSocket}`,'-R',`${o.remoteRun}/spoke.sock:${o.spokeSocket}`,
            '-R',`${o.remoteRun}/git.sock:${paths.gitSocket}`,'-L',`${paths.agentSocket}:${o.remoteRun}/agent.sock`,destination]);
          master.keep();
          let exited = false; void master.closed.then(() => { exited = true; this.wake(); });
          try {
            // Readiness is multiplexing plus an authenticated end-to-end receipt.
            const deadline = performance.now() + 10000;
            while (this.#running && !exited && performance.now() < deadline) {
              if (await this.#command([...base,'-S',paths.controlSocket,'-O','check',destination]) && await this.#probe()) break;
              await this.#pause(100);
            }
            if (!this.#running || exited || !this.#state.lastProbe?.ok || performance.now() >= deadline) throw new Error('master readiness failed');
            this.#stateTo('up'); this.#policy.connected();
            while (this.#running && !exited) {
              await this.#pause(30000);
              if (this.#running && !exited && !await this.#probe()) break;
            }
          } finally { if (!exited) await master.terminate(); await master.closed; }
        } catch (error) {
          this.#state.reason = error instanceof ControlEndpointFenced ? 'control endpoint has not closed' : 'SSH connection or pinned-key admission failed';
          o.log?.(`host ${this.host}: ${this.#state.reason}`);
        }
        this.#policy.disconnected(); this.#stateTo('down');
        if (this.#running) { this.#state.reconnects++; await this.#pause(this.#policy.failed()); }
      }
    } catch { this.#state.reason = 'transport configuration unavailable'; o.log?.(`host ${this.host}: ${this.#state.reason}`); }
    finally { this.#stateTo('down'); }
  }
}
