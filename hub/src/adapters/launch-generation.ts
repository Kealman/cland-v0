/** Public generation ids fence native processes independently of stable session identity. */
export const launchGenerationKey = (sessionId: string): string => `claude-launch:${sessionId}`;
export const launchOwnerKey = (launchId: string): string => `claude-launch-owner:${launchId}`;
export const earlierLaunch = 'belongs to an earlier launch';
