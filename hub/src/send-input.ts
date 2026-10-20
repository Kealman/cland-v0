/** Recipient input shared by the MCP tool, dispatch authorization and core sends. */
export const sendToSchema = { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };

export function sendRecipients(value: unknown): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every(recipient => typeof recipient === 'string')) return value;
  throw new Error('to must be a string or an array of strings');
}
