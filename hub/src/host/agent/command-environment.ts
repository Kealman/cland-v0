import { withoutExecutorCredentials } from '../../../../shared/executor-credentials.ts';

/** Applied after every overlay, on both ends of the agent stream. */
export function remoteCommandEnvironment(additions: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = withoutExecutorCredentials(additions);
  for (const key of Object.keys(env)) if (env[key] === undefined || key === 'CLAND_HUB_SECRET' || key === 'CLAND_PROJECT_SECRET' || key.startsWith('CLAND_HOST_')) delete env[key];
  return env;
}
