// A host authenticates a transport, never a human. Unknown operations stay denied.
export const HOST_SESSION_FRAMES: ReadonlySet<string> = new Set([
  'ping', 'status.get', 'status.set', 'send', 'history', 'who', 'status', 'rename',
  'ask', 'ask.forward', 'ask.answer', 'resolve',
  'task.create', 'task.close', 'task.view', 'task.list', 'task.claim', 'task.comment', 'task.edit', 'task.criterion', 'task.link', 'task.hold', 'task.plan', 'task.rank',
  'artifact.create', 'artifact.list', 'artifact.keep', 'artifact.archive', 'artifact.move',
  'topic.create', 'topic.history', 'event.subscribe', 'event.subscriptions', 'event.unsubscribe',
  'role.state', 'rule.list', 'rule.show', 'session.list', 'session.signal', 'session.bridge',
  'suite.start', 'suite.queue', 'suite.slot', 'verification.decline',
]);
export function hostAuthorityRefusal(frame: Record<string, unknown>): string | null {
  return HOST_SESSION_FRAMES.has(String(frame.type)) ? null : 'host clients cannot request this operation';
}
