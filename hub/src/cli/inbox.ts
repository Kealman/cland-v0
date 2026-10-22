// Inbox reads, topic creation and ask answers over the hub's existing frames, with the shell's identity.
import { actorOf } from './actor.ts';
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { ApprovalOutcome, Inbox, Topic, TopicMessage } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

export { INBOX_USAGE } from './usage.ts';
import { TOPIC_USAGE } from './usage.ts';
export { TOPIC_USAGE } from './usage.ts';
const NO_HUB = 'cland: no hub runs for this project — run `cland hub start`\n';

const approvalOutcome = (o: ApprovalOutcome): string => `${o.choice} by ${o.by} via ${o.via} at ${o.at}${o.note ? `: ${firstLine(o.note)}` : ''}`;
const firstLine = (text: string): string => text.split(/\r?\n/, 1)[0] ?? '';
function age(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (!Number.isFinite(minutes)) return '?';
  if (minutes < 60) return `${minutes} m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h`;
}

/** The four now sections, uncapped. JSON remains the unmodified hub frame. */
function describe(v: Inbox): string {
  const lines: string[] = [], now = Date.now();
  const sender = (from: string, role?: string) => role ? `${from} [${role}]` : from;
  const sections = [
    { title: 'Asks and approvals', rows: [
      ...v.asks.filter(a => !a.layer || a.layer === 'now').map(a => ({ since: a.since, text: `ask ${a.id}  ${a.topic.title}${a.topic.item ? ` (${a.topic.item})` : ''}  ${firstLine(a.question)}  from ${a.label}` })),
      ...v.approvals.filter(a => !a.layer || a.layer === 'now').map(a => ({ since: a.since, text: `approval ${a.id}  ${a.session}  ${firstLine(a.command ?? a.subject.change ?? 'waiting for approval')}  ${a.state}  ${a.answerIn === 'tui' ? 'answer in Neovim' : a.choices.join(', ')}  from ${a.label}` })),
    ] },
    { title: 'Plan approvals', rows: (v.plans ?? []).map(p => ({ since: p.since, text: `plan ${p.id}  ${p.title}  ${p.stages ?? '?'} stages · ${p.lanes ?? '?'} lanes · ${p.items ?? '?'} items` })) },
    { title: 'Requests to you', rows: (v.requests ?? []).map(r => ({ since: r.since, text: `${r.request} ${r.id}  ${r.subject}  ${firstLine(r.text)}  from ${sender(r.from, r.fromRole)}` })) },
    { title: 'Messages to you', rows: (v.messages ?? []).filter(m => !m.layer || m.layer === 'now').map(m => ({ since: m.since, text: `message ${m.id}  ${m.topic.item ?? m.topic.title} (${m.topic.id})  ${firstLine(m.text)}  from ${sender(m.from, m.fromRole)}` })) },
  ];
  for (const section of sections) {
    if (!section.rows.length) continue;
    lines.push(`${section.title} (${section.rows.length})`);
    for (const row of section.rows.sort((a, b) => b.since.localeCompare(a.since))) lines.push(`${row.text}  · ${age(row.since, now)}`);
  }
  if (v.needsYou === 0) lines.push('✓ nothing needs you');
  lines.push(`needs you: ${v.needsYou}`);
  return lines.join('\n');
}

export async function runInbox(args: string[], cwd: string = process.cwd()): Promise<number> {
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write(NO_HUB);
    return 1;
  }
  const json = args.includes('--json');
  const archive = args.includes('--archive');
  const v = (await askHubFrame(d, { type: 'inbox.list', ...(archive ? { archive: true } : {}) })) as Inbox;
  const text = archive ? (v.archive ?? []).map(r => `${r.ts}  ${r.kind} ${r.id}  ${r.subject}  ${firstLine(r.text ?? '')}  · ${r.kind === 'approval' && r.outcome && 'choice' in r.outcome ? `closed  ${approvalOutcome(r.outcome)}` : r.reason}`).join('\n') : describe(v);
  process.stdout.write(`${json ? JSON.stringify(v) : text}\n`);
  return 0;
}

export async function runTopic(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'create':
      return runTopicCreate(rest, cwd);
    case 'answer':
      return runTopicAnswer(rest, cwd);
    default:
      process.stderr.write(`cland: unknown topic command "${sub ?? ''}"\n\nusage: cland topic <command>\n\n${TOPIC_USAGE}`);
      return 2;
  }
}

async function runTopicCreate(args: string[], cwd: string): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    item: { type: 'string' }, json: { type: 'boolean' }, as: { type: 'string' },
  } });
  if (positionals.length !== 1 || !positionals[0]?.trim()) throw new Error('usage: cland topic create <title> [--item T-n] [--json] [--as <name>]');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write(NO_HUB);
    return 1;
  }
  const as = actorOf(values, process.env, { err: s => process.stderr.write(s) });
  const v = await askHubFrame(d, {
    type: 'topic.create', title: positionals[0],
    ...(values.item !== undefined ? { item: values.item } : {}), ...(as ? { as } : {}),
  }) as { topic: Topic };
  process.stdout.write(`${values.json ? JSON.stringify(v) : `created ${v.topic.id}: ${v.topic.title}`}\n`);
  return 0;
}

async function runTopicAnswer(args: string[], cwd: string): Promise<number> {
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) {
    process.stderr.write(NO_HUB);
    return 1;
  }
  const [ask, ...rest] = args;
  if (!ask) throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
  const asAt = rest.indexOf('--as');
  let label: string | undefined;
  if (asAt >= 0) {
    label = rest[asAt + 1];
    if (!label?.trim() || label.startsWith('--') || rest.indexOf('--as', asAt + 1) >= 0) throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>" [--as <stand-in name>]');
    rest.splice(asAt, 2);
  }
  const as = actorOf({ as: label }, process.env, { err: s => process.stderr.write(s) });
  let option: number | undefined;
  let text: string | undefined;
  const at = rest.indexOf('--text');
  if (at >= 0) {
    if (at !== 0) throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
    text = rest.slice(1).join(' ');
    if (!text) throw new Error('usage: cland topic answer <ask id> --text "<free answer>"');
  } else if (rest.length === 1) {
    const n = Number(rest[0]);
    // only a number can select an option; any integer goes to the hub, whose refusal (an option out of range,
    // 0 and negatives included) prints `cland: <error>` with exit 1
    if (!Number.isInteger(n)) throw new Error('the option is a number: cland topic answer <ask id> <option number>');
    option = n;
  } else {
    throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
  }
  // the ask's topic title for the confirmation line: the hub answers the rest. The ask must be open to be listed,
  // and the hub's refusal tells the human when it is not.
  const inbox = (await askHubFrame(d, { type: 'inbox.list' })) as Inbox;
  const title = inbox.asks.find((a) => a.id === ask)?.topic.title;
  const v = (await askHubFrame(d, { type: 'topic.answer', ask, ...(as ? { as } : {}), ...(option !== undefined ? { option } : { text }) })) as { message: TopicMessage };
  process.stdout.write(`answered ${ask} in ${title ?? v.message.topic}: ${v.message.text}\n`);
  return 0;
}
