import type { HostPools } from './pools.ts';
import { secretFingerprint } from '../remote/secrets.ts';

/** Resolved hub environment diagnostics: never instantiate a provider or persist a value. */
export function providerTokens(settings: HostPools, env: NodeJS.ProcessEnv, requested?: 'digitalocean') {
 return {providers:[...new Set(requested ? [requested] : Object.values(settings.pools).map(pool=>pool.provider))].sort().map(provider=>{
  if(provider==='fake')return {provider,tokenNeeded:false,present:false,fingerprint:null};
  if(provider!=='digitalocean')throw Error('unknown host provider: '+provider);
  const token=env.DIGITALOCEAN_TOKEN;
  return {provider,tokenNeeded:true,present:!!token,fingerprint:token?secretFingerprint(token):null};
 })};
}
