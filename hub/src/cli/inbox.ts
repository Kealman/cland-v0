// `cland inbox` and `cland topic answer`: the human answers asks and reads the inbox from a terminal — no workbench
// needed (the open point of #33). Both go over the hub's existing UI frames (`inbox.list`, `topic.answer`, "Asks and
// the inbox"), like `cland role`: readDiscovery, askHubFrame, `--json`.
import { layout, projectRoot, readDiscovery } from '../project.ts';
import type { Inbox, TopicMessage } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';

export const INBOX_USAGE = `  inbox [--json]          the human's inbox: one block per open ask (the ask id, the topic title and
                          its bound item, the asker, the question, the numbered options), then one line
                          per approval, waiting topic and notification, last 'needs you: <n>'
                          (--json for the Inbox as the hub returns it)
`;
export const TOPIC_USAGE = `  topic answer <ask id> <option number>
                          answer an ask with its option n (1-based): prints
                          'answered <ask id> in <topic title>: <the answer>'
    topic answer <ask id> --text "<free answer>"
                          answer an ask with a free answer; the hub's refusals (an ask not open, an option
                          out of range, a free answer to an options-only ask) print 'cland: <error>', exit 1
`;
const NO_HUB = 'cland: no hub runs for this project — run `cland hub start`\n';

/** One block per open ask, then one line per approval, waiting topic and notification, then `needs you`. */
function describe(v: Inbox): string {
  const lines: string[] = [];
  for (const a of v.asks) {
    lines.push(`ask ${a.id}  ${a.topic.title}${a.topic.item ? ` (${a.topic.item})` : ''}  from ${a.label}`);
    lines.push(`  ${a.question}`);
    for (const [i, o] of a.options.entries()) lines.push(`    ${i + 1}. ${o}`);
  }
  for (const ap of v.approvals) lines.push(`approval: ${ap.label} waiting for approval`);
  for (const w of v.waiting) lines.push(`waiting: ${w.title} (${w.id})`);
  for (const n of v.notifications) lines.push(`notification: ${n.text}`);
  lines.push(`needs you: ${v.needsYou}`);
  return lines.join('\n');
}

export async function runInbox(args: string[], cwd: string = process.cwd()): Promise<number> {
  const d = readDiscovery(layout(projectRoot(cwd)).discovery);
  if (!d) {
    process.stderr.write(NO_HUB);
    return 1;
  }
  const json = args.includes('--json');
  const v = (await askHubFrame(d, { type: 'inbox.list' })) as Inbox;
  process.stdout.write(`${json ? JSON.stringify(v) : describe(v)}\n`);
  return 0;
}

export async function runTopic(args: string[], cwd: string = process.cwd()): Promise<number> {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'answer':
      return runTopicAnswer(rest, cwd);
    default:
      process.stderr.write(`cland: unknown topic command "${sub ?? ''}"\n\nusage: cland topic <command>\n\n${TOPIC_USAGE}`);
      return 2;
  }
}

async function runTopicAnswer(args: string[], cwd: string): Promise<number> {
  const d = readDiscovery(layout(projectRoot(cwd)).discovery);
  if (!d) {
    process.stderr.write(NO_HUB);
    return 1;
  }
  const [ask, ...rest] = args;
  if (!ask) throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
  let option: number | undefined;
  let text: string | undefined;
  const at = rest.indexOf('--text');
  if (at >= 0) {
    if (at !== 0) throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
    text = rest.slice(1).join(' ');
    if (!text) throw new Error('usage: cland topic answer <ask id> --text "<free answer>"');
  } else if (rest.length === 1) {
    const n = Number(rest[0]);
    if (!Number.isInteger(n) || n < 1) throw new Error('the option is a number: cland topic answer <ask id> <option number>');
    option = n;
  } else {
    throw new Error('usage: cland topic answer <ask id> <option number> | --text "<free answer>"');
  }
  // the ask's topic title for the confirmation line: the hub answers the rest. The ask must be open to be listed,
  // and the hub's refusal tells the human when it is not.
  const inbox = (await askHubFrame(d, { type: 'inbox.list' })) as Inbox;
  const title = inbox.asks.find((a) => a.id === ask)?.topic.title;
  const v = (await askHubFrame(d, { type: 'topic.answer', ask, ...(option !== undefined ? { option } : { text }) })) as { message: TopicMessage };
  process.stdout.write(`answered ${ask} in ${title ?? v.message.topic}: ${v.message.text}\n`);
  return 0;
}