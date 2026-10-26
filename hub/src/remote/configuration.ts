import { isDeepStrictEqual } from 'node:util';
import type { ProjectConfig } from '../init/config.ts';
import type { RemoteVia } from '../protocol.ts';
import { Gateway, type Remote } from './gateway.ts';
import type { Secrets } from './secrets.ts';

export type RemoteSettings = Pick<ProjectConfig, 'remote' | 'speech'>;
/** Native platform construction stays injectable; credentials never enter frames. */
export type MessengerFactory = (via: RemoteVia, token: string, settings: RemoteSettings) => Remote;

/** Own replacement gateways through their final stop receipt, including reload/shutdown races. */
export class ConfiguredGateway {
  readonly #factory: MessengerFactory;
  readonly #create: (remotes: readonly Remote[]) => Gateway;
  #gateway: Gateway | undefined;
  #loaded: { settings: RemoteSettings; secrets: Secrets } | undefined;
  #work: Promise<void> = Promise.resolve();
  #closing = false;

  constructor(factory: MessengerFactory, create: (remotes: readonly Remote[]) => Gateway) {
    this.#factory = factory; this.#create = create;
  }

  update(config: ProjectConfig, secrets: Secrets): Promise<void> {
    const candidate = structuredClone({ settings: { remote: config.remote, speech: config.speech }, secrets });
    const work = this.#work.then(async () => {
      if (this.#closing) throw new Error('gateway is stopping');
      if (isDeepStrictEqual(candidate, this.#loaded)) return;
      await this.#gateway?.stop();
      if (this.#closing) throw new Error('gateway is stopping');
      this.#gateway = undefined;
      const remotes: Remote[] = [];
      for (const via of ['telegram', 'discord'] as const) {
        const token = candidate.secrets[`${via}.token`];
        if (!candidate.settings.remote[via].enabled || !token) continue;
        // A construction fault has the same isolated lifetime as a startup fault.
        try { remotes.push(this.#factory(via, token, structuredClone(candidate.settings))); }
        catch (error) { remotes.push({ id: via, via, start: () => { throw error; }, receive: () => {}, stop: () => {} }); }
      }
      if (remotes.length) {
        this.#gateway = this.#create(remotes);
        await this.#gateway.start();
      }
      if (this.#closing) throw new Error('gateway is stopping');
      this.#loaded = candidate;
    });
    this.#work = work.catch(() => {});
    return work;
  }

  async stop(): Promise<void> {
    this.#closing = true;
    // Cancel lease waits and fence a held start before joining the reload owner.
    const results = await Promise.allSettled([this.#gateway?.stop(), this.#work]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    await this.#gateway?.stop();
  }
}
