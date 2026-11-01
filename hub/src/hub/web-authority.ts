// The web carries human authority within this explicit, deny-by-default policy.
// Keep this boundary independent of dispatch so protocol extensions add one row.
import type { ClientRequest, HubFrame } from '../protocol.ts';
import type { TaskRequest } from '../tracker/requests.ts';
import type { Users } from './users.ts';
import type { SessionRequest } from '../adapters/requests.ts';

type HumanRequest = ClientRequest | TaskRequest | SessionRequest;
export type WebRule = true | string | ((frame: Record<string, unknown>) => string | null);

export type AuthorityRow = WebRule | { web: WebRule; roles: readonly string[] };
export type UserAuthorityTable = Readonly<Record<string, AuthorityRow>>;
const ADMIN_ROLES: readonly string[] = ['admin'];

/** true allows normal dispatch; each refusal names why that action stays local. */
export const WEB_AUTHORITY = {
  'auth.mode': 'changes sign-in mode through the local CLI',
  'auth.reset': 'resets sign-in mode through the local CLI',
  'user.list': 'lists users through the local CLI',
  'account.clear': true,
  'account.list': true,
  'account.poll': true,
  'approval.answer': true,
  'artifact.archive': true,
  'artifact.create': (frame: Record<string, unknown>) => Object.hasOwn(frame, 'path') ? 'reads a local artifact path' : null,
  'artifact.delete': 'deletes artifact state and files',
  'artifact.keep': true,
  'artifact.list': true,
  'artifact.move': true,
  'artifact.promote': true,
  'artifact.url': true,
  'artifact.upload': true,
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
  'remote.test': 'remote management stays on the local connection',
  'remote.unpair': 'remote management stays on the local connection',
  'remote.status': 'remote management stays on the local connection',
  'pairing.approve': 'grants new remote access',
  'prompt.send': true,
  'publish': 'publishes project files',
  'push': 'pushes project history',
  'release': 'publishes a release',
  'resume': true,
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
  'session.launch': (frame: Record<string, unknown>) => Object.hasOwn(frame, 'cwd') ? 'sets a launch directory' : null,
  'session.list': true, // Includes the archived merged-row read.
  'session.history': true,
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
  'marks.get': true,
  'marks.set': true,
  'topic.rename': true,
  'topic.resolve': true,
  'topic.send': true,
  'topic.withdraw': true,
  'visibility.set': true,
  'web.link': 'mints a local sign-in link',
  'web.session': true,
  'web.sessions': 'lists local browser sessions',
  'web.revoke': 'revokes a local browser session',
  'worktree.list': true,
  'worktree.prune': 'deletes worktrees and branches',
} satisfies Record<HumanRequest['type'], AuthorityRow>;

/** Run before replay and actor resolution, including for malformed/unknown frames. */
export function webAuthorityRefusal(frame: Record<string, unknown>, table: UserAuthorityTable = WEB_AUTHORITY): Extract<HubFrame, { ok: false }> | null {
  let reason: string | null;
  if (Object.hasOwn(frame, 'as')) reason = 'acts as another identity';
  else if (typeof frame.type !== 'string' || !Object.hasOwn(table, frame.type)) reason = 'has no web authority classification';
  else {
    const row = table[frame.type]!;
    const rule = typeof row === 'object' ? row.web : row;
    reason = rule === true ? null : typeof rule === 'string' ? rule : rule(frame);
  }
  return reason === null ? null : {
    type: 'result', id: typeof frame.id === 'string' ? frame.id : '?', ok: false,
    code: 'cli-neovim-only', error: `${String(frame.type)} lives in the CLI and Neovim: ${reason}`,
  };
}

/** Shared human role boundary for web, CLI and gateway callers. Pass only a
 * transport-resolved user id; never accept identity or role from frame fields.
 * Single mode is unchanged. Read the durable user anew for every request.
 */
export function userAuthorityRefusal(users: Users, userId: string | null | undefined,
  frame: Record<string, unknown>, table: UserAuthorityTable = WEB_AUTHORITY,
): Extract<HubFrame, { ok: false }> | null {
  if (users.mode() !== 'users') return null;
  const user = userId ? users.get(userId) : null;
  const row = typeof frame.type === 'string' && Object.hasOwn(table, frame.type) ? table[frame.type] : undefined;
  const roles = typeof row === 'object' ? row.roles : row === undefined ? [] : ADMIN_ROLES;
  if (user?.state === 'active' && roles.includes(user.role)) return null;
  return { type: 'result', id: typeof frame.id === 'string' ? frame.id : '?', ok: false,
    code: 'forbidden', permission: String(frame.type), role: user?.role ?? null,
    reason: 'user role does not grant this request',
    error: `User role ${user?.role ?? '(unknown)'} cannot request ${String(frame.type)}` };
}
