// `cland task <create|view|plan|list|comment|edit|close|link|claim>`: the tracker through the project's hub, over
// its Unix socket. Every write goes through the hub; this side only parses arguments and prints.
import { readFileSync } from 'node:fs';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { hubDiscovery, pidAlive, projectRoot, readDiscovery } from '../project.ts';
import type { Claim } from '../tracker/index-db.ts';
import type { ItemSummary, ItemView } from '../tracker/tracker.ts';
import { actorOf } from './actor.ts';
import { askHubFrame } from './socket-client.ts';
import { planYaml, type EpicPlan } from '../tracker/plan.ts';
import { IMPORT_USAGE, runImportGithub } from './task-import.ts';
import type { MigrationPlan } from '../tracker/migrate.ts';

export const TASK_USAGE = `  task create <title> [--kind k] [--version semver] [--body t | --body-file f] [--label l]… [--assignee a]
                  [--parent <id>] [--blocked-by <id>]… [--topic t] [--branch b]
  task view <id> (any kind prefix in either case, or a bare number)
  task migrate [--dry-run] [--json] (offline prefixes, references, titles, categories and retired labels)
  task plan migrate (retire qa-required labels, report policy fallbacks)
  task plan <set|show|approve> <epic-id> [--file plan.yaml] [--reason text]
  task list [--under <id>] [--state open|closed] [--label l]… [--kind k] [--assignee a] [--verdict review=clear]
  task comment <id> <text> [--verdict review|qa --result clear|"not clear" --run <id> [--commit <sha>] [--stage <name>] [--verified C1,C3|all | --failed "C1=note"]…]
  task edit <id> [--version semver|none] [--title t] [--body t | --body-file f] [--kind k] [--state s] [--status s] [--label l]…
                  [--add-label l]… [--remove-label l]… [--assignee a|none]
  task close <id> [--comment t] [--override reason (human shell only)]
  task link <id> [--parent <id>|none] [--blocked-by <id>]… [--unblock <id>]… [--topic t|none] [--branch b|none]
  task hold <id> [--release] (Reviewer or QA verification beside the claim)
  task criterion <id> <done|verify|fail|edit|remove> <C-n> [--run r] [--note t] [--text t]
  task criterion <id> add <text>
  task rank <id> <--top | --before <id> | --after <id>>
  task claim <id> [--release] [--force]
                  claiming an open task in a project with a territory makes (or reuses) its branch
                  t/T-<n>-<slug> and its worktree .cland/worktrees/T-<n>
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
  migrate: { ...COMMON, 'dry-run': { type: 'boolean' } },
  create: { ...COMMON, kind: { type: 'string' }, version: { type: 'string' }, body: { type: 'string' }, 'body-file': { type: 'string' }, label: { type: 'string', multiple: true }, assignee: { type: 'string' }, parent: { type: 'string' }, 'blocked-by': { type: 'string', multiple: true }, topic: { type: 'string' }, branch: { type: 'string' } },
  view: { ...COMMON },
  plan: { ...COMMON, file: { type: 'string' }, reason: { type: 'string' } },
  list: { ...COMMON, under: { type: 'string' }, state: { type: 'string' }, label: { type: 'string', multiple: true }, kind: { type: 'string' }, assignee: { type: 'string' }, verdict: { type: 'string' } },
  comment: { ...COMMON, verdict: { type: 'string' }, result: { type: 'string' }, run: { type: 'string' }, commit: { type: 'string' }, stage: { type: 'string' }, verified: { type: 'string' }, failed: { type: 'string', multiple: true }, 'body-file': { type: 'string' } },
  edit: { ...COMMON, version: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, 'body-file': { type: 'string' }, kind: { type: 'string' }, state: { type: 'string' }, status: { type: 'string' }, label: { type: 'string', multiple: true }, 'add-label': { type: 'string', multiple: true }, 'remove-label': { type: 'string', multiple: true }, assignee: { type: 'string' } },
  close: { ...COMMON, comment: { type: 'string' }, override: { type: 'string' } },
  link: { ...COMMON, parent: { type: 'string' }, 'blocked-by': { type: 'string', multiple: true }, unblock: { type: 'string', multiple: true }, topic: { type: 'string' }, branch: { type: 'string' } },
  hold: { ...COMMON, release: { type: 'boolean' } },
  criterion: { ...COMMON, run: { type: 'string' }, note: { type: 'string' }, text: { type: 'string' } },
  rank: { ...COMMON, top: { type: 'boolean' }, before: { type: 'string' }, after: { type: 'string' } },
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
    if (!id) throw new UsageError(`task ${sub} needs an item id (any kind prefix and number, or a bare number)`);
    return id;
  };
  switch (sub) {
    case 'migrate':
      if (positionals.length) throw new UsageError('task migrate takes no positional arguments');
      return { type: 'task.migrate', dryRun: v['dry-run'] === true };
    case 'create': {
      const title = positionals.join(' ').trim();
      if (!title) throw new UsageError('task create needs a title');
      return defined({
        type: 'task.create',
        title,
        kind: v.kind,
        version: v.version,
        body: readBody(v),
        labels: v.label,
        assignee: v.assignee,
        parent: v.parent,
        blocked_by: v['blocked-by'],
        topic: v.topic,
        branch: v.branch,
      }) as { type: string };
    }
    case 'plan': {
      const [op, item, ...extra] = positionals;
      if (op === 'migrate') {
        if (item || extra.length || v.file !== undefined) throw new UsageError('task plan migrate takes no item or --file');
        return { type: 'task.plan', op };
      }
      if ((op !== 'set' && op !== 'show' && op !== 'approve') || !item || extra.length) throw new UsageError('task plan needs set|show|approve and an epic id');
      if (op === 'set' && typeof v.file !== 'string') throw new UsageError('task plan set needs --file plan.yaml (or --file - for stdin)');
      if (op !== 'set' && v.reason !== undefined) throw new UsageError(`task plan ${op} takes no --reason`);
      if (op !== 'set' && v.file !== undefined) throw new UsageError(`task plan ${op} takes no --file`);
      return { type: 'task.plan', item, op, ...(op === 'set' ? { yaml: readFileSync(v.file === '-' ? 0 : String(v.file), 'utf8'), ...(v.reason !== undefined ? { reason: v.reason } : {}) } : {}) };
    }
    case 'view':
      return { type: 'task.view', item: needId() };
    case 'list':
      return defined({ type: 'task.list', under: v.under, state: v.state, labels: v.label, kind: v.kind, assignee: v.assignee, verdict: v.verdict }) as { type: string };
    case 'comment': {
      const item = needId();
      const text = typeof v['body-file'] === 'string' ? readBody(v) : positionals.slice(1).join(' ');
      let verdict: Record<string, unknown> | undefined;
      if (v.verdict !== undefined || v.result !== undefined || v.run !== undefined || v.commit !== undefined || v.stage !== undefined || v.verified !== undefined || v.failed !== undefined) {
        if (typeof v.verdict !== 'string' || typeof v.result !== 'string' || typeof v.run !== 'string') throw new UsageError('a verdict needs --verdict review|qa, --result clear|"not clear" and --run <id>');
        verdict = { verdict: v.verdict, result: v.result === 'not-clear' ? 'not clear' : v.result, run: v.run, ...(typeof v.commit === 'string' ? { commit: v.commit } : {}), ...(typeof v.stage === 'string' ? { stage: v.stage } : {}), ...(v.verified !== undefined ? { verified: v.verified } : {}), ...(Array.isArray(v.failed) ? { failed: v.failed.map(f => {
          const split = f.indexOf('=');
          if (split < 0) throw new UsageError('--failed needs C1=note (repeat for each criterion)');
          return { criterion: f.slice(0, split), note: f.slice(split + 1) };
        }) } : {}) };
      }
      return defined({ type: 'task.comment', item, text, verdict }) as { type: string };
    }
    case 'edit':
      return defined({
        type: 'task.edit',
        status: v.status,
        version: clearable(v.version as string | undefined),
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
      return defined({ type: 'task.close', item: needId(), comment: v.comment, override: v.override }) as { type: string };
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
    case 'hold':
      return { type: 'task.hold', item: needId(), release: v.release === true };
    case 'criterion': {
      const op = positionals[1];
      if (!op) throw new UsageError('task criterion needs an operation');
      return defined({ type: 'task.criterion', item: needId(), op, criterion: op === 'add' ? undefined : positionals[2], text: v.text ?? (op === 'add' ? positionals.slice(2).join(' ') : op === 'edit' ? positionals.slice(3).join(' ') : undefined), note: v.note, run: v.run }) as { type: string };
    }
    case 'rank':
      return defined({ type: 'task.rank', item: needId(), top: v.top, before: v.before, after: v.after }) as { type: string };
    case 'claim':
      return { type: 'task.claim', item: needId(), release: v.release === true, force: v.force === true };
  }
}

// ------------------------------------------------------------------ printing

const claimText = (c: Claim | null): string => (c ? `${c.session}${c.role ? ` (${c.role})` : ''} since ${c.claimedAt}` : '-');

function viewText(i: ItemView): string {
  const lines = [
    i.ancestry.map(node => `${node.id}  ${node.title}`).join(' › '),
    `  kind      ${i.kind}`,
    ...(i.version !== undefined ? [`  version   ${i.version}`] : []),
    `  state     ${i.state}`,
    ...(i.status !== undefined ? [`  status    ${i.status}`] : []),
    `  rank      ${i.rank}`,
    `  labels    ${i.labels.length ? i.labels.join(', ') : '-'}`,
    `  assignee  ${i.assignee ?? '-'}`,
    `  claim     ${claimText(i.claim)}`,
    `  parent    ${i.parent ?? '-'}`,
    `  blocked   ${i.blocked_by.length ? i.blocked_by.join(', ') : '-'}`,
    `  topic     ${i.topic ?? '-'}`,
    `  branch    ${i.branch ?? '-'}`,
    ...i.holds.map(h => `  hold ${h.session} (${h.role}) since ${h.heldAt}`),
    `  verdict base ${i.verdictBase ?? '-'}`,
    `  created   ${i.created}`,
    `  updated   ${i.updated}`,
    ...(i.github ? [`  github    ${i.github.repo}#${i.github.number}  ${i.github.url}`] : []),
    `  file      ${i.path}`,
    ...(i.warnings ?? []).map(warning => `  warning   ${warning}`),
  ];
  if (i.body) lines.push('', i.body);
  const stale = i.criteria.flatMap(c => c.marks.flatMap(m => m.kind === 'verified' && m.current === false
    ? [`  ${c.id ?? 'legacy criterion'}: stale verification · ${m.by} · run ${m.run} · ${m.commit ? `commit ${m.commit}` : 'no commit'}`] : []));
  if (stale.length) lines.push('', 'stale criterion verifications:', ...stale);
  if (i.comments.length) {
    lines.push('', `comments: ${i.comments.length}`);
    let verdictIndex = 0;
    for (const c of i.comments) {
      lines.push(`  ${c.author} · ${c.at}${c.verdict ? `  [verdict ${c.verdict.verdict}: ${c.verdict.result}, by ${c.verdict.by}, run ${c.verdict.run}]` : ''}`);
      if (c.verdict) {
        const v = i.verdicts[verdictIndex++];
        if (v) lines.push(`    ${v.commit?.slice(0, 8) ?? 'no commit'}${v.current === undefined ? '' : v.current ? ' · current' : ' · stale'} · from the ${v.source === 'hub' ? 'hub' : 'file'}`);
      }
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

function migrationText(plan: MigrationPlan): string {
  if (!Object.entries(plan).some(([part, changes]) => part !== 'unresolved' && changes.length)) return 'nothing to do\n';
  const lines = [
    ...plan.renames.map(c => `rename ${c.from} → ${c.to}`),
    ...plan.ids.map(c => `id ${c.item}: ${c.from} → ${c.to}`),
    ...plan.references.map(c => `${c.field}${c.index === undefined ? '' : `[${c.index}]`} ${c.item}: ${c.from} → ${c.to}`),
    ...plan.unresolved.map(c => `unresolved ${c.field} ${c.item}: ${c.reference}`),
    ...plan.titles.map(c => `title ${c.item}: ${c.from} → ${c.to}`),
    ...plan.categories.map(c => c.action === 'convert' ? `category ${c.id} ${c.title}: ${c.fromKind} → ${c.kind}` : `category create ${c.file}: ${c.id} ${c.title}`),
    ...plan.labels.map(c => `label ${c.item}: remove ${c.label}`),
    ...plan.moves.map(c => `move ${c.item}: no parent → ${c.to}`),
  ];
  if (!lines.length) return 'nothing to do\n';
  lines.push(Object.entries(plan).map(([part, changes]) => `${changes.length} ${part}`).join(', '));
  return lines.join('\n') + '\n';
}

function humanOf(sub: Sub, value: Record<string, unknown>): string {
  switch (sub) {
    case 'migrate':
      return migrationText(value as MigrationPlan);
    case 'plan':
      if (typeof value.report === 'string') return value.report + '\n';
      const approval = value.approval as { state?: string; by?: string; at?: string } | undefined;
      const approvalLine = approval ? `# approval: ${approval.state}${approval.by ? ` by ${approval.by} at ${approval.at}` : ''}\n` : '';
      return approvalLine + (value.plan ? planYaml(value.plan as EpicPlan) : `${String(value.id)} has no plan\n`) + (value.planError ? `plan refused: ${String(value.planError)}; showing the last valid plan\n` : '');
    case 'list':
      return listText(value.items as ItemSummary[]);
    case 'hold':
      return `${String(value.id)} holds: ${JSON.stringify(value.holds)}\n`;
    case 'claim': {
      const claim = value.claim as Claim | null;
      const worktree = value.worktree as { path: string; branch: string; createdWorktree: boolean } | null | undefined;
      const where = worktree ? `  worktree  ${worktree.path} on ${worktree.branch}${worktree.createdWorktree ? ' (created)' : ''}\n` : typeof value.reason === 'string' ? `  worktree  none: ${value.reason}\n` : '';
      return claim ? `${String(value.id)} claimed by ${claimText(claim)}\n${where}` : `${String(value.id)} released\n`;
    }
    case 'comment': {
      const commit = value.commit as { note: string } | undefined;
      return viewText(value.item as ItemView) + (commit ? `${commit.note}\n` : '');
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

  if (s === 'migrate') {
    try {
      const { migrateOffline } = await import('../tracker/offline-migrate.ts');
      const plan = await migrateOffline(cwd, values['dry-run'] === true, as);
      io.out(values.json ? `${JSON.stringify(plan)}\n` : migrationText(plan));
      return 0;
    } catch (err) {
      io.err(`cland: ${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
  }
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
