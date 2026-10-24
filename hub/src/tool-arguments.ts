import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types';
import { TOOLS } from './spoke/tools.ts';
import { sendRecipients } from './send-input.ts';
import { subscriptionInput } from './subscriptions.ts';

export class InvalidArgument extends Error {
  readonly code = 'invalid_argument';
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}

type Schema = JsonSchemaType & { properties: Record<string, JsonSchemaType> };
const validator = new AjvJsonSchemaValidator();
const schemas = new Map<string, Schema>(TOOLS.map(tool => [tool.name, JSON.parse(JSON.stringify(tool.inputSchema)) as Schema]));
// The client protocol also has bounded summary pages and legacy nullable fields.
// Keep these wire-only inputs without advertising them as new MCP arguments.
const wireSchemas = new Map([...schemas].map(([name, schema]) => [name, structuredClone(schema)]));
// The spoke supplies the MCP default; direct wire callers still send an array.
wireSchemas.get('ask')!.required = ['topic', 'question', 'options'];
Object.assign(wireSchemas.get('task.list')!.properties, {
  ids: { type: 'array', items: { type: 'string' } }, projection: { enum: ['summary'] },
  include_containers: { type: 'boolean' }, parent: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 },
});
for (const field of ['assignee', 'parent', 'topic', 'branch']) wireSchemas.get('task.create')!.properties[field] = { type: ['string', 'null'] };
wireSchemas.get('role.state')!.properties.role = { type: 'string' };
for (const tool of ['rule.add', 'rule.edit', 'rule.retire']) {
  wireSchemas.get(tool)!.properties.origin = { anyOf: [{ type: 'string' }, schemas.get(tool)!.properties.origin!] };
}
const checks = new Map([...schemas].map(([name, schema]) => [name, validator.getValidator(schema)]));
const wireChecks = new Map([...wireSchemas].map(([name, schema]) => [name, validator.getValidator(schema)]));

/** Shared schema diagnostics retain the field names and allowed enum values. */
export function validateToolArguments(tool: string, args: Record<string, unknown>, wire = false, kinds?: readonly string[]): void {
  const schema = (wire ? wireSchemas : schemas).get(tool);
  if (!schema) return;
  // Older MCP callers used the wire locator `item`. Keep that alias, and the
  // historical ignored list context, while advertising `id` as the canonical locator.
  if (tool.startsWith('task.') && Object.hasOwn(args, 'item') && (tool === 'task.list' || Object.hasOwn(schema.properties, 'id'))) {
    const { item, ...rest } = args;
    args = tool === 'task.list' ? rest : { ...rest, id: args.id === undefined ? item : args.id };
  }
  if (tool === 'send') {
    try { sendRecipients(args.to); }
    catch (error) { throw new InvalidArgument((error as Error).message); }
  }
  const unknown = Object.keys(args).filter(key => !Object.hasOwn(schema.properties, key));
  const result = (wire ? wireChecks : checks).get(tool)!(args);
  if (unknown.length || !result.valid) {
    const accepted = Object.entries(schema.properties).map(([key, value]) => {
      const values = value.enum?.map(String);
      return `${key}${values ? ` (${values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`})` : ''}`;
    }).join(', ');
    throw new InvalidArgument(`${unknown.length ? `unknown field ${unknown.join(', ')}` : result.errorMessage}; accepted fields: ${accepted || '(none)'}`);
  }
  if (tool === 'task.plan') {
    if (args.op !== 'migrate' && args.id === undefined) throw new InvalidArgument('id is required for task.plan set, show or approve');
    if (args.op === 'set' && args.yaml === undefined) throw new InvalidArgument('yaml is required for task.plan set');
    if (args.op !== 'set' && args.allow_large !== undefined) throw new InvalidArgument('allow_large is only for task.plan set');
  }
  if (tool === 'task.criterion') {
    if (args.op !== 'add' && args.op !== 'normalize' && !/^C[1-9]\d*$/.test(String(args.criterion ?? ''))) throw new InvalidArgument('criterion must be an id such as C1');
    if (args.op === 'verify' && !/^\S+$/.test(String(args.run ?? ''))) throw new InvalidArgument('verify needs a run id (no whitespace)');
    if (args.op === 'fail' && (!(args.note as string | undefined)?.trim() || /[\r\n]/.test(args.note as string))) throw new InvalidArgument('fail needs a note (one line)');
    if (['add', 'edit'].includes(args.op as string) && !(args.text as string | undefined)?.trim()) throw new InvalidArgument(`${args.op} needs criterion text`);
  }
  if (tool === 'task.create' && (args.kind === undefined || args.kind === 'task') && args.size === undefined) throw new InvalidArgument('a task needs a size: XS, S, M or L');
  if (tool === 'task.create' && args.found_by !== undefined && ((args.kind !== undefined && args.kind !== 'task') || args.regression_of === undefined)) throw new InvalidArgument('found_by requires a task with regression_of');
  if (tool === 'task.rank' && Number(args.top === true) + Number(args.before !== undefined) + Number(args.after !== undefined) !== 1) throw new InvalidArgument('rank needs exactly one of top, before or after');
  if (tool === 'task.comment') {
    const verdict = ['verdict', 'result', 'run', 'scope', 'stage', 'verified', 'failed', 'findings', 'commit'].some(field => args[field] !== undefined);
    if (verdict) {
      for (const field of ['verdict', 'result', 'run']) if (args[field] === undefined) throw new InvalidArgument(`${field} is required for a verdict`);
      if (args.verdict === 'review' && args.scope === undefined) throw new InvalidArgument('a review verdict needs scope: full, delta or evidence');
      if (args.verdict === 'qa' && args.scope !== undefined) throw new InvalidArgument('a QA verdict carries no scope');
    } else if (!(args.text as string | undefined)?.trim()) throw new InvalidArgument('a comment needs text');
  }
  if (tool === 'artifact.create' && (args.path === undefined) === (args.content === undefined) && !(args.folder === true && args.path === undefined)) throw new InvalidArgument('give exactly one of path or content, or folder: true with neither');
  if (tool === 'session.launch' && args.item !== undefined && args.cwd !== undefined) throw new InvalidArgument('item and cwd cannot be supplied together');
  if (tool === 'send') {
    if (args.kind !== 'request' && (args.request !== undefined || args.subject !== undefined)) throw new InvalidArgument('request and subject require kind: request; remove them from this send');
    if (args.kind === 'request') {
      if (sendRecipients(args.to).length) throw new InvalidArgument('a request is for the human: omit to or use an empty to');
      if (args.request === undefined) throw new InvalidArgument('set request to review, qa or handover');
      if (typeof args.subject !== 'string' || !args.subject.trim()) throw new InvalidArgument('a request needs subject: name a known item (T-n), artifact (A-n) or session');
    }
  }
  if (tool === 'topic.create' && !(args.title as string).trim()) throw new InvalidArgument('title must be a non-empty string');
  if (tool === 'subscribe') {
    try { subscriptionInput(args.subject, args.events, args.digest, args.threshold, kinds); }
    catch (error) { throw new InvalidArgument((error as Error).message); }
  }
}

/** Wire names differ from MCP names; envelope identity is never a tool argument. */
export function validateToolFrame(frame: Record<string, unknown>, kinds?: readonly string[]): void {
  const { type, id: _request, as: _actor, ...args } = frame;
  const tool = type === 'suite.start' ? 'verify' : typeof type === 'string' && type.startsWith('event.') ? type.slice(6) : String(type);
  if (tool.startsWith('task.')) {
    if (Object.hasOwn(args, 'item')) {
      if (tool !== 'task.list') args.id = args.item;
      delete args.item;
    }
    if (tool === 'task.list' && Object.hasOwn(args, 'labels')) { args.label = args.labels; delete args.labels; }
    if (tool === 'task.comment' && typeof args.verdict === 'object' && args.verdict !== null) {
      const verdict = args.verdict; delete args.verdict; Object.assign(args, verdict);
    }
  }
  if (tool === 'send' && Object.hasOwn(args, 'replyTo')) { args.reply_to = args.replyTo; delete args.replyTo; }
  validateToolArguments(tool, args, true, kinds);
}
