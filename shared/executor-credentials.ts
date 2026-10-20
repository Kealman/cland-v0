/** Provider credentials used by the hub executor. Keep new provider token names here.
 * The current executor has no configurable token-variable name.
 */
export const EXECUTOR_CREDENTIALS: ReadonlySet<string> = new Set(['DIGITALOCEAN_TOKEN']);

/** Filter by name before reading values; never mutate the hub's API environment.
 * Apply after environment overlays so an overlay cannot restore a credential.
 */
export function withoutExecutorCredentials<T extends NodeJS.ProcessEnv>(base: T): T {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(base)) if (!EXECUTOR_CREDENTIALS.has(key)) env[key] = base[key];
  return env as T;
}
