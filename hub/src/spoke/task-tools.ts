// The spoke's `task.*` tools: the tracker's requests as MCP tools. Arguments name the item `id`; the frame
// carries it as `item` (a frame's `id` is the request's). The hub validates; the spoke only reshapes.
import type { TaskRequest } from '../tracker/requests.ts';
import type { DistributiveOmit } from './hub-client.ts';

const str = { type: 'string' } as const;
const strs = { type: 'array', items: { type: 'string' } } as const;
const nullableStr = { type: ['string', 'null'] } as const;
const itemId = { type: 'string', description: 'The item id, T-<n>' } as const;
const KIND = { type: 'string', enum: ['epic', 'spec', 'task', 'question', 'map'] } as const;
const STATE = { type: 'string', enum: ['open', 'closed'] } as const;

export const TASK_TOOLS = [
  {
    name: 'task.create',
    description: "Create an item in the project's tracker (a Markdown file in .cland/tasks/, id T-<n>). Returns the item.",
    inputSchema: {
      type: 'object',
      properties: { title: str, kind: { ...KIND, description: 'Default task' }, body: str, labels: strs, assignee: str, parent: itemId, blocked_by: strs, topic: str, branch: str },
      required: ['title'],
    },
  },
  {
    name: 'task.view',
    description: 'One item: its fields, body, comments, verdicts, and the live claim on it if any.',
    inputSchema: { type: 'object', properties: { id: itemId }, required: ['id'] },
  },
  {
    name: 'task.list',
    description: 'List items from the index. Filters combine; `label` items must all be present; `verdict` is `review=clear`, `qa=not clear`, … (the latest verdict of that kind).',
    inputSchema: { type: 'object', properties: { state: STATE, label: strs, kind: KIND, assignee: str, verdict: str } },
  },
  {
    name: 'task.comment',
    description: 'Comment on an item. With `verdict`, `result` and `run` it is a verdict, recorded as by you and your role.',
    inputSchema: {
      type: 'object',
      properties: { id: itemId, text: str, verdict: { type: 'string', enum: ['review', 'qa'] }, result: { type: 'string', enum: ['clear', 'not clear'] }, commit: { type: 'string', description: 'The Git commit SHA covered by this verdict; defaults to the item branch tip' }, run: { type: 'string', description: 'The id of the review or QA run' } },
      required: ['id'],
    },
  },
  {
    name: 'task.edit',
    description: "Change an item's title, body, kind, state, labels (replace, add, remove) or assignee (null clears).",
    inputSchema: { type: 'object', properties: { id: itemId, title: str, body: str, kind: KIND, state: STATE, labels: strs, add_labels: strs, remove_labels: strs, assignee: nullableStr }, required: ['id'] },
  },
  {
    name: 'task.close',
    description: 'Close an item, optionally with a closing comment. Its claim is released.',
    inputSchema: { type: 'object', properties: { id: itemId, comment: str }, required: ['id'] },
  },
  {
    name: 'task.link',
    description: 'Set an item\'s parent, add or remove blockers, set its topic or branch (null clears).',
    inputSchema: { type: 'object', properties: { id: itemId, parent: nullableStr, blocked_by: { ...strs, description: 'Blockers to add' }, unblock: { ...strs, description: 'Blockers to remove' }, topic: nullableStr, branch: nullableStr }, required: ['id'] },
  },
  {
    name: 'task.claim',
    description: 'Claim an item as yours while you work on it (kept by the hub, not written to the file), or release it. A claim another session holds is refused unless `force`.',
    inputSchema: { type: 'object', properties: { id: itemId, release: { type: 'boolean' }, force: { type: 'boolean' } }, required: ['id'] },
  },
] as const;

export const TASK_TOOL_NAMES: ReadonlySet<string> = new Set(TASK_TOOLS.map((t) => t.name));

/** The frame for a `task.*` tool call. */
export function taskFrame(tool: string, args: Record<string, unknown>): DistributiveOmit<TaskRequest, 'id'> {
  const { id, label, verdict, result, run, commit, ...rest } = args;
  const item = id === undefined ? {} : { item: id };
  switch (tool) {
    case 'task.list':
      return { type: 'task.list', ...rest, ...(label !== undefined ? { labels: typeof label === 'string' ? [label] : label } : {}), ...(verdict !== undefined ? { verdict } : {}) } as DistributiveOmit<TaskRequest, 'id'>;
    case 'task.comment':
      return { type: 'task.comment', ...rest, ...item, ...(verdict !== undefined || result !== undefined || run !== undefined || commit !== undefined ? { verdict: { verdict, result, run, ...(commit !== undefined ? { commit } : {}) } } : {}) } as DistributiveOmit<TaskRequest, 'id'>;
    default:
      return { type: tool, ...rest, ...item } as DistributiveOmit<TaskRequest, 'id'>;
  }
}
