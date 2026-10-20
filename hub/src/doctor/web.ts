import { fileURLToPath } from 'node:url';
import { webBundleState } from '../web-bundle.ts';
import { ok, warn, type Check } from './report.ts';

/** Inspect this cland installation's bundle, independently of the project being diagnosed. */
export async function checkWebBundle(root = fileURLToPath(new URL('../../../', import.meta.url))): Promise<Check> {
  const result = await webBundleState(root);
  return result.state === 'current' ? ok('web bundle', result.detail) : warn('web bundle', result.detail, 'npm run build in the cland installation');
}
