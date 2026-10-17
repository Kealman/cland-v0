// Harness-owned discovery, shared by CLI and launcher. No provider API or default OpenCode database.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { accountEnvironment, clandOpenCodeDatabase, namedAccount, readAccounts, selectAccount } from './accounts/registry.ts';
import { AppServerClient } from './adapters/codex/app-server.ts';
import { OpenCodeClient, formatModel, pickFreeModel } from './adapters/opencode/client.ts';
import { harnessInstallation } from './doctor/harnesses.ts';
import type { HarnessId } from './doctor/ranges.ts';
import type { Store } from './hub/store.ts';

export type ModelList = { harness: HarnessId; account: string | null; models: Array<{ id: string; default: boolean }>; source: string; probedAt: string };
export type ModelsAnswer = ModelList & { cached: boolean };
const LIFETIME = 24 * 60 * 60_000;
const BOUND = 10_000;
// This short-lived probe reads its own server's startup announcement.
const listeningUrl = (output: string): string | null => /listening on (https?:\/\/[^\s]+)/i.exec(output)?.[1]?.replace(/\/+$/, '') ?? null;

export class HarnessModels {
  readonly #store: Store;
  readonly #root: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #pending = new Map<string, Promise<ModelsAnswer>>();
  readonly #requests = new Set<Promise<ModelsAnswer>>();
  readonly #kills = new Set<() => void>();
  #closed = false;
  constructor(store: Store, root: string, env = process.env) { this.#store = store; this.#root = root; this.#env = env; }

  list(harness: HarnessId, account?: string, refresh = false): Promise<ModelsAnswer> {
    const work = this.#list(harness, account, refresh);
    this.#requests.add(work);
    void work.finally(() => this.#requests.delete(work)).catch(() => {});
    return work;
  }
  async #list(harness: HarnessId, account: string | undefined, refresh: boolean): Promise<ModelsAnswer> {
    if (this.#closed) throw new Error('hub stopped');
    const overlay = account ? (await selectAccount(namedAccount(await readAccounts(this.#env), account), harness, this.#env)).accountEnv : harness === 'opencode' ? { OPENCODE_DB: clandOpenCodeDatabase(this.#env) } : null;
    const installed = await harnessInstallation(harness, this.#env);
    // Match adapter launch filtering before applying the selected account. In particular, an
    // inherited inline OpenCode config must not override the probe's private configuration.
    const base: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(this.#env)) {
      if (key.startsWith('CLAND_')) continue;
      if (harness === 'opencode' && ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_PASSWORD', 'OPENCODE_DB', 'XDG_DATA_HOME'].includes(key)) continue;
      base[key] = value;
    }
    const env = accountEnvironment(base, overlay);
    if (!installed.bin) throw new Error(`${harness}: ${installed.missing!.detail} — fix: ${installed.missing!.fix}`);
    const identity = [harness, account ?? null, env.CODEX_HOME, env.CLAUDE_CONFIG_DIR, env.OPENCODE_DB, env.XDG_DATA_HOME, env.HOME];
    const key = `models:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`;
    if (this.#closed) throw new Error('hub stopped');
    const saved = this.#store.meta(key);
    const cached = saved ? JSON.parse(saved) as ModelList : null;
    if (!refresh && cached && Date.now() - Date.parse(cached.probedAt) < LIFETIME) return { ...cached, cached: true };
    const pending = this.#pending.get(key);
    if (pending) return pending;
    const work = (async (): Promise<ModelsAnswer> => {
      try {
        const models = await this.#probe(harness, installed.bin!, env);
        if (this.#closed) throw new Error('hub stopped');
        const answer: ModelList = { harness, account: account ?? null, models, source: harness === 'claude-code' ? 'Claude Code static aliases' : harness === 'codex' ? 'Codex app-server model/list' : 'OpenCode server /api/model', probedAt: new Date().toISOString() };
        this.#store.setMeta(key, JSON.stringify(answer));
        return { ...answer, cached: false };
      } catch (error) {
        if (cached && !this.#closed) return { ...cached, cached: true };
        throw error;
      }
    })().finally(() => this.#pending.delete(key));
    this.#pending.set(key, work);
    return work;
  }

  async #probe(harness: HarnessId, bin: string, env: NodeJS.ProcessEnv): Promise<ModelList['models']> {
    if (this.#closed) throw new Error('hub stopped');
    if (harness === 'claude-code') return ['default', 'sonnet', 'opus', 'haiku'].map(id => ({ id, default: id === 'default' }));
    const base = join(this.#root, '.cland', 'run', 'models');
    await mkdir(base, { recursive: true });
    const cwd = await mkdtemp(join(base, 'probe-'));
    let client: AppServerClient | undefined;
    try {
      const password = randomBytes(24).toString('hex');
      if (harness === 'opencode') {
        if (env.OPENCODE_DB) await mkdir(dirname(env.OPENCODE_DB), { recursive: true, mode: 0o700 });
        await writeFile(join(cwd, 'opencode.json'), '{}\n');
      }
      if (this.#closed) throw new Error('hub stopped');
      const child = spawn(bin, harness === 'codex' ? ['app-server'] : ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
        cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
        env: harness === 'opencode' ? { ...env, OPENCODE_CONFIG: join(cwd, 'opencode.json'), OPENCODE_PASSWORD: password } : env,
      });
      let rejectFailure!: (error: Error) => void;
      const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
      const kill = () => {
        if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
      };
      const cancel = () => { rejectFailure(new Error('hub stopped')); kill(); };
      this.#kills.add(cancel);
      const ended = new Promise<void>(resolve => {
        child.once('error', error => { rejectFailure(error); resolve(); });
        child.once('close', () => { rejectFailure(new Error(`${harness} model probe exited before its answer`)); resolve(); });
      });
      const abort = new AbortController();
      const deadline = Date.now() + BOUND;
      const timer = setTimeout(() => { rejectFailure(new Error(`${harness} model probe timed out after ${BOUND} ms`)); kill(); }, BOUND);
      let output = '';
      let bytes = 0;
      const capture = (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) { rejectFailure(new Error(`${harness} model probe output too large`)); kill(); return; }
        if (harness === 'opencode') output += String(chunk);
      };
      child.stderr.on('data', capture);
      child.stdout.on('data', capture);
      try {
        return await Promise.race([failure, (async () => {
          if (harness === 'codex') {
            client = await AppServerClient.connectStdio(child.stdout, child.stdin, { client: { name: 'cland-models', version: '1' }, timeoutMs: BOUND });
            const models: ModelList['models'] = [];
            let cursor: string | null = null;
            const cursors = new Set<string>();
            do {
              const page: { data: Array<{ model: string; isDefault: boolean }>; nextCursor?: string | null } = await client.request('model/list', { cursor, limit: 100 });
              if (!Array.isArray(page.data) || page.data.some(m => typeof m.model !== 'string' || typeof m.isDefault !== 'boolean')) throw new Error('Codex model/list returned an invalid catalog');
              models.push(...page.data.map(m => ({ id: m.model, default: m.isDefault })));
              cursor = page.nextCursor ?? null;
              if (cursor && cursors.has(cursor)) throw new Error('Codex model/list repeated its cursor');
              if (cursor) cursors.add(cursor);
            } while (cursor);
            if (!models.length) throw new Error('Codex model/list returned no models');
            return models;
          }
          let url: string | null = null;
          while (!(url = listeningUrl(output))) await sleep(25, undefined, { signal: abort.signal });
          const http = new OpenCodeClient(url, password);
          while (Date.now() < deadline) {
            const catalog = await http.models(Math.max(1, deadline - Date.now()));
            if (!Array.isArray(catalog) || catalog.some(m => typeof m.id !== 'string' || typeof m.providerID !== 'string')) throw new Error('OpenCode returned an invalid model catalog');
            if (catalog.length) {
              const chosen = pickFreeModel(catalog);
              return catalog.filter(m => m.enabled !== false && (m.status === undefined || m.status === 'active')).map(m => ({ id: formatModel(m), default: !!chosen && formatModel(m) === formatModel(chosen) }));
            }
            await sleep(100, undefined, { signal: abort.signal });
          }
          throw new Error('OpenCode returned no models before the probe timeout');
        })()]);
      } finally {
        abort.abort();
        clearTimeout(timer);
        this.#kills.delete(cancel);
        client?.close();
        kill();
        await ended;
      }
    } finally { await rm(cwd, { recursive: true, force: true }); }
  }

  async close(): Promise<void> {
    this.#closed = true;
    for (const kill of this.#kills) kill();
    await Promise.allSettled(this.#requests);
  }
}
