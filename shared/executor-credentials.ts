/** Hub-only executor, messenger and speech credentials.
 * Every child launch, including speech commands, filters these after overlays.
 */
export const EXECUTOR_CREDENTIALS: ReadonlySet<string> = new Set([
  'DIGITALOCEAN_TOKEN', 'CLAND_TELEGRAM_TOKEN', 'CLAND_DISCORD_TOKEN',
  'ELEVENLABS_API_KEY', 'XAI_API_KEY',
]);

/** Filter by name before reading values; never mutate the hub's API environment.
 * Apply after environment overlays so an overlay cannot restore a credential.
 */
export function withoutExecutorCredentials<T extends NodeJS.ProcessEnv>(base: T): T {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(base)) if (!EXECUTOR_CREDENTIALS.has(key)) env[key] = base[key];
  return env as T;
}

/** Role sessions cannot inherit the executor fixture's transport authority. */
export function withoutExecutorTransportOverrides(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(base)) {
    if (key !== 'CLAND_TEST_EXECUTOR_TRANSPORT' && key !== 'CLAND_TEST_FAKE_MACHINE_ROOT') env[key] = base[key];
  }
  return env;
}
