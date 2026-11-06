import { DigitalOceanHostProvider, type DigitalOceanHostProviderOptions } from './digitalocean.ts';
import { FakeHostProvider, type FakeHostProviderOptions } from './fake.ts';
import type { HostProvider } from './provider.ts';

/** Pool callers resolve names here; provider registration is hub code, never
 * project-supplied executable code. fake always retains its environment fence. */
export class HostProviderRegistry {
  readonly #factories = new Map<string, () => HostProvider>();
  readonly #instances = new Map<string, HostProvider>();
  constructor(options: FakeHostProviderOptions & { digitalocean?: Omit<DigitalOceanHostProviderOptions, 'env'> }) {
    this.#factories.set('fake', () => new FakeHostProvider(options));
    this.#factories.set('digitalocean', () => new DigitalOceanHostProvider({ root: options.env.CLAND_FAKE_HOST_ROOT ?? process.cwd(), ...options.digitalocean, env: options.env }));
  }
  register(name: string, factory: () => HostProvider): void {
    if (!name || this.#factories.has(name)) throw new Error('host provider already registered or unnamed');
    this.#factories.set(name, factory);
  }
  resolve(pool: { provider: string }): HostProvider {
    const name = pool.provider;
    const existing = this.#instances.get(name);
    if (existing) return existing;
    const factory = this.#factories.get(name);
    if (!factory) throw new Error(`unknown host provider: ${name}`);
    const provider = factory(); this.#instances.set(name, provider); return provider;
  }
}
