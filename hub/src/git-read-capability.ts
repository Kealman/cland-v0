import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogFn } from './log.ts';
import type { HostRunResult } from './host/host.ts';

export const gitReadLog = new AsyncLocalStorage<LogFn>();
const stderrLog: LogFn = entry => process.stderr.write(JSON.stringify(entry) + '\n');
// Git's POSIX regexp has no inline case-insensitive flag. Match every case of
// the conservative key shapes, including future partial-clone extension keys.
const fold = (word: string) => [...word].map(letter => `[${letter}${letter.toUpperCase()}]`).join('');
export const PROMISOR_CONFIG_KEYS = `^(${fold('extensions')}\\.${fold('partialclone')}.*|${fold('remote')}\\..*\\.(${fold('promisor')}|${fold('partialclonefilter')}))$`;

function confirmed(receipt: HostRunResult, code: number): boolean {
  if (receipt.nativeCleanup === 'incomplete') throw Object.assign(new Error(receipt.error ?? 'Git capability probe cleanup incomplete'), receipt);
  return receipt.code === code && receipt.nativeClose?.code === code && receipt.nativeCleanup === 'complete' && !receipt.error;
}
function cachedProbe(cache: Map<string, Promise<boolean>>, key: string, probe: () => Promise<HostRunResult>, accept: (receipt: HostRunResult) => boolean): Promise<boolean> {
  let result = cache.get(key);
  if (!result) {
    result = Promise.resolve().then(probe).then(accept);
    cache.set(key, result);
    void result.catch(() => { if (cache.get(key) === result) cache.delete(key); });
  }
  return result;
}

/** The key identifies an executable's native file identity, not its version text.
 * One owned producer supplies the native close receipt to concurrent callers. */
export class GitReadCapabilities {
  readonly #entries = new Map<string, Promise<boolean>>();
  readonly #reported = new Map<string, WeakSet<LogFn>>();
  supports(key: string, _executable: string, probe: () => Promise<HostRunResult>): Promise<boolean> {
    return cachedProbe(this.#entries, key, probe, receipt => confirmed(receipt, 0));
  }
  async ordinary(probe: () => Promise<HostRunResult>): Promise<boolean> {
    // Effective configuration is queried afresh before each old-Git read. A
    // newly created global/include file must affect the very next admission.
    const receipt = await probe();
    return confirmed(receipt, 1) && receipt.stdout === '' && receipt.stderr === '';
  }
  writerFallback(executable: string, repository: string): void {
    const key = `${executable}\0${repository}`, log = gitReadLog.getStore() ?? stderrLog;
    const reported = this.#reported.get(key) ?? new WeakSet<LogFn>();
    this.#reported.set(key, reported);
    if (!reported.has(log)) {
      reported.add(log);
      try { log({ event: 'git-read-writer-fallback', executable, repository, reason: 'no lazy-fetch suppression and repository not confirmed ordinary', minimumGit: '2.45.0' }); } catch { /* advisory cannot change admission */ }
    }
  }
}
export const gitReadCapabilities = new GitReadCapabilities();
