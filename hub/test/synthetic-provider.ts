import type { Provider } from '../src/executor/droplet/dependencies.ts';

/** Deliberate fake-provider input, separate from arbitrary environment overlays. */
export type SyntheticProvider = { token: `cland-test-${string}` } & ({ endpoint: string } | { api: Provider });

export function syntheticProviderEnvironment(env: NodeJS.ProcessEnv, provider: SyntheticProvider, injectedApi?: Provider): NodeJS.ProcessEnv {
  if (!/^cland-test-[a-z0-9-]+$/.test(provider.token)) throw new Error('synthetic provider requires a cland-test sentinel token');
  if ('api' in provider) {
    if (!provider.api || provider.api !== injectedApi) throw new Error('synthetic provider requires the injected fake API');
    // Prevent an unrelated URL override from becoming a fallback transport.
    const { CLAND_DIGITALOCEAN_API: _endpoint, ...sealed } = env;
    return { ...sealed, DIGITALOCEAN_TOKEN: provider.token };
  }
  let endpoint: URL;
  try { endpoint = new URL(provider.endpoint); } catch { throw new Error('synthetic provider requires a loopback HTTP endpoint'); }
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(endpoint.hostname) || !endpoint.port || endpoint.username || endpoint.password) throw new Error('synthetic provider requires a loopback HTTP endpoint');
  return { ...env, DIGITALOCEAN_TOKEN: provider.token, CLAND_DIGITALOCEAN_API: endpoint.href.replace(/\/$/, '') };
}
