// The CLI uses the same caller-owned subscription frames as MCP; it never holds a UI stream open.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { subscriptionInput } from '../subscriptions.ts';
import type { Subscription } from '../protocol.ts';
import { actorOf } from './actor.ts';
import { askHubFrame } from './socket-client.ts';

export const SUBSCRIPTIONS_USAGE = `  subscribe <session|item> <subject> --event <session.state|task> [--event e]…
  unsubscribe <subscription id>
  subscriptions  list the caller's subscriptions
                  --as <session> from the human CLI; launched shells use their own identity; --json
`;

export async function runSubscriptions(command: string, args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    event: { type: 'string', multiple: true }, as: { type: 'string' }, json: { type: 'boolean' },
  } });
  const as = actorOf(values, process.env, { err: text => process.stderr.write(text) });
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const actor = as ? { as } : {};
  let result: { subscription?: Subscription; subscriptions?: Subscription[]; removed?: boolean };
  switch (command) {
    case 'subscribe': {
      const [kind, target] = positionals;
      if (positionals.length !== 2 || !target || !['session', 'item'].includes(kind ?? '')) throw new Error('usage: cland subscribe <session|item> <subject> --event <event>');
      const input = subscriptionInput({ [kind!]: target }, values.event);
      result = await askHubFrame(d, { type: 'event.subscribe', subject: input.subject, events: input.events, ...actor }) as typeof result;
      break;
    }
    case 'unsubscribe':
      if (positionals.length !== 1 || values.event) throw new Error('usage: cland unsubscribe <subscription id>');
      result = await askHubFrame(d, { type: 'event.unsubscribe', subscription: positionals[0], ...actor }) as typeof result;
      break;
    case 'subscriptions':
      if (positionals.length || values.event) throw new Error('usage: cland subscriptions');
      result = await askHubFrame(d, { type: 'event.subscriptions', ...actor }) as typeof result;
      break;
    default: throw new Error(`unknown subscription command ${command}`);
  }
  const line = (s: Subscription) => `${s.id} · ${'session' in s.subject ? `session ${s.subject.session}` : `item ${s.subject.item}`} · ${s.events.join(', ')} · ${s.digest}`;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.subscription ? line(result.subscription) : result.subscriptions ? result.subscriptions.map(line).join('\n') || 'no subscriptions' : result.removed ? 'unsubscribed' : 'no matching subscription'}\n`);
  return 0;
}
