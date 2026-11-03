import { remoteCommandEnvironment } from './agent/command-environment.ts';
import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import type { Host } from './host.ts';

/** Explicit additions cross a machine boundary; the hub's base environment never does. */
export function hostCommandEnvironment(host: Pick<Host, 'name'>, base: NodeJS.ProcessEnv, additions: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return host.name === 'local' ? withoutExecutorCredentials({ ...base, ...additions }) : remoteCommandEnvironment(additions);
}
export { remoteCommandEnvironment } from './agent/command-environment.ts';
