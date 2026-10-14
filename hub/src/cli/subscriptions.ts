// The CLI uses the same caller-owned subscription frames as MCP; it never holds a UI stream open.
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { subscriptionInput } from '../subscriptions.ts';
import type { Subscription } from '../protocol.ts';
import { actorOf } from './actor.ts';
import { askHubFrame } from './socket-client.ts';

export { SUBSCRIPTIONS_USAGE } from './usage.ts';

export async function runSubscriptions(command: string, args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    event: { type: 'string', multiple: true }, digest: { type: 'string' }, cost: { type: 'string' }, tokens: { type: 'string' }, as: { type: 'string' }, json: { type: 'boolean' },
  } });
  const as = actorOf(values, process.env, { err: text => process.stderr.write(text) });
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  const actor = as ? { as } : {};
  let result: { subscription?: Subscription; subscriptions?: Subscription[]; removed?: boolean };
  switch (command) {
    case 'subscribe': {
      const [kind, target] = positionals;
      if (positionals.length !== 2 || !target || !['session', 'item', 'topic', 'role', 'subtree'].includes(kind ?? '')) throw new Error('usage: cland subscribe <session|item|topic|role|subtree> <subject> --event <event>');
      if (values.cost && values.tokens) throw new Error('choose cost or tokens');
      const threshold = values.cost !== undefined ? { cost: Number(values.cost) } : values.tokens !== undefined ? { tokens: Number(values.tokens) } : undefined;
      const input = subscriptionInput({ [kind!]: target }, values.event, values.digest, threshold);
      result = await askHubFrame(d, { type: 'event.subscribe', ...input, ...actor }) as typeof result;
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
  const line = (s: Subscription) => `${s.id} · ${Object.entries(s.subject).map(([k, v]) => `${k} ${v}`).join(' ')} · ${s.events.join(', ')} · ${s.digest}`;
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : `${result.subscription ? line(result.subscription) : result.subscriptions ? result.subscriptions.map(line).join('\n') || 'no subscriptions' : result.removed ? 'unsubscribed' : 'no matching subscription'}\n`);
  return 0;
}
