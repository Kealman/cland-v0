import { drained, ReadinessCleanupIncomplete } from './readiness.ts';
import { setTimeout as delay } from 'node:timers/promises';
import type { HostEndpoint } from '../host/host.ts';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { readFileSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { hostPaths } from '../host/records.ts';
import type { HostRecord, HostSecretStore } from '../host/records.ts';
import { sshBinaries } from '../host/ssh-binaries.ts';
import { AgentClient } from '../host/agent-client.ts';
import { realClock } from '../hub/clock.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { claimTransport, noteTransportStopped, ReconnectPolicy } from './transport.ts';
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
  onStatus?: (status: HostTunnelStatus) => void;
  /** Joined before up and during stop; caller bounds its agent operations. */
  beforeReady?: (signal: AbortSignal) => Promise<void>;
  beforeReadyTimeoutMs?: number;
  beforeReadyDrainMs?: number;
  /** Injectable polling bound; production retains 100 ms / 10 seconds. */
  readinessPollMs?: number;
  readinessTimeoutMs?: number;
  root: string; record: HostRecord; secrets: Pick<HostSecretStore, 'readSecret'>;
  hubSocket: string; spokeSocket: string; remoteRun: string;
  /** Installed absolute path, not shell source. Code delivery is a separate owner. */
  supervisor: string; agentCommand: string[];
  /** Node for supervisor helpers/version entrypoints; COMMAND may be an exec wrapper. */
  agentNode?: string;
  env?: NodeJS.ProcessEnv; clock?: Clock; random?: () => number;
  log?: (message: string) => void;
  /** Native removal seam for testing retained session cleanup failures. */
  unlinkSessionSocket?: (path: string) => Promise<void>;
  /** Test scheduling seams; omitted values retain the production backoff/retries. */
  reconnectDelayMs?: (backoffMs: number) => number;
  forwardRetryDelaysMs?: readonly [number, number];
};
/** Shell and secret travel solely in SSH stdin. No child inherits the secret in argv. */
export function bootstrapScript(o: SshOptions): string {
  if (!o.agentCommand.length) throw new Error('agent command required');
  const secret = o.secrets.readSecret(o.record.id);
  return `set -eu\numask 077\nrun=${quote(o.remoteRun)}\nmkdir -p "$run"\nchmod 700 "$run"\nif sh ${quote(o.supervisor)} --check "$run"; then exit 0; fi\nprintf '%s' ${quote(secret)} > "$run/secret"\nchmod 600 "$run/secret"\nexport CLAND_HOST_SECRET=$(cat "$run/secret")\nexport CLAND_HOST_RUN_DIR="$run"\nexport CLAND_HOST_NODE=${quote(o.agentNode ?? 'node')}\nsetsid nohup sh ${quote(o.supervisor)} "$run" ${o.agentCommand.map(quote).join(' ')} </dev/null >>"$run/supervisor.log" 2>&1 &\n`;
}
export async function sshArguments(o: SshOptions): Promise<string[]> {
  return sshConnectionArguments(o.root, o.record);
}
export function sshConnectionArguments(root: string, record: HostRecord): string[] {
  const paths = hostPaths(root, record.id);
  return ['-a', '-x', '-F', '/dev/null', '-i', readFileSync(paths.clientKeyPath, 'utf8').trim(),
    ...['BatchMode=yes','IdentitiesOnly=yes','ExitOnForwardFailure=yes','ServerAliveInterval=15','ServerAliveCountMax=4','StrictHostKeyChecking=yes','GlobalKnownHostsFile=/dev/null','KnownHostsCommand=none','VerifyHostKeyDNS=no','UpdateHostKeys=no',`UserKnownHostsFile=${configPath(paths.knownHosts)}`].flatMap(v => ['-o',v])];
}
type SessionForward = { socket: string; spec: string; cleanup: boolean };
export class SshTransport implements Transport {
  readonly kind = 'ssh' as const; readonly host: string;
  readonly #o: SshOptions; readonly #clock: Clock; readonly #policy: ReconnectPolicy;
  #state: HostTunnelStatus; #running = false; #loop?: Promise<void>; #release: (() => void) | undefined;
  #children = new Map<ChildProcess, () => Promise<void>>(); #retry: (() => void) | undefined; #watch?: ClockTimer;
  #forwards = new Map<string, SessionForward>();
  readonly #releasedForwards = new Set<string>();
  #forwardWork: Promise<unknown> = Promise.resolve();
  #beforeReady: Promise<void> | undefined;
  #readinessAbort: AbortController | undefined;
  #masterReady = false;
  #retireMaster: (() => Promise<void>) | undefined;
  #forwardAbort = new AbortController();
  #serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#forwardWork.then(work);
    this.#forwardWork = result.catch(() => {});
    return result;
  }
  async #forwardCommand(operation: 'forward' | 'cancel', spec: string): Promise<boolean> {
    const o = this.#o;
    return this.#command([...await sshArguments(o), '-S', hostPaths(o.root, this.host).controlSocket, '-O', operation, '-L', spec, `${o.record.user}@${o.record.address}`]);
  }
  async #removeForward(session: string, entry: SessionForward): Promise<void> {
    await (this.#o.unlinkSessionSocket ?? unlink)(entry.socket).catch(error => { if (error.code !== 'ENOENT') throw error; });
    this.#forwards.delete(session);
    this.#releasedForwards.add(session);
  }
  /** Returns only after the master acknowledges installation. One endpoint per session. */
  forward(session: string, endpoint: HostEndpoint): Promise<{ socket: string }> {
    return this.#serial(async () => {
      if (!this.#running || !this.#masterReady) throw new Error('host tunnel is not ready');
      let target: string;
      if ('socket' in endpoint) {
        if (!isAbsolute(endpoint.socket) || /[:\\\n\r\0]/.test(endpoint.socket)) throw new Error('invalid host Unix endpoint');
        target = endpoint.socket;
      } else {
        if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) throw new Error('invalid host loopback port');
        target = `127.0.0.1:${endpoint.port}`;
      }
      const socket = hostPaths(this.#o.root, this.host).sessionSocket(session);
      const spec = `${socket}:${target}`, old = this.#forwards.get(session);
      if (old) {
        if (old.cleanup) throw new Error('session forward cleanup is pending');
        if (old.spec !== spec) throw new Error('session already has a different forward');
        return { socket };
      }
      const entry: SessionForward = { socket, spec, cleanup: false };
      this.#releasedForwards.delete(session);
      this.#forwards.set(session, entry);
      try {
        if (!await this.#forwardCommand('forward', spec)) throw new Error('session forward refused');
      } catch (error) {
        // A lost mux acknowledgement can leave an installed listener. Reap its
        // exact owned master before treating this failed installation as absent.
        await this.#retireMaster?.();
        entry.cleanup = true;
        await this.#removeForward(session, entry);
        throw error;
      }
      return { socket };
    });
  }
  /** Forget local listener ownership without contacting the lost host or mux. */
  dropForwardLocal(ids: readonly string[]): Promise<void> {
    return this.#serial(async () => {
      for (const id of ids) {
        const entry = this.#forwards.get(id);
        if (!entry) continue;
        // A failed unlink must never restore this generation on reconnect.
        entry.cleanup = true;
        await this.#removeForward(id, entry);
      }
    });
  }

  unforward(session: string): Promise<void> {
    return this.#serial(async () => {
      const entry = this.#forwards.get(session);
      if (!entry) return;
      if (!entry.cleanup) {
        if (this.#masterReady && !await this.#forwardCommand('cancel', entry.spec)) throw new Error('session forward cancellation refused');
        entry.cleanup = true;
      }
      await this.#removeForward(session, entry);
    });
  }
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
  #stateTo(state: HostTunnelStatus['state']): void { if (state !== this.#state.state || this.#state.since === null) { this.#state.state = state; this.#state.since = this.#now(); this.#o.onStatus?.(this.status()); } }
  async start(): Promise<void> {
    if (this.#running) return;
    this.#forwardAbort = new AbortController();
    this.#release = claimTransport(this.#o.root, this); this.#releasedForwards.clear(); this.#running = true;
    this.#policy.observe();
    this.#watch = this.#clock.setInterval(() => { if (this.#policy.observe()) this.wake(); },1000);
    this.#loop = this.#run();
  }
  wake(): void { this.#retry?.(); }
  async stop(): Promise<void> {
    this.#running = false; this.#forwardAbort.abort(); this.#clock.clearInterval(this.#watch); this.wake();
    this.#readinessAbort?.abort();
    if (this.#beforeReady && !await drained(this.#beforeReady, this.#o.beforeReadyDrainMs ?? 1000)) {
      this.#state.reason = 'host readiness cleanup incomplete';
      throw new ReadinessCleanupIncomplete();
    }
    await Promise.all([...this.#children.values()].map(terminate => terminate()));
    await this.#loop; await this.#forwardWork;
    await this.#serial(async () => {
      for (const entry of this.#forwards.values()) entry.cleanup = true;
      for (const [session, entry] of this.#forwards) await this.#removeForward(session, entry);
      if (this.#release) noteTransportStopped(this.#o.root, this, [...this.#releasedForwards]);
      this.#release?.(); this.#release = undefined; this.#stateTo('down');
    });
  }
  #launch(args: string[], input = '', binary = sshBinaries(this.#o.env ?? process.env).ssh) {
    const child = spawn(binary, args, { env: this.#o.env, detached: true, stdio: ['pipe','ignore','ignore'] });
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
  /** Bundle delivery shares the existing pinned master; stop joins its native close. */
  copyFile(source: string, destination: string): Promise<void> {
    return this.#serial(async () => {
      const o=this.#o;
      if (!this.#running || !this.#masterReady) throw new Error('host copy: tunnel is not up');
      const base=o.remoteRun.replace(/\/run$/, '');
      if (![o.remoteRun+'/',base+'/work/',base+'/code/'].some(prefix=>destination.startsWith(prefix)) || destination.split('/').includes('..')) throw new Error('host copy: destination refused');
      const args=await sshArguments(o);
      // scp accepts -o equivalents for ssh's -a and -x.
      const filtered=args.slice(2);
      const result=await this.#launch([...filtered,'-o',`ControlPath=${hostPaths(o.root,this.host).controlSocket}`,'-o','ControlMaster=no','-o','ProxyCommand=false',source,`${o.record.user}@${o.record.address}:${destination}`],'',sshBinaries(o.env ?? process.env).scp).closed;
      if(result!==0)throw new Error('host copy failed');
    });
  }
  /** Commands require the admitted pinned mux; never fall back to a fresh SSH connection. */
  execute(script: string): Promise<void> {
    return this.#serial(async () => {
      const o=this.#o;
      if(!this.#running||!this.#masterReady)throw new Error('host execute: tunnel is not up');
      const ok=await this.#command([...await sshArguments(o),'-S',hostPaths(o.root,this.host).controlSocket,'-o','ControlMaster=no','-o','ProxyCommand=false',`${o.record.user}@${o.record.address}`,'sh','-s'],script);
      if(!ok)throw new Error('host execute failed');
    });
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
          master.keep(); this.#retireMaster = master.terminate;
          let exited = false; void master.closed.then(() => { exited = true; this.wake(); });
          try {
            // Readiness is multiplexing plus an authenticated end-to-end receipt.
            const deadline = performance.now() + (o.readinessTimeoutMs ?? 10000);
            while (this.#running && !exited && performance.now() < deadline) {
              if (await this.#command([...base,'-S',paths.controlSocket,'-O','check',destination]) && await this.#probe()) break;
              await this.#pause(o.readinessPollMs ?? 100);
            }
            if (!this.#running || exited || !this.#state.lastProbe?.ok || performance.now() >= deadline) throw new Error('master readiness failed');
            await this.#serial(async () => {
              for (const [session, entry] of this.#forwards) {
                if (entry.cleanup) { await this.#removeForward(session, entry); continue; }
                let installed = false;
                for (let attempt = 0; attempt < 3 && this.#running; attempt++) {
                  if (attempt) await delay((o.forwardRetryDelaysMs ?? [100, 200])[attempt - 1]!, undefined, { signal: this.#forwardAbort.signal }).catch(() => {});
                  if (!this.#running) break;
                  if (await this.#forwardCommand('forward', entry.spec)) { installed = true; break; }
                }
                if (!this.#running || exited) break;
                if (!installed) {
                  // Failed mux clients are not positive non-delivery receipts.
                  // Retire this owned master before abandoning its endpoint.
                  await master.terminate();
                  entry.cleanup = true;
                  o.log?.(`host ${this.host}: session ${session} forward abandoned after 3 attempts`);
                  await this.#removeForward(session, entry);
                  break;
                }
              }
            });
            if (!this.#running || exited) throw new Error('master closed during forward restore');
            if (o.beforeReady) {
              this.#readinessAbort = new AbortController();
              this.#beforeReady = Promise.resolve().then(() => o.beforeReady!(this.#readinessAbort!.signal));
              let timer: NodeJS.Timeout | undefined;
              try {
                const deadline = new Promise<never>((_, reject) => {
                  timer = setTimeout(() => {
                    this.#state.reason = 'host readiness timed out';
                    o.log?.(`host ${this.host}: host readiness timed out`);
                    reject(new Error('host discovery readiness timed out'));
                  }, o.beforeReadyTimeoutMs ?? 30000);
                });
                await Promise.race([this.#beforeReady, deadline]);
              } catch (error) {
                this.#readinessAbort.abort();
                if (!await drained(this.#beforeReady, o.beforeReadyDrainMs ?? 1000)) {
                  this.#state.reason = 'host readiness cleanup incomplete';
                  o.log?.(`host ${this.host}: host readiness cleanup incomplete`);
                  // Retain this master and its ownership until positive drain.
                  // stop surfaces incomplete instead of waiting without a bound.
                  await this.#beforeReady.catch(() => {});
                }
                throw error;
              } finally {
                if (timer) clearTimeout(timer);
                this.#beforeReady = undefined;
                this.#readinessAbort = undefined;
              }
            }
            if (!this.#running || exited) throw new Error('master closed during discovery');
            this.#masterReady = true;
            this.#stateTo('up'); this.#policy.connected();
            while (this.#running && !exited) {
              await this.#pause(30000);
              if (this.#running && !exited && !await this.#probe()) break;
            }
          } finally { if (!exited) await master.terminate(); await master.closed; this.#masterReady = false; this.#retireMaster = undefined; await this.#forwardWork; }
        } catch (error) {
          this.#state.reason = error instanceof ControlEndpointFenced ? 'control endpoint has not closed' : 'SSH connection or pinned-key admission failed';
          o.log?.(`host ${this.host}: ${this.#state.reason}`);
        }
        this.#policy.disconnected();
        this.#stateTo('down');
        if (this.#running) { this.#state.reconnects++; const backoff = this.#policy.failed(); await this.#pause(o.reconnectDelayMs?.(backoff) ?? backoff); }
      }
    } catch { this.#state.reason = 'transport configuration unavailable'; o.log?.(`host ${this.host}: ${this.#state.reason}`); }
    finally { this.#stateTo('down'); }
  }
}
