// The web carries human authority within this explicit, deny-by-default policy.
// Keep this boundary independent of dispatch so protocol extensions add one row.
import type { ClientRequest, HubFrame } from '../protocol.ts';
import type { TaskRequest } from '../tracker/requests.ts';
import type { SessionRequest } from '../adapters/requests.ts';

type HumanRequest = ClientRequest | TaskRequest | SessionRequest;
type WebRule = true | string | ((frame: Record<string, unknown>) => string | null);

/** true allows normal dispatch; each refusal names why that action stays local. */
export const WEB_AUTHORITY = {
  'account.clear': true,
  'account.list': true,
  'account.poll': true,
  'artifact.archive': true,
  'artifact.create': (frame: Record<string, unknown>) => Object.hasOwn(frame, 'path') ? 'reads a local artifact path' : null,
  'artifact.delete': 'deletes artifact state and files',
  'artifact.keep': true,
  'artifact.list': true,
  'artifact.move': true,
  'artifact.promote': true,
  'config.set': 'changes project configuration',
  'crew.set': 'changes crew policy',
  'crew.show': true,
  'demo.exec': 'controls Coordinator and QA demos',
  'demo.start': 'controls Coordinator and QA demos',
  'demo.status': 'controls Coordinator and QA demos',
  'demo.stop': 'controls Coordinator and QA demos',
  'events.list': true,
  'executor.prepare': 'spends executor capacity',
  'executor.reap': 'deletes executor resources',
  'executor.retire-legacy': 'retires executor resources',
  'executor.status': true,
  'hub.reload': 'reloads hub configuration',
  'hub.status': true,
  'hub.stop': 'stops the hub process',
  'hub.subscriptions': true,
  'hygiene.unmute': true,
  'inbox.decline': true,
  'inbox.list': true,
  'inbox.read': true,
  'merge': true,
  'merge.queue': true,
  'models.list': true,
  'prompt.send': true,
  'publish': 'publishes project files',
  'push': 'pushes project history',
  'release': 'publishes a release',
  'role.clear': true,
  'role.launch': true,
  'role.list': true,
  'role.set': true,
  'role.state': true,
  'rule.add': true,
  'rule.edit': true,
  'rule.list': true,
  'rule.retire': true,
  'rule.show': true,
  'session.archive': true,
  'session.attach': true,
  'session.bridge': true,
  'session.launch': true,
  'session.list': true,
  'session.prune': true,
  'session.resume': true,
  'session.retry': true,
  'session.signal': 'changes process lifecycle state',
  'session.stop': true,
  'subscribe': true,
  'suite.cancel': true,
  'suite.classify': true,
  'suite.forced': 'bypasses the suite queue',
  'suite.queue': true,
  'suite.slot': true,
  'suite.start': true,
  'sync': 'moves published branches',
  'task.claim': true,
  'task.close': true,
  'task.comment': true,
  'task.create': true,
  'task.criterion': true,
  'task.edit': true,
  'task.hold': true,
  'task.import': 'imports external tracker state',
  'task.link': true,
  'task.list': true,
  'task.migrate': 'rewrites tracker storage',
  'task.plan': true,
  'task.rank': true,
  'task.view': true,
  'topic.answer': true,
  'topic.close': true,
  'topic.create': true,
  'topic.delete': true,
  'topic.history': true,
  'topic.list': true,
  'topic.read': true,
  'topic.rename': true,
  'topic.resolve': true,
  'topic.send': true,
  'visibility.set': true,
  'web.link': 'mints a local sign-in link',
  'worktree.list': true,
  'worktree.prune': 'deletes worktrees and branches',
} satisfies Record<HumanRequest['type'], WebRule>;

/** Run before replay and actor resolution, including for malformed/unknown frames. */
export function webAuthorityRefusal(frame: Record<string, unknown>): Extract<HubFrame, { ok: false }> | null {
  let reason: string | null;
  if (Object.hasOwn(frame, 'as')) reason = 'acts as another identity';
  else if (typeof frame.type !== 'string' || !Object.hasOwn(WEB_AUTHORITY, frame.type)) reason = 'has no web authority classification';
  else {
    const rule = WEB_AUTHORITY[frame.type as keyof typeof WEB_AUTHORITY];
    reason = rule === true ? null : typeof rule === 'string' ? rule : rule(frame);
  }
  return reason === null ? null : {
    type: 'result', id: typeof frame.id === 'string' ? frame.id : '?', ok: false,
    code: 'cli-neovim-only', error: `${String(frame.type)} lives in the CLI and Neovim: ${reason}`,
  };
}
