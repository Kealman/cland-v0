import type { ProjectConfig } from '../init/config.ts';
import { loopbackAddress } from '../web-address.ts';
import { fileURLToPath } from 'node:url';
import { webBundleState } from '../web-bundle.ts';
import { ok, warn, type Check } from './report.ts';

/** Inspect this cland installation's bundle, independently of the project being diagnosed. */
export async function checkWebBundle(root = fileURLToPath(new URL('../../../', import.meta.url))): Promise<Check> {
  const result = await webBundleState(root);
  return result.state === 'current' ? ok('web bundle', result.detail) : warn('web bundle', result.detail, 'npm run build in the cland installation');
}


export function checkWebNetwork(web: ProjectConfig['web']): Check {
  if (!loopbackAddress(web.bind) && !web.origin) return warn('web network', `plain HTTP on ${web.bind} carries the cookie in clear; phones get no notifications or install`, 'set [web] origin to your HTTPS tunnel, or [web] bind to 127.0.0.1');
  return ok('web network', web.origin ? `HTTPS tunnel ${web.origin}` : `loopback ${web.bind}`);
}
