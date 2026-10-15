// The spoke's `task.*` tools: the tracker's requests as MCP tools. Arguments name the item `id`; the frame
// carries it as `item` (a frame's `id` is the request's). The hub validates; the spoke only reshapes.
import { STATUSES, SIZES, FOUND_BY } from '../tracker/item.ts';
import type { TaskRequest } from '../tracker/requests.ts';
import type { DistributiveOmit } from './hub-client.ts';

const str = { type: 'string' } as const;
const strs = { type: 'array', items: { type: 'string' } } as const;
const nullableStr = { type: ['string', 'null'] } as const;
const itemId = { type: 'string', description: 'The item id: any kind prefix and number, or a bare number' } as const;
const KIND = { type: 'string', description: 'Configured container kind, task, question, spec or map; the hub validates it' } as const;
const SIZE = { type: 'string', enum: SIZES, description: 'Ex-ante task size; tasks only' } as const;
const STATE = { type: 'string', enum: ['open', 'closed'] } as const;

export const TASK_TOOLS = [
  { name: 'task.plan', description: 'Set, show or approve an epic plan (only the human or an Aide approves), or migrate retired qa-required labels. Migrate reports tasks falling back to qa_default. Set validates YAML before replacing ## Plan; invalid hand saves keep the last accepted plan and return planError. Setting defaults to Coordinator and human.',
    inputSchema: { type: 'object', properties: { id: itemId, op: { type: 'string', enum: ['set', 'show', 'migrate', 'approve'] }, yaml: { ...str, description: 'The plan YAML text; required for set' }, reason: { ...str, description: 'Why the plan changed; optional for set' }, allow_large: { type: 'object', additionalProperties: str, description: 'For set: a non-empty reason per L task id, recorded in plan history; prefer splitting into 2–3 M tasks' } }, required: ['op'] } },
  { name: 'task.criterion', description: 'Mark a criterion done (claimant Implementer, Coordinator, Aide or human), verify or fail with a note (Reviewer or QA), or add, edit or remove criteria (Coordinator, Aide or human). Verify requires a run id.',
    inputSchema: { type: 'object', properties: { id: itemId, op: { type: 'string', enum: ['done', 'verify', 'fail', 'add', 'edit', 'remove'] }, criterion: { ...str, description: 'Stable criterion id, C1, C2, …; omitted for add' }, text: str, note: str, run: str }, required: ['id', 'op'] } },
  { name: 'task.hold', description: 'Take a Reviewer or QA verifier hold beside the Implementer claim, setting review or qa, or release your hold. Verdicts and session stop release it.',
    inputSchema: { type: 'object', properties: { id: itemId, release: { type: 'boolean' } }, required: ['id'] } },
  {
    name: 'task.create',
    description: "Create an item in the project's tracker (a Markdown file in .cland/tasks/, id with the kind's prefix and a shared number). A task needs a size: XS, S, M or L; XL tasks must be split before filing. Returns the item.",
    inputSchema: {
      type: 'object',
      properties: { title: str, kind: { ...KIND, description: 'Default task' }, size: SIZE, regression_of: itemId, found_by: { type: 'string', enum: FOUND_BY }, version: { ...str, description: 'Release semver without the v; optional at creation' }, body: str, labels: strs, assignee: str, parent: itemId, blocked_by: strs, follows: { ...strs, description: 'Epic predecessors in a lane' }, topic: str, branch: str },
      required: ['title'],
    },
  },
  {
    name: 'task.view',
    description: 'One item: fields (including closed, size, regression_of and found_by), file path, ancestry, body, comments, verdicts, claim, bound-topic answer origins, full criteria with criteriaCounts, and the task latest verify result.',
    inputSchema: { type: 'object', properties: { id: itemId }, required: ['id'] },
  },
  {
    name: 'task.list',
    description: 'List items from the index, including closed, size, regression_of, found_by, criteria counts and the task latest verify result. `under` selects descendants of an item (excluding itself). Filters combine; `label` items must all be present; `verdict` is `review=clear`, `qa=not clear`, … (the latest verdict of that kind).',
    inputSchema: { type: 'object', properties: { under: itemId, state: STATE, label: strs, kind: KIND, assignee: str, verdict: str } },
  },
  {
    name: 'task.comment',
    description: 'Comment on an item. With `verdict`, `result` and `run` it is a verdict: review needs scope full, delta or evidence; QA carries none. It is recorded as by you and your role.',
    inputSchema: {
      type: 'object',
      properties: { id: itemId, text: str, scope: { type: 'string', enum: ['full', 'delta', 'evidence'], description: 'Review only: full for a first review or reworked design, delta after dev moved under a reviewed branch, evidence for suite evidence alone' }, stage: { ...str, description: 'QA on an epic: the exact after-stage stage name; records the tested dev build and closes only that stage' }, verified: { ...str, description: 'On a clear verdict: criterion ids C1,C3 or all; Reviewer or QA only' }, failed: { type: 'array', items: { type: 'object', properties: { criterion: str, note: str }, required: ['criterion', 'note'] }, description: 'On a not-clear verdict: criteria to fail with single-line notes; Reviewer or QA only' }, verdict: { type: 'string', enum: ['review', 'qa'] }, result: { type: 'string', enum: ['clear', 'not clear'] }, commit: { type: 'string', description: 'The Git commit SHA covered by this verdict; defaults to the item branch tip' }, run: { type: 'string', description: 'The id of the review or QA run' } },
      required: ['id'],
    },
  },
  {
    name: 'task.edit',
    description: "Change an item's title, body, kind, version, state, status, size, labels (replace, add, remove) or assignee (null clears).",
    inputSchema: { type: 'object', properties: { id: itemId, title: str, body: str, kind: KIND, size: SIZE, found_by: { type: ['string', 'null'], enum: [...FOUND_BY, null], description: 'Where a regression was caught; requires regression_of; null clears' }, version: nullableStr, state: STATE, status: { type: 'string', enum: STATUSES, description: 'Coordinator: any status. Implementer: review on its claimed item only.' }, labels: strs, add_labels: strs, remove_labels: strs, assignee: nullableStr }, required: ['id'] },
  },
  {
    name: 'task.close',
    description: 'Close an item, optionally with a closing comment. Epics require a current clear QA verdict on dev and every criterion verified; open children still refuse. Its claim is released.',
    inputSchema: { type: 'object', properties: { id: itemId, comment: str, override: { ...str, description: "Human shell only: skip epic QA evidence with an audited reason; sessions cannot override." } }, required: ['id'] },
  },
  {
    name: 'task.link',
    description: 'Set an item\'s parent, add or remove blockers and epic follows, set its regression_of, topic or branch (null clears).',
    inputSchema: { type: 'object', properties: { id: itemId, regression_of: { ...nullableStr, description: 'Landed task reworked; null or none clears' }, parent: nullableStr, blocked_by: { ...strs, description: 'Blockers to add' }, unblock: { ...strs, description: 'Blockers to remove' }, follows: { ...strs, description: 'Epic predecessors to add' }, unfollow: { ...strs, description: 'Epic predecessors to remove' }, topic: nullableStr, branch: nullableStr }, required: ['id'] },
  },
  {
    name: 'task.rank',
    description: 'Move a task or a container below the top level among its siblings. Exactly one of top, before or after. Returns the item, changed ids and ordered sibling ids.',
    inputSchema: { type: 'object', properties: { id: itemId, top: { type: 'boolean' }, before: itemId, after: itemId }, required: ['id'] },
  },
  {
    name: 'task.claim',
    description: 'Claim an item as yours while you work on it (the live hold stays in the hub; an Implementer claim writes in progress to task status), or release it. A claim another session holds is refused unless `force`.',
    inputSchema: { type: 'object', properties: { id: itemId, release: { type: 'boolean' }, force: { type: 'boolean' } }, required: ['id'] },
  },
] as const;

export const TASK_TOOL_NAMES: ReadonlySet<string> = new Set(TASK_TOOLS.map((t) => t.name));

/** The frame for a `task.*` tool call. */
export function taskFrame(tool: string, args: Record<string, unknown>): DistributiveOmit<TaskRequest, 'id'> {
  const { id, label, verdict, result, run, commit, scope, stage, verified, failed, ...rest } = args;
  const item = id === undefined ? {} : { item: id };
  switch (tool) {
    case 'task.list':
      return { type: 'task.list', ...rest, ...(label !== undefined ? { labels: typeof label === 'string' ? [label] : label } : {}), ...(verdict !== undefined ? { verdict } : {}) } as DistributiveOmit<TaskRequest, 'id'>;
    case 'task.criterion':
      return { type: 'task.criterion', ...rest, ...item, ...(run !== undefined ? { run } : {}) } as DistributiveOmit<TaskRequest, 'id'>;
    case 'task.comment':
      return { type: 'task.comment', ...rest, ...item, ...(verdict !== undefined || result !== undefined || run !== undefined || commit !== undefined || scope !== undefined || stage !== undefined || verified !== undefined || failed !== undefined ? { verdict: { verdict, result, run, ...(commit !== undefined ? { commit } : {}), ...(scope !== undefined ? { scope } : {}), ...(stage !== undefined ? { stage } : {}), ...(verified !== undefined ? { verified } : {}), ...(failed !== undefined ? { failed } : {}) } } : {}) } as DistributiveOmit<TaskRequest, 'id'>;
    default:
      return { type: tool, ...rest, ...item } as DistributiveOmit<TaskRequest, 'id'>;
  }
}
