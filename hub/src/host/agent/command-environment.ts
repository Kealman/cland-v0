import { loginFilePath } from './fake-login-mount.ts';
import { withoutExecutorCredentials } from '../../../../shared/executor-credentials.ts';

/** Applied after every overlay, on both ends of the agent stream. */
export function remoteCommandEnvironment(additions: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = withoutExecutorCredentials(additions);
  for (const key of Object.keys(env)) if (env[key] === undefined || key === 'CLAND_HUB_SECRET' || key === 'CLAND_PROJECT_SECRET' || key.startsWith('CLAND_HOST_')) delete env[key];
  for (const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN']) delete env[key];
  return env;
}

/** Resolve login homes only on the executing Host, using its authoritative fake layout. */
export async function loginExecutionEnvironment(additions: NodeJS.ProcessEnv, agentEnv: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const env = remoteCommandEnvironment(additions);
  for (const key of ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'OPENCODE_DB']) {
    if (env[key] !== undefined) env[key] = await loginFilePath(env[key], agentEnv);
  }
  return env;
}
