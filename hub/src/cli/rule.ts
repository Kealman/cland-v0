import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { Rule } from '../rules/rulebook.ts';
import { askHubFrame } from './socket-client.ts';

export async function runRule(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    json: { type: 'boolean' }, all: { type: 'boolean' }, role: { type: 'string' }, scope: { type: 'string' }, reason: { type: 'string' }, title: { type: 'string' }, origin: { type: 'string' }, text: { type: 'string' },
  } });
  const [sub, target, ...extra] = positionals;
  if (!sub || !['add', 'edit', 'retire', 'list', 'show'].includes(sub) || extra.length) throw new Error('usage: cland rule add|edit|retire|list|show (see cland --help)');
  const allowed: Record<string, string[]> = { add: ['scope', 'reason', 'title', 'origin'], edit: ['title', 'text', 'scope', 'reason'], retire: ['reason'], list: ['all', 'role'], show: [] };
  for (const key of Object.keys(values)) if (key !== 'json' && !allowed[sub]!.includes(key)) throw new Error(`rule ${sub} does not take --${key}`);
  let frame: { type: string } & Record<string, unknown>;
  if (sub === 'list') {
    if (target !== undefined) throw new Error('rule list takes no number');
    frame = { type: 'rule.list', all: values.all ?? false, ...(values.role !== undefined ? { role: values.role } : {}) };
  } else if (sub === 'add') {
    if (!target || values.scope === undefined || values.reason === undefined) throw new Error('rule add needs <text>, --scope and --reason');
    frame = { type: 'rule.add', text: target, scope: values.scope, reason: values.reason, ...(values.title !== undefined ? { title: values.title } : {}), ...(values.origin !== undefined ? { origin: values.origin } : {}) };
  } else {
    if (!target || !/^[1-9]\d*$/.test(target) || !Number.isSafeInteger(Number(target))) throw new Error('expected a plain positive rule number');
    if (sub === 'retire' && values.reason === undefined) throw new Error('rule retire needs --reason');
    frame = { type: `rule.${sub}`, number: Number(target), ...Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'json')) };
  }
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run `cland hub start`');
  const result = await askHubFrame(discovery, frame) as { rule?: Rule; rules?: Rule[] };
  process.stdout.write(values.json ? `${JSON.stringify(result)}\n` : (result.rules ?? [result.rule!]).map(printRule).join(''));
  return 0;
}
function printRule(rule: Rule): string {
  return `rule ${rule.number}: ${rule.title}\nScope: ${rule.scope === 'all' ? 'all' : rule.scope.join(', ')}\nDate: ${rule.date}\nStatus: ${rule.status}${rule.retired ? ` ${rule.retired}` : ''}\nOrigin: ${rule.origin}\nReason: ${rule.reason}\n${rule.retired_origin !== undefined ? `Retired-origin: ${rule.retired_origin}\n` : ''}\n${rule.text}\n\n`;
}
