// Rule writes are authorized by the hub against the caller and the stored human message.
const str = { type: 'string' } as const;
const number = { type: 'integer', minimum: 1 } as const;
const origin = { type: 'object', properties: { topic: str, msg_id: str }, required: ['topic', 'msg_id'], additionalProperties: false } as const;
export const RULE_TOOLS = [
  { name: 'rule.add', description: 'Record a project rule. Coordinator: origin names the human message that stated it. Aide: origin records your session. Other roles propose rules to the Coordinator in the item topic.', inputSchema: { type: 'object', properties: { text: str, scope: { ...str, description: 'all or comma-separated role names' }, reason: str, title: str, origin }, required: ['text', 'scope', 'reason'] } },
  { name: 'rule.edit', description: 'Edit a rule by number; Coordinator supplies the human-message origin, Aide records its session origin.', inputSchema: { type: 'object', properties: { number, text: str, scope: str, reason: str, origin }, required: ['number'] } },
  { name: 'rule.retire', description: 'Retire a rule with a reason; Coordinator supplies the human-message origin, Aide records its session origin.', inputSchema: { type: 'object', properties: { number, reason: str, origin }, required: ['number', 'reason'] } },
  { name: 'rule.list', description: 'Read active project rules; all includes retired rules, role filters the scope. Every role may read.', inputSchema: { type: 'object', properties: { all: { type: 'boolean' }, role: str } } },
] as const;
export const RULE_TOOL_NAMES: ReadonlySet<string> = new Set(RULE_TOOLS.map(tool => tool.name));
