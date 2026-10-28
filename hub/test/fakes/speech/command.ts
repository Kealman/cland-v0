import type { TestContext } from 'node:test';
import { watch } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureEnvironment } from '../../fixture-environment.ts';
import { CommandProvider } from '../../../src/speech/command.ts';
import { transcribeNote } from '../../../src/speech/index.ts';
import { bounded } from './exchange.ts';
import { eventually } from '../../harness.ts';
const input = { audio: Buffer.from([79, 103, 103, 83, 0, 255]), mime: 'audio/ogg', filename: 'voice.ogg' };
export async function commandFixture(t: TestContext, source: string) {
  const root = await mkdtemp(join(tmpdir(), 'cland-speech-command-'));
  const controller = new AbortController();
  const work = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  let incomplete = false;
  const own = <T>(operation: Promise<T>) => {
    work.add(operation);
    void operation.then(() => work.delete(operation), error => {
      if (error instanceof Error && error.message.includes('native drain incomplete')) incomplete = true;
      work.delete(operation);
    });
    return operation;
  };
  const close = () => closing ??= (async () => {
    controller.abort();
    await bounded(Promise.allSettled([...work]), 3_000, 'command fixture drain incomplete; root preserved');
    if (incomplete) throw new Error('command native close incomplete; root preserved');
    await bounded(rm(root, { recursive: true, force: true }), 2_000, 'command fixture removal incomplete');
  })();
  t.after(close);
  const script = join(root, 'command.cjs');
  await writeFile(script, source);
  const env = fixtureEnvironment(root, process.env);
  return { root, script, env, close,
    async reaped(pid: number) {
      await bounded(eventually('command PID reaped', () => {
        try { process.kill(pid, 0); return undefined; }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; }
      }, 2_000), 2_100, 'command PID reaping incomplete; root preserved');
    },
    // Arm the watcher synchronously before triggering the production operation.
    receipt(file: string, setup: { signal?: AbortSignal; timeoutMs?: number } = {}) {
      const local = new AbortController();
      const signal = AbortSignal.any([controller.signal, local.signal, ...(setup.signal ? [setup.signal] : [])]);
      const reads = new Set<Promise<unknown>>();
      let read: () => void = () => {};
      let reading = false;
      const poll = setInterval(() => read(), 25);
      const watcher = watch(root, (_event, changed) => { if (changed === file) read(); });
      const ready = new Promise<number>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled command readiness', 'AbortError')), { once: true });
        if (signal.aborted) { reject(new DOMException('Cancelled command readiness', 'AbortError')); return; }
        read = () => {
          if (reading || signal.aborted) return;
          reading = true;
          const operation = readFile(join(root, file), { encoding: 'utf8', signal }).then(text => {
            const pid = Number(text); if (Number.isSafeInteger(pid) && pid > 0) resolve(pid);
          }, error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') reject(error); });
          reads.add(operation); void operation.finally(() => { reading = false; reads.delete(operation); });
        };
        read();
      });
      return own((async () => {
        try { return await bounded(ready, setup.timeoutMs ?? 2_000, 'command readiness incomplete'); }
        finally { clearInterval(poll); watcher.close(); local.abort(); await bounded(Promise.allSettled([...reads]), 1_000, 'command readiness reads incomplete'); }
      })());
    },
    run(provider: CommandProvider, options: Parameters<typeof transcribeNote>[2] = {}) {
      return own(transcribeNote(provider, { ...input, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]) }, options));
    },
  };
}
