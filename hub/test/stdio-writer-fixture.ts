// Own acquisition independently of the optional file-readiness receipt.
import { spawn } from 'node:child_process';
import type { TestContext } from 'node:test';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup, ownDirectory, ownProcess, recordedProcess } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';

export function stdioWriterFixture(t: TestContext, channel: 'stdout' | 'stderr', omitReady = false, beforeStop: () => void = () => {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cland-stdio-owned-')));
  const marker = join(root, 'writer.json');
  const acquired = Promise.withResolvers<number>();
  const readiness = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<{ code: number | null; signal: string | null; rootPresent: boolean }>();
  const abort = new AbortController();
  const observations = new Set<Promise<unknown>>();
  let stopParent = async () => {}, stopWriter = async () => {};
  let disposing: typeof closed.promise | undefined;
  let failed = false;
  let writerPid: number | undefined;
  let released = false;
  const acquisition = within(acquired.promise, 3000, undefined, () => new Error('stdio writer IPC acquisition deadline'));
  void acquisition.catch(() => {});
  void readiness.promise.catch(() => {});
  const dispose = () => disposing ??= (async () => {
    abort.abort(new Error('stdio writer setup disposed'));
    // Retain late acquisition; do not spend a new setup bound on readiness.
    await acquisition.catch(() => {});
    beforeStop();
    await stopWriter();
    // Before release the live parent also fences any as-yet-unreported writer.
    await stopParent();
    const receipt = await within(closed.promise, 3000, undefined, () => new Error('stdio writer native close deadline'));
    await Promise.allSettled([acquired.promise, readiness.promise, ...observations]);
    return receipt;
  })().catch(error => { failed = true; throw error; });
  onCleanup(t, dispose); // Before spawn, including abandoned setup.
  const remove = ownDirectory(t, root, { beforeRemove: dispose });
  const code = `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs';
import {fixtureEnvironment} from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
let released=false;
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:${JSON.stringify(root)},env:fixtureEnvironment(${JSON.stringify(root)},process.env),detached:true,stdio:['ignore',${channel === 'stdout' ? "'inherit','ignore'" : "'ignore','inherit'"}]});
const stop=()=>{if(!released) { child.kill('SIGKILL'); child.once('close',()=>process.exit(0)); }};
process.on('disconnect',stop); process.on('SIGTERM',stop);
process.on('message',message=>{if(message==='release'){released=true;process.exit(0);}});
process.send({pid:child.pid});
${omitReady ? '' : `writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid:child.pid})); process.send({ready:true});`}`;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  stopParent = ownProcess(undefined, parent.pid);
  parent.once('error', error => { acquired.reject(error); readiness.reject(error); });
  parent.on('message', message => {
    const value = message as {pid?: number; ready?: boolean};
    if (Number.isSafeInteger(value.pid) && value.pid! > 1 && writerPid === undefined) {
      writerPid = value.pid!;
      stopWriter = ownProcess(undefined, writerPid);
      if (recordedProcess(writerPid)?.identity) acquired.resolve(writerPid);
      else acquired.reject(new Error('stdio writer native birth unavailable before parent release'));
    }
    if (value.ready) readiness.resolve();
  });
  parent.once('close', (code, signal) => {
    acquired.reject(new Error(`stdio writer parent closed before acquisition: ${code ?? signal}`));
    readiness.reject(new Error(`stdio writer parent closed before readiness: ${code ?? signal}`));
    void stat(root).then(() => true, () => false).then(rootPresent => closed.resolve({code, signal, rootPresent}));
  });
  return {
    root, parent, stdout: parent.stdout!, stderr: parent.stderr!, marker, acquisition, dispose, remove,
    recover: () => {
      if (failed) { failed = false; disposing = undefined; }
      return dispose();
    },
    observations: () => observations.size,
    ready: (signal?: AbortSignal) => {
      const work = within(abortable(readiness.promise, AbortSignal.any([abort.signal, ...(signal ? [signal] : [])])), 3000, undefined, () => new Error('stdio writer file readiness deadline'));
      observations.add(work);
      void work.then(() => observations.delete(work), () => observations.delete(work));
      return work;
    },
    release: async () => {
      await acquisition;
      abort.signal.throwIfAborted();
      if (released) return;
      released = true;
      parent.send('release');
    },
  };
}
