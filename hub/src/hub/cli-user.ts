/** Human writes whose legacy local `as.name` becomes a user name in users mode.
 * Shell/session identities always retain their session authority. No wire fields change.
 */
export const HUMAN_USER_WRITES: ReadonlySet<string> = new Set([
  'topic.answer', 'topic.create', 'topic.send', 'approval.answer', 'artifact.create',
]);
export function localUserName(frame: Record<string, unknown>): string | undefined {
  if (!HUMAN_USER_WRITES.has(String(frame.type))) return undefined;
  const as = frame.as;
  if (!as || typeof as !== 'object') return undefined;
  const actor = as as { name?: unknown; shell?: unknown; sessionId?: unknown };
  if (actor.shell === true || (typeof actor.sessionId === 'string' && actor.sessionId !== '')) return undefined;
  return typeof actor.name === 'string' ? actor.name : undefined;
}
