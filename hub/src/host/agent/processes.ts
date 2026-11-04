import { stopClaude, claudeProcessMembers, claudeDescendantCapture, claudePinnedTargets, observeClaudeProcesses, claudeStopAdmission, processTargetKey as targetKey } from './claude-stop.ts';
import { spawn, execFile } from 'node:child_process';
import { readFile, mkdir, readdir, rm, open, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentBootId, observeProcesses, isCapturedOrExited } from './native.ts';
import { checkpoint } from './storage.ts';
import type { AgentEvent } from './protocol.ts';
const exec = promisify(execFile);
export type ProcessTarget = { pid: number; identity: string };
export type ProcessRow = { adopted?: true; authority?: 'owned' | 'unknown' | 'closed'; targets?: ProcessTarget[]; rootExitObserved?: boolean; pid: number; identity: string; launchId?: string; ended?: boolean; code?: number | null; signal?: string | null };
export type ProcessHooks = {
  afterSpawn?: (pid: number, directory: string) => Promise<void>;
  beforeCheckpoint?: (phase: 'spawn' | 'exit' | 'recover') => Promise<void>;
  closeLog?: (close: () => Promise<void>) => Promise<void>;
  beforeSignals?: (targets: readonly { pid: number; identity: string }[]) => Promise<void>;
  observed?: (count: number) => void;
  beforeRecoveryObservation?: () => Promise<void>;
  beforeRemainingObservation?: (pids: readonly number[]) => Promise<void>;
};
export class AgentProcesses {
  #rows: ProcessRow[] = [];
  #adoptions = new Map<string,Promise<true|undefined>>();
  #adopted = new Set<ProcessRow>();
  #adoptionCensus = new WeakMap<ProcessRow,Set<number>>();
  #stopCaptures = new WeakMap<ProcessRow,{key:string;pids:Set<number>}>();
  #receipts = new Map<string, AgentEvent>();
  #closed = false;
  #file: string;
  #launches: string;
  #admissions = new Set<string>();
  #inflight = new Set<string>();
  #env: NodeJS.ProcessEnv;
  #hooks: ProcessHooks;
  #save = Promise.resolve();
  #refresh: Promise<void> | undefined;
  #completions = new Set<Promise<void>>();
  #settling = new Set<ProcessRow>();
  #stopping = new Set<ProcessRow>();
  #nativeCompletions = new Map<ProcessRow, Promise<void>>();
  #emit: (event: AgentEvent) => void;
  constructor(runDir: string, env: NodeJS.ProcessEnv, emit: (event: AgentEvent) => void, hooks: ProcessHooks = {}) {
    this.#file = join(runDir, 'processes.json'); this.#launches = join(runDir, 'launches'); this.#env = env; this.#emit = emit; this.#hooks = hooks;
  }
  async load() {
    try { this.#rows = JSON.parse(await readFile(this.#file, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for(const row of this.#rows)if(row.rootExitObserved&&row.code!==undefined)this.#receipts.set(`${row.pid}:${row.identity}`,{event:'process-exited',pid:row.pid,identity:row.identity,code:row.code,signal:row.signal??null});
    await mkdir(this.#launches, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.#launches)) if (/^[a-f0-9-]{36}$/.test(name)) this.#admissions.add(name);
  }
  bootId() { return agentBootId(this.#env); }
  async identity(pid: number): Promise<string | null> { return (await observeProcesses([pid], this.#env)).get(pid)?.identity ?? null; }
  #persist(phase: 'spawn' | 'exit' | 'recover'): Promise<void> {
    this.#rows = [...this.#rows.filter(row => !row.ended || row.adopted), ...this.#rows.filter(row => row.ended && !row.adopted).slice(-256)];
    const keys=new Set(this.#rows.map(row=>`${row.pid}:${row.identity}`));
    for(const key of this.#receipts.keys())if(!keys.has(key))this.#receipts.delete(key);
    const rows = this.#rows.map(row => ({ ...row }));
    this.#save = this.#save.then(async () => { await this.#hooks.beforeCheckpoint?.(phase); await checkpoint(this.#file, rows); });
    return this.#save;
  }
  async #removeAdmission(launchId: string) {
    // Called only after an observed native close or positive absence/birth replacement.
    await rm(join(this.#launches, launchId), { recursive: true, force: true }); this.#admissions.delete(launchId);
  }
  reconcile(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    if (this.#refresh) return this.#refresh;
    this.#refresh = this.#reconcile().finally(() => { this.#refresh = undefined; }); return this.#refresh;
  }
  async #reconcile() {
    for (const launchId of this.#admissions) {
      if (this.#inflight.has(launchId)) continue;
      try {
        const closed = JSON.parse(await readFile(join(this.#launches, launchId, 'closed.json'), 'utf8')) as ProcessRow;
        if (closed.launchId === launchId && closed.ended && closed.authority === 'closed') {
          const existing = this.#rows.find(row => row.launchId === launchId);
          if (existing) Object.assign(existing, closed); else this.#rows.push(closed);
          continue;
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (this.#rows.some(row => row.launchId === launchId)) continue;
      try {
        const birth = JSON.parse(await readFile(join(this.#launches, launchId, 'birth.json'), 'utf8')) as ProcessRow;
        if (birth.launchId === launchId && Number.isSafeInteger(birth.pid) && typeof birth.identity === 'string') this.#rows.push(birth);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const active = this.#rows.filter(row => !row.ended && !this.#inflight.has(row.launchId ?? ''));
    this.#hooks.observed?.(active.length);
    const versions = new Map(active.map(row => [row, row.rootExitObserved]));
    await this.#hooks.beforeRecoveryObservation?.();
    const observations = await observeProcesses(active.flatMap(row => [row.pid, ...(row.targets ?? []).map(target => target.pid)]), this.#env);
    for (const row of active) {
      // Native close owns exact code/signal; this observer never replaces them.
      if (row.ended || this.#settling.has(row) || this.#stopping.has(row) || row.rootExitObserved !== versions.get(row)) continue;
      const proof = observations.get(row.pid);
      if(row.adopted && proof?.ended)row.rootExitObserved=true;
      if (row.authority === 'unknown') continue;
      if (proof?.identity === row.identity && row.code === undefined) {
        const targetVersion = targetKey(row.targets);
        const captured = await this.#liveTargets(row);
        if (captured && !this.#settling.has(row) && !this.#stopping.has(row) && targetKey(row.targets) === targetVersion && row.rootExitObserved === versions.get(row)) {
          row.targets = captured; row.authority = 'owned';
        }
        continue;
      }
      if (!proof?.ended && !(proof?.identity && proof.identity !== row.identity)) continue;
      if (!row.rootExitObserved) {
        if (row.code === undefined) Object.assign(row, { code: null, signal: null });
        row.authority = 'unknown'; row.ended = false;
        continue;
      }
      const targets = row.targets ?? [];
      const survivors = targets.filter(target => observations.get(target.pid)?.identity === target.identity);
      const unresolved = targets.some(target => {
        const observation = observations.get(target.pid);
        return !observation?.ended && observation?.identity !== target.identity;
      });
      const group = await this.#group(row.pid);
      if (row.ended || this.#settling.has(row) || row.targets !== targets) continue;
      if (unresolved || group.some(member => !survivors.some(target => target.pid === member.pid))) row.authority = 'unknown';
      else if (!survivors.length) { row.targets = []; row.authority = 'closed'; row.ended = true; }
      else { row.targets = survivors; row.authority = 'owned'; }
    }
    const closedAdmissions = this.#rows.filter(row => row.ended && !this.#settling.has(row) && !this.#stopping.has(row) && row.authority === 'closed' && row.launchId && this.#admissions.has(row.launchId));
    for (const row of closedAdmissions) await checkpoint(join(this.#launches, row.launchId!, 'closed.json'), row);
    await this.#persist('recover');
    for (const row of closedAdmissions) await this.#removeAdmission(row.launchId!);
    for (const row of active) {
      if (this.#closed) break;
      if (row.launchId && !row.ended && row.authority !== 'unknown' && row.code === undefined && observations.get(row.pid)?.identity === row.identity) {
        await checkpoint(join(this.#launches, row.launchId, 'release.json'), { identity: row.identity });
      }
    }
  }
  closed(worker:{pid:number;identity:string}):boolean {return this.#rows.some(row=>row.pid===worker.pid&&row.identity===worker.identity&&row.ended&&row.authority==='closed');}
  async releaseAdoption(worker:{pid:number;identity:string}){const row=this.#rows.find(row=>row.pid===worker.pid&&row.identity===worker.identity);if(row){if(!this.closed(worker))throw new Error('Claude worker closure incomplete');delete row.adopted;this.#adopted.delete(row);await this.#persist('recover');}}
  async confirmedClosed(worker:{pid:number;identity:string}):Promise<boolean>{await this.#save;return this.closed(worker);}
  adopt(worker: { pid: number; identity: string }):Promise<true|undefined> {
    const key=worker.pid+':'+worker.identity,active=this.#adoptions.get(key);if(active)return active;
    const result=this.#adopt(worker);this.#adoptions.set(key,result);
    const done=()=>{if(this.#adoptions.get(key)===result)this.#adoptions.delete(key);};void result.then(done,done);return result;
  }
  async #adopt(worker: { pid: number; identity: string }):Promise<true|undefined> {
    if(await this.confirmedClosed(worker))return true;
    if(this.#closed || await this.identity(worker.pid)!==worker.identity)throw new Error('Claude worker identity mismatch');
    const existing=this.#rows.find(row=>row.pid===worker.pid && row.identity===worker.identity && !row.ended);
    if(existing){
      await this.#save;const census=await claudeProcessMembers(this.#env),targets=await this.#liveTargets(existing,true);
      if(!targets)throw new Error('Claude worker capture refused');
      existing.targets=targets;await this.#persist('recover');
      this.#adoptionCensus.set(existing,new Set(census.map(member=>member.pid)));this.#adopted.add(existing);return;
    }
    const row:ProcessRow={adopted:true,pid:worker.pid,identity:worker.identity,authority:'owned',targets:[{pid:worker.pid,identity:worker.identity}]};
    const census=await claudeProcessMembers(this.#env),targets=await this.#liveTargets(row,true);
    if(!targets)throw new Error('Claude worker capture refused');
    row.targets=targets;this.#rows.push(row);await this.#persist('spawn');this.#adoptionCensus.set(row,new Set(census.map(member=>member.pid)));this.#adopted.add(row);
  }
  async spawn(args: Record<string, unknown>, preparedLog?: FileHandle, admission?: {launchId: string; accepted: (result: {pid:number;identity:string}) => Promise<void>}) {
    if (this.#closed) throw new Error('agent closing');
    if (!process.execve) throw new Error('native execve unavailable');
    if (typeof args.command !== 'string' || !args.command || !Array.isArray(args.args) || !args.args.every(a => typeof a === 'string') || typeof args.cwd !== 'string' || !args.env || typeof args.env !== 'object' || Array.isArray(args.env)) throw new Error('invalid spawn');
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(args.env)) { if (typeof value !== 'string') throw new Error('invalid environment'); if (!key.startsWith('CLAND_HOST_')) env[key] = value; }
    let command = args.command;
    if (!isAbsolute(command)) {
      const candidates = command.includes('/') ? [resolve(args.cwd, command)] : (env.PATH ?? '').split(':').map(path => resolve(args.cwd as string, path, command));
      let found: string | undefined;
      for (const candidate of candidates) { try { await access(candidate, constants.X_OK); found = candidate; break; } catch {} }
      if (!found) throw new Error('command unavailable'); command = found;
    }
    await this.reconcile();
    const launchId = admission?.launchId ?? randomUUID(), directory = join(this.#launches, launchId);
    await mkdir(directory, { mode: 0o700 }); this.#inflight.add(launchId);
    const fakeEnv = { CLAND_FAKE_HOSTS: this.#env.CLAND_FAKE_HOSTS, CLAND_HOST_BOOT_ID_FILE: this.#env.CLAND_HOST_BOOT_ID_FILE };
    // Admission, argv and environment precede native execution; no environment in argv.
    await checkpoint(join(directory, 'plan.json'), { launchId, command, args: args.args, cwd: args.cwd, env, fakeEnv });
    await checkpoint(join(directory, 'admission.json'), { launchId }); this.#admissions.add(launchId);
    let log;
    try { log = preparedLog ?? (typeof args.logFile === 'string' ? await open(args.logFile, 'a', 0o600) : undefined); }
    catch (error) { this.#inflight.delete(launchId); await this.#removeAdmission(launchId); throw error; }
    let child;
    try { child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('./bootstrap.ts', import.meta.url)), directory], { cwd: args.cwd, env, detached: true, stdio: ['ignore', log?.fd ?? 'ignore', log?.fd ?? 'ignore'] }); }
    catch { this.#inflight.delete(launchId); await log?.close(); await this.#removeAdmission(launchId); throw new Error('spawn refused'); }
    let nativeExit: { code: number | null; signal: string | null } | undefined;
    const nativeClosed = new Promise<{ code: number | null; signal: string | null }>(resolve => child.once('close', (code, signal) => { nativeExit = { code, signal }; resolve(nativeExit); }));
    let accepted = false;
    let acceptedResult: { pid: number; identity: string; warning?: string } | undefined;
    try {
      await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      await this.#hooks.afterSpawn?.(child.pid!, directory);
      if (this.#env.CLAND_FAKE_HOSTS && this.#env.CLAND_HOST_TEST_HOLD_SPAWN) {
        const hold = this.#env.CLAND_HOST_TEST_HOLD_SPAWN;
        await checkpoint(hold, { pid: child.pid, directory });
        for (;;) { try { await access(hold + '.release'); break; } catch {} await new Promise(resolve => setTimeout(resolve, 20)); }
      }
      let birth: ProcessRow | undefined;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (nativeExit) throw new Error(`child birth incomplete (code ${nativeExit.code}, signal ${nativeExit.signal})`);
        try { birth = JSON.parse(await readFile(join(directory, 'birth.json'), 'utf8')); break; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (!birth || birth.pid !== child.pid || birth.launchId !== launchId || !await this.alive(birth)) throw new Error('child birth incomplete');
      const row: ProcessRow = { ...birth, authority: 'owned', targets: [{ pid: birth.pid, identity: birth.identity }] }; this.#rows.push(row); await this.#persist('spawn');
      // Exactly one completion owner, installed before release. Exit cannot precede admission.
      const nativeCompletion = nativeClosed.then(async exit => {
        if (this.#closed) return;
        const completion = (async () => {
          this.#settling.add(row);
          // Install the exact native receipt synchronously before any observation await.
          Object.assign(row, exit, { rootExitObserved: true, ended: false });
          try {
            const members = (await this.#group(row.pid)).filter(member => member.pid !== row.pid);
            const previous = (row.targets ?? []).filter(target => target.pid !== row.pid);
            const births = await observeProcesses([...members.map(member => member.pid), ...previous.map(target => target.pid)], this.#env);
            const targets = new Map<number, ProcessTarget>();
            let unresolved = false;
            // PPID captures remain authority after their member changes group or reparents.
            for (const target of previous) {
              const proof = births.get(target.pid);
              if (proof?.identity === target.identity) targets.set(target.pid, target);
              else if (!proof?.ended && !proof?.identity) unresolved = true;
            }
            for (const member of members) {
              const proof = births.get(member.pid);
              if (proof?.identity) targets.set(member.pid, { pid: member.pid, identity: proof.identity });
              else if (!proof?.ended) unresolved = true;
            }
            row.targets = [...targets.values()];
            row.authority = unresolved ? 'unknown' : targets.size ? 'owned' : 'closed';
            row.ended = row.authority === 'closed';
          } catch { row.authority = 'unknown'; }
          if (row.ended) await checkpoint(join(directory, 'closed.json'), row);
          await this.#persist('exit');
          this.#receipts.set(`${row.pid}:${row.identity}`,{event:'process-exited',pid:row.pid,identity:row.identity,...exit});
          this.#emit({ event: 'process-exited', pid: row.pid, identity: row.identity, ...exit, authority: row.authority, ended: row.ended === true });
          if (row.ended) await this.#removeAdmission(launchId);
          this.#settling.delete(row);
        })();
        this.#completions.add(completion);
        try { await completion; } finally { this.#completions.delete(completion); this.#settling.delete(row); }
      });
      this.#nativeCompletions.set(row, nativeCompletion);
      void nativeCompletion.then(() => this.#nativeCompletions.delete(row), () => this.#nativeCompletions.delete(row));
      await admission?.accepted({pid:row.pid,identity:row.identity});
      await checkpoint(join(directory, 'release.json'), { identity: row.identity }); accepted = true;
      child.unref(); acceptedResult = { pid: row.pid, identity: row.identity }; return acceptedResult;
    } catch (error) {
      // This handle is an observed fresh launch; never detach an unaccepted writer.
      child.kill('SIGKILL'); await nativeClosed; await this.#removeAdmission(launchId); throw error;
    } finally {
      this.#inflight.delete(launchId);
      try { if (log) await (this.#hooks.closeLog ? this.#hooks.closeLog(() => log.close()) : log.close()); }
      catch (error) { if (!accepted) throw error; acceptedResult!.warning = 'log descriptor close failed'; }
    }
  }
  async alive(args: Record<string, unknown>) { return typeof args.pid === 'number' && typeof args.identity === 'string' && await this.identity(args.pid) === args.identity; }
  async #group(pid: number) {
    const { stdout } = await exec('ps', ['-axo', 'pid=,ppid=,pgid=,rss=,%cpu=,stat='], { env: this.#env, timeout: 3000, maxBuffer: 8 * 1024 * 1024 });
    const rows = stdout.trim().split('\n').map(line => { const [id, parent, group, rss, cpu, state] = line.trim().split(/\s+/); return { pid: Number(id), parent: Number(parent), group: Number(group), rssBytes: Number(rss) * 1024, cpuPercent: Number(cpu), state: state ?? '' }; }).filter(row => row.pid > 0 && !row.state.startsWith('Z'));
    const selected = new Set([pid]); let changed = true;
    while (changed) { changed = false; for (const row of rows) if (!selected.has(row.pid) && (row.group === pid || selected.has(row.parent))) { selected.add(row.pid); changed = true; } }
    return rows.filter(row => selected.has(row.pid));
  }
  /** Capture while ancestry is intact; preserve earlier positive births across detachment. */
  async #liveTargets(row: ProcessRow,initial=false): Promise<ProcessTarget[] | null> {
    if (!await this.alive(row)) return null;
    const members = await this.#group(row.pid);
    if (!members.some(member => member.pid === row.pid && member.group === row.pid)) return null;
    const previous = row.targets ?? [];
    const pids=[...members.map(member=>member.pid),...previous.map(target=>target.pid)];
    const observations = await (row.adopted?observeClaudeProcesses:observeProcesses)(pids, this.#env);
    if(row.adopted){
      const memberIds=new Set(members.map(member=>member.pid));
      const native=(await claudeProcessMembers(this.#env)).filter(member=>memberIds.has(member.pid));
      const census=initial?new Set<number>():this.#adoptionCensus.get(row)??new Set(native.map(member=>member.pid));
      const acquired=claudeDescendantCapture(row,previous,census,native,observations);
      if('reason' in acquired)return null;
      return await this.alive(row)?acquired.targets:null;
    }
    const targets = new Map<number, ProcessTarget>();
    for (const target of previous) {
      const proof = observations.get(target.pid);
      if (proof?.identity === target.identity) targets.set(target.pid, target);
      else if (!proof?.ended && !proof?.identity) return null;
    }
    for (const member of members) {
      const observation=observations.get(member.pid);
      const identity = observation?.identity;
      if (!identity) {if(row.adopted && observation?.ended)continue;return null;}
      targets.set(member.pid, { pid: member.pid, identity });
    }
    return await this.alive(row) ? [...targets.values()] : null;
  }
  async #capture(args: Record<string, unknown>,retain=true) {
    const row = this.#rows.find(row => row.pid === args.pid && row.identity === args.identity && !row.ended);
    if (!row) return null;
    if (this.#settling.has(row)) await this.#nativeCompletions.get(row);
    if (row.authority === 'unknown') throw new Error('process authority unknown; stop requires host reboot or recycling');
    if (row.ended) return null;
    let captured: ProcessTarget[];
    if (await this.alive(args)) {
      const previous = [...(row.targets??[])];
      const targetVersion = targetKey(row.targets);
      const live = await this.#liveTargets(row);
      if (!live) return null;
      captured = live;
      if(targetKey(row.targets)!==targetVersion){
        if(!row.adopted)return null;
        const proof=await observeClaudeProcesses([...previous,...(row.targets??[]),...live].map(target=>target.pid),this.#env);
        const before=claudePinnedTargets(previous,proof),current=claudePinnedTargets(row.targets??[],proof),settled=claudePinnedTargets(live,proof);
        if(!before||!current||!settled||targetKey(before)!==targetKey(current))return null;
        captured=settled;
      }
    } else {
      if(row.adopted && (await observeProcesses([row.pid],this.#env)).get(row.pid)?.ended)row.rootExitObserved=true;
      if (!row.rootExitObserved) {
        row.authority = 'unknown'; await this.#persist('recover');
        throw new Error('process authority unknown; stop requires host reboot or recycling');
      }
      // Recovery uses only durable descendant births captured by the native close owner.
      captured = [];
      for (const target of row.targets ?? []) {
        const proof = (await (row.adopted?observeClaudeProcesses:observeProcesses)([target.pid], this.#env)).get(target.pid);
        if (proof?.identity === target.identity) captured.push(target);
        else if (!proof?.ended&&!(row.adopted&&proof?.identity)) return null;
      }
    }
    if(row.adopted && row.rootExitObserved){
      // Root absence ends acquisition, not ownership. A hook can have forked
      // after reconciliation's snapshot and still be writing in this group.
      const members=await this.#group(row.pid);
      const observations=await observeClaudeProcesses(members.map(member=>member.pid),this.#env);
      if(members.some(member=>!observations.get(member.pid)?.ended&&!captured.some(target=>target.pid===member.pid&&target.identity===observations.get(member.pid)?.identity))){
        row.authority='unknown';await this.#persist('recover');return null;
      }
      if(!captured.length){row.ended=true;row.authority='closed';}
    }
    if(retain)row.targets = captured; await this.#persist('recover');
    return captured.length ? captured : null;
  }
  async #signalTargets(captured: readonly { pid: number; identity: string }[], signal: NodeJS.Signals,settleExited=false): Promise<boolean> {
    await this.#hooks.beforeSignals?.(captured);
    let sent = false;
    for (const proof of [...captured].reverse()) {
      // Never signal a numeric group: a new member has no captured authority.
      const observation = (await (settleExited?observeClaudeProcesses:observeProcesses)([proof.pid], this.#env)).get(proof.pid);
      if (observation?.ended) continue;
      if (observation?.identity !== proof.identity) {if(settleExited&&observation?.identity)continue;return false;}
      try { process.kill(proof.pid, signal); sent = true; } catch(error) {if(settleExited&&(error as NodeJS.ErrnoException).code==='ESRCH')continue;return false;}
    }
    return sent||settleExited;
  }
  capture(args: Record<string, unknown>) { return this.#capture(args); }
  completionReceipts() {return [...this.#receipts.values()];}
  async operationReceipt(launchId: string): Promise<{state:'accepted';result:{pid:number;identity:string}} | {state:'pending';reason:string} | {state:'failed';error:string}> {
    await this.reconcile();
    const row=this.#rows.find(row=>row.launchId===launchId);
    if(row)return {state:'accepted',result:{pid:row.pid,identity:row.identity}};
    if(this.#admissions.has(launchId))return {state:'pending',reason:'native admission birth incomplete'};
    return {state:'failed',error:'commit interrupted before native admission'};
  }
  async captureForStop(args: Record<string, unknown>) {
    await this.reconcile();
    const row = this.#rows.find(row => row.pid === args.pid && row.identity === args.identity);
    if (row?.ended && row.authority === 'closed') return { closed: true, targets: null };
    if (row) {
      const census=this.#adopted.has(row)?await claudeProcessMembers(this.#env):undefined;
      const targets = await this.#capture(args);
      if(targets&&census)this.#stopCaptures.set(row,{key:targetKey(targets),pids:new Set(census.map(member=>member.pid))});
      return { closed: row.ended === true && row.authority === 'closed', targets };
    }
    const proof = (await observeProcesses([Number(args.pid)], this.#env)).get(Number(args.pid));
    // No retained owner exists after reconciliation; only positive native absence settles it.
    return { closed: proof?.ended === true, targets: null };
  }
  async signal(args: Record<string, unknown>): Promise<boolean> {
    if (!['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].includes(String(args.signal))) throw new Error('unsupported signal');
    const captured = await this.#capture(args); if (!captured) return false;
    return this.#signalTargets(captured, args.signal as NodeJS.Signals);
  }
  async stop(args: Record<string, unknown>): Promise<boolean> {
    if(this.#rows.some(row=>row.adopted && row.pid===args.pid && row.identity===args.identity && row.ended && row.authority==='closed'))return true;
    const freshOwner=this.#rows.find(row=>row.pid===args.pid&&row.identity===args.identity);
    const baseline=freshOwner?this.#stopCaptures.get(freshOwner):undefined;if(freshOwner)this.#stopCaptures.delete(freshOwner);
    const admission=freshOwner&&this.#adopted.has(freshOwner)?claudeStopAdmission(baseline?.pids??new Set((await claudeProcessMembers(this.#env)).map(row=>row.pid))):undefined;
    let captured = await this.#capture(args,!freshOwner||!this.#adopted.has(freshOwner)); if (!captured) return this.#rows.some(row=>row.adopted && row.pid===args.pid && row.identity===args.identity && row.ended && row.authority==='closed');
    const owner = this.#rows.find(row => row.pid === args.pid && row.identity === args.identity)!;
    if(args.captured&&this.#adopted.has(owner)){
      const proof=await observeClaudeProcesses([...(args.captured as ProcessTarget[]),...captured].map(target=>target.pid),this.#env);
      const approved=claudePinnedTargets(args.captured as ProcessTarget[],proof),current=claudePinnedTargets(captured,proof);
      if(!approved||!current)return false;
      if(targetKey(approved)===targetKey(current))args={...args,captured:current};
      captured=current;
    }
    if (args.captured && targetKey(args.captured as ProcessTarget[]) !== targetKey(captured)) {
      const approved=args.captured as ProcessTarget[];
      if(!this.#adopted.has(owner)||baseline?.key!==targetKey(approved))return false;
      const members=await claudeProcessMembers(this.#env);
      const proof=await observeClaudeProcesses([...approved.map(target=>target.pid),...captured.map(target=>target.pid),...members.map(member=>member.pid)],this.#env);
      if(proof.get(owner.pid)?.identity!==owner.identity)return false;
      const acquired=claudeDescendantCapture(owner,approved,baseline.pids,members,proof);
      if('reason' in acquired)return false;
      const expected=acquired.targets;
      const previous=claudePinnedTargets(approved,proof);if(!previous)return false;
      if(targetKey(expected)!==targetKey(previous)&&!admission?.take())return false;
      // Exactly one recapture, before signalling. A second change is incomplete.
      const recaptured=await this.#capture(args,false);
      if(!recaptured)return false;
      const finalProof=await observeClaudeProcesses([...expected,...recaptured].map(target=>target.pid),this.#env);
      const expectedLive=claudePinnedTargets(expected,finalProof),currentLive=claudePinnedTargets(recaptured,finalProof);
      if(!expectedLive||!currentLive||targetKey(currentLive)!==targetKey(expectedLive))return false;
      captured=currentLive;
    }
    if(this.#adopted.has(owner)){owner.targets=captured;await this.#persist('recover');}
    this.#stopping.add(owner);
    try {
      if(this.#adopted.has(owner)){
        const closed=await stopClaude({pid:owner.pid,identity:owner.identity},captured,this.#env,async(targets,signal)=>{
          for(const target of [...targets].reverse())if(!await this.#signalTargets([target],signal,true))return false;
          return true;
        },3000,async targets=>{owner.targets=[...targets];await this.#persist('recover');},admission?{admission}:undefined);
        if(!closed)return false;
        Object.assign(owner,{authority:'closed',ended:true,rootExitObserved:true,targets:[],code:null,signal:null});
        await this.#persist('recover');return true;
      }
      if (!await this.#signalTargets(captured, 'SIGTERM')) return false;
      const remaining = async () => {
        const current = await this.#group(args.pid as number);
        await this.#hooks.beforeRemainingObservation?.(current.map(row=>row.pid));
        const observations = await observeProcesses([...captured.map(p => p.pid), ...current.map(p => p.pid)], this.#env);
        for (const row of current) if (!isCapturedOrExited(observations.get(row.pid),captured.find(proof=>proof.pid===row.pid)?.identity)) return null;
        const survivors = [];
        for (const proof of captured) {
          const observation = observations.get(proof.pid);
          if (observation?.identity === proof.identity) survivors.push(proof);
          else if (!observation?.ended) return null;
        }
        return survivors;
      };
      for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
        if (signal === 'SIGKILL') { const targets = await remaining(); if (!targets) return false; if (targets.length && !await this.#signalTargets(targets, signal)) return false; }
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const targets = await remaining();
          if (!targets) return false;
          if (!targets.length) {
            // A captured stop is its own positive tree-closure owner, including after restart.
            await this.#nativeCompletions.get(owner);
            if (!owner.ended) {
              Object.assign(owner, { authority: 'closed', ended: true, code: owner.code ?? null, signal: owner.signal ?? null, targets: [] });
              if (owner.launchId) await checkpoint(join(this.#launches, owner.launchId, 'closed.json'), owner);
              await this.#persist('recover');
              if (owner.launchId) await this.#removeAdmission(owner.launchId);
            }
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }
      return false;
    } finally { this.#stopping.delete(owner); }
  }
  async processes() {
    await this.reconcile();
    const observations = await observeProcesses(this.#rows.filter(row => !row.ended).flatMap(row => [row.pid, ...(row.targets ?? []).map(target => target.pid)]), this.#env);
    return Promise.all(this.#rows.map(async row => {
      const proof = observations.get(row.pid);
      const alive = row.ended || row.code !== undefined || proof?.ended || proof?.identity && proof.identity !== row.identity
        ? false : proof?.identity === row.identity ? true : null;
      let rssBytes: number | null = null, cpuPercent: number | null = null;
      if (!row.ended && row.authority === 'owned') {
        const version = targetKey(row.targets);
        const anchors = new Map<number, ProcessTarget>();
        let incomplete = alive === null || alive === false && !row.rootExitObserved;
        if (alive) anchors.set(row.pid, { pid: row.pid, identity: row.identity });
        for (const target of row.targets ?? []) {
          const observed = observations.get(target.pid);
          if (observed?.identity === target.identity) anchors.set(target.pid, target);
          else if (!observed?.ended && !observed?.identity) incomplete = true;
        }
        if (!incomplete && anchors.size) {
          try {
            // Current ancestry and retained captures are both roots of this sample.
            const trees = await Promise.all([...anchors.keys()].map(pid => this.#group(pid)));
            const after = await observeProcesses([...anchors.keys()], this.#env);
            const stable = [...anchors.values()].every(target => after.get(target.pid)?.identity === target.identity);
            if (stable && !row.ended && row.authority === 'owned' && targetKey(row.targets) === version) {
              const members = [...new Map(trees.flat().map(member => [member.pid, member])).values()];
              if ([...anchors.keys()].every(pid => members.some(member => member.pid === pid)) && members.every(member => Number.isFinite(member.rssBytes) && member.rssBytes >= 0 && Number.isFinite(member.cpuPercent) && member.cpuPercent >= 0)) {
                rssBytes = members.reduce((sum, member) => sum + member.rssBytes, 0);
                cpuPercent = members.reduce((sum, member) => sum + member.cpuPercent, 0);
              }
            }
          } catch { /* Failed or changing native observations stay unknown. */ }
        }
      }
      return { ...row, alive: row.ended || row.code !== undefined ? false : alive, rssBytes, cpuPercent };
    }));
  }
  async drain() { this.#closed = true; await Promise.allSettled(this.#adoptions.values()); await this.#refresh; await Promise.all(this.#completions); await this.#save; }
}
