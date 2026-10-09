// `cland task <create|view|list|comment|edit|close|link|claim>`: the tracker through the project's hub, over
// its Unix socket. Every write goes through the hub; this side only parses arguments and prints.
import { readFileSync } from 'node:fs';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { hubDiscovery, pidAlive, projectRoot, readDiscovery } from '../project.ts';
import type { Claim } from '../tracker/index-db.ts';
import type { ItemSummary, ItemView } from '../tracker/tracker.ts';
import { actorOf } from './actor.ts';
import { askHubFrame } from './socket-client.ts';
import { IMPORT_USAGE, runImportGithub } from './task-import.ts';

export const TASK_USAGE = `  task create <title> [--kind k] [--body t | --body-file f] [--label l]… [--assignee a]
                  [--parent T-n] [--blocked-by T-n]… [--topic t] [--branch b]
  task view <id>
  task list [--state open|closed] [--label l]… [--kind k] [--assignee a] [--verdict review=clear]
  task comment <id> <text> [--verdict review|qa --result clear|"not clear" --run <id>]
  task edit <id> [--title t] [--body t | --body-file f] [--kind k] [--state s] [--label l]…
                  [--add-label l]… [--remove-label l]… [--assignee a|none]
  task close <id> [--comment t]
  task link <id> [--parent T-n|none] [--blocked-by T-n]… [--unblock T-n]… [--topic t|none] [--branch b|none]
  task claim <id> [--release] [--force]
${IMPORT_USAGE}                  every task command takes --json, and --as <name> [--role r] (default: "human"). In a
                  launched session's shell ($CLAND_SESSION_ID / $CLAND_SESSION_NAME) the call is always
                  that session's, checked against its role as its own tools are; --as cannot change it.
                  The human acting --as a session the hub knows is checked against that session's role
`;

type Io = { out: (s: string) => void; err: (s: string) => void };
const stdio: Io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) };

const COMMON = {
  json: { type: 'boolean' },
  as: { type: 'string' },
  role: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const OPTIONS = {
  create: { ...COMMON, kind: { type: 'string' }, body: { type: 'string' }, 'body-file': { type: 'string' }, label: { type: 'string', multiple: true }, assignee: { type: 'string' }, parent: { type: 'string' }, 'blocked-by': { type: 'string', multiple: true }, topic: { type: 'string' }, branch: { type: 'string' } },
  view: { ...COMMON },
  list: { ...COMMON, state: { type: 'string' }, label: { type: 'string', multiple: true }, kind: { type: 'string' }, assignee: { type: 'string' }, verdict: { type: 'string' } },
  comment: { ...COMMON, verdict: { type: 'string' }, result: { type: 'string' }, run: { type: 'string' }, 'body-file': { type: 'string' } },
  edit: { ...COMMON, title: { type: 'string' }, body: { type: 'string' }, 'body-file': { type: 'string' }, kind: { type: 'string' }, state: { type: 'string' }, label: { type: 'string', multiple: true }, 'add-label': { type: 'string', multiple: true }, 'remove-label': { type: 'string', multiple: true }, assignee: { type: 'string' } },
  close: { ...COMMON, comment: { type: 'string' } },
  link: { ...COMMON, parent: { type: 'string' }, 'blocked-by': { type: 'string', multiple: true }, unblock: { type: 'string', multiple: true }, topic: { type: 'string' }, branch: { type: 'string' } },
  claim: { ...COMMON, release: { type: 'boolean' }, force: { type: 'boolean' } },
} as const satisfies Record<string, ParseArgsConfig['options']>;

type Sub = keyof typeof OPTIONS;
type Values = Record<string, string | boolean | string[] | undefined>;

class UsageError extends Error {}

/** `none` (or an empty value) clears a single-valued field. */
const clearable = (v: string | undefined): string | null | undefined => (v === undefined ? undefined : v === '' || v === 'none' ? null : v);

const readBody = (v: Values): string | undefined => {
  const file = v['body-file'];
  if (typeof file === 'string') return readFileSync(file === '-' ? 0 : file, 'utf8');
  return typeof v.body === 'string' ? v.body : undefined;
};

const defined = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));

function frameOf(sub: Sub, positionals: string[], v: Values): { type: string } & Record<string, unknown> {
  const needId = (): string => {
    const id = positionals[0];
    if (!id) throw new UsageError(`task ${sub} needs an item id (T-<n>)`);
    return id;
  };
  switch (sub) {
    case 'create': {
      const title = positionals.join(' ').trim();
      if (!title) throw new UsageError('task create needs a title');
      return defined({
        type: 'task.create',
        title,
        kind: v.kind,
        body: readBody(v),
        labels: v.label,
        assignee: v.assignee,
        parent: v.parent,
        blocked_by: v['blocked-by'],
        topic: v.topic,
        branch: v.branch,
      }) as { type: string };
    }
    case 'view':
      return { type: 'task.view', item: needId() };
    case 'list':
      return defined({ type: 'task.list', state: v.state, labels: v.label, kind: v.kind, assignee: v.assignee, verdict: v.verdict }) as { type: string };
    case 'comment': {
      const item = needId();
      const text = typeof v['body-file'] === 'string' ? readBody(v) : positionals.slice(1).join(' ');
      let verdict: Record<string, string> | undefined;
      if (v.verdict !== undefined || v.result !== undefined || v.run !== undefined) {
        if (typeof v.verdict !== 'string' || typeof v.result !== 'string' || typeof v.run !== 'string') throw new UsageError('a verdict needs --verdict review|qa, --result clear|"not clear" and --run <id>');
        verdict = { verdict: v.verdict, result: v.result === 'not-clear' ? 'not clear' : v.result, run: v.run };
      }
      return defined({ type: 'task.comment', item, text, verdict }) as { type: string };
    }
    case 'edit':
      return defined({
        type: 'task.edit',
        item: needId(),
        title: v.title,
        body: readBody(v),
        kind: v.kind,
        state: v.state,
        labels: v.label,
        add_labels: v['add-label'],
        remove_labels: v['remove-label'],
        assignee: clearable(v.assignee as string | undefined),
      }) as { type: string };
    case 'close':
      return defined({ type: 'task.close', item: needId(), comment: v.comment }) as { type: string };
    case 'link':
      return defined({
        type: 'task.link',
        item: needId(),
        parent: clearable(v.parent as string | undefined),
        blocked_by: v['blocked-by'],
        unblock: v.unblock,
        topic: clearable(v.topic as string | undefined),
        branch: clearable(v.branch as string | undefined),
      }) as { type: string };
    case 'claim':
      return { type: 'task.claim', item: needId(), release: v.release === true, force: v.force === true };
  }
}

// ------------------------------------------------------------------ printing

const claimText = (c: Claim | null): string => (c ? `${c.session}${c.role ? ` (${c.role})` : ''} since ${c.claimedAt}` : '-');

function viewText(i: ItemView): string {
  const lines = [
    `${i.id}  ${i.title}`,
    `  kind      ${i.kind}`,
    `  state     ${i.state}`,
    `  labels    ${i.labels.length ? i.labels.join(', ') : '-'}`,
    `  assignee  ${i.assignee ?? '-'}`,
    `  claim     ${claimText(i.claim)}`,
    `  parent    ${i.parent ?? '-'}`,
    `  blocked   ${i.blocked_by.length ? i.blocked_by.join(', ') : '-'}`,
    `  topic     ${i.topic ?? '-'}`,
    `  branch    ${i.branch ?? '-'}`,
    `  created   ${i.created}`,
    `  updated   ${i.updated}`,
    ...(i.github ? [`  github    ${i.github.repo}#${i.github.number}  ${i.github.url}`] : []),
    `  file      ${i.path}`,
  ];
  if (i.body) lines.push('', i.body);
  if (i.comments.length) {
    lines.push('', `comments: ${i.comments.length}`);
    for (const c of i.comments) {
      lines.push(`  ${c.author} · ${c.at}${c.verdict ? `  [verdict ${c.verdict.verdict}: ${c.verdict.result}, by ${c.verdict.by}, run ${c.verdict.run}]` : ''}`);
      if (c.text) lines.push(...c.text.split('\n').map((l) => `    ${l}`));
    }
  }
  return `${lines.join('\n')}\n`;
}

function listText(items: ItemSummary[]): string {
  if (!items.length) return 'no items\n';
  return `${items
    .map((i) =>
      [
        i.id.padEnd(6),
        i.state.padEnd(6),
        i.kind.padEnd(8),
        i.title,
        i.labels.length ? `[${i.labels.join(', ')}]` : '',
        i.assignee ? `@${i.assignee}` : '',
        i.claim ? `(claimed by ${i.claim.session})` : '',
      ]
        .filter(Boolean)
        .join('  '),
    )
    .join('\n')}\n`;
}

function humanOf(sub: Sub, value: Record<string, unknown>): string {
  switch (sub) {
    case 'list':
      return listText(value.items as ItemSummary[]);
    case 'claim': {
      const claim = value.claim as Claim | null;
      return claim ? `${String(value.id)} claimed by ${claimText(claim)}\n` : `${String(value.id)} released\n`;
    }
    case 'create': {
      const i = value.item as ItemView;
      return `created ${i.id}  ${i.path}\n`;
    }
    default:
      return viewText(value.item as ItemView);
  }
}

// ------------------------------------------------------------------ the command

/** `cland task <sub> …`; the process exit code. */
export async function runTask(args: string[], cwd: string = process.cwd(), io: Io = stdio, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [sub, ...rest] = args;
  if (sub === 'import-github') return runImportGithub(rest, cwd, io, env);
  if (!sub || !(sub in OPTIONS)) {
    io.err(`cland: unknown task command "${sub ?? ''}"\n\nusage: cland task <command>\n\n${TASK_USAGE}`);
    return 2;
  }
  const s = sub as Sub;
  let frame: { type: string } & Record<string, unknown>;
  let values: Values;
  try {
    const parsed = parseArgs({ args: rest, options: OPTIONS[s], allowPositionals: true, strict: true });
    values = parsed.values as Values;
    frame = frameOf(s, parsed.positionals, values);
  } catch (err) {
    io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n\nusage:\n${TASK_USAGE}`);
    return 2;
  }
  const as = actorOf(values, env, io);
  if (as) frame.as = as;

  const root = projectRoot(cwd);
  const d = readDiscovery(hubDiscovery(cwd, env));
  if (!d || !pidAlive(d.pid)) {
    io.err(`cland: no hub running for ${root} — start it with \`cland hub start\`\n`);
    return 1;
  }
  let value: Record<string, unknown>;
  try {
    value = (await askHubFrame(d, frame, 10_000)) as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const unreachable = (err as NodeJS.ErrnoException).code !== undefined;
    io.err(unreachable ? `cland: the hub for ${root} does not answer on ${d.socket} (${msg}) — check \`cland hub status\`\n` : `cland: ${msg}\n`);
    return 1;
  }
  io.out(values.json ? `${JSON.stringify(value)}\n` : humanOf(s, value));
  return 0;
}
