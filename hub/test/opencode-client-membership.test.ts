// T1: a fake request boundary supplies recorded JSON; no server or harness runs.
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';

// Fixture-only structural validation against the pinned schemas. This deliberately
// covers the JSON Schema keywords used by these examples, not arbitrary OpenAPI.
type Schema = {
  $ref?: string; anyOf?: Schema[]; type?: string; enum?: unknown[];
  properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean | Schema;
  items?: Schema; prefixItems?: Schema[]; minItems?: number; minimum?: number;
  maximum?: number; exclusiveMinimum?: number; pattern?: string;
};
type Schemas = Record<string, Schema>;
async function schemas(version: string): Promise<Schemas> {
  return JSON.parse(await readFile(new URL(`./fixtures/opencode-${version}-contract.json`, import.meta.url), 'utf8')).components.schemas;
}
function conforms(value: unknown, schema: Schema, definitions: Schemas): boolean {
  if (schema.$ref) return conforms(value, definitions[schema.$ref.split('/').at(-1)!]!, definitions);
  if (schema.anyOf && !schema.anyOf.some(branch => conforms(value, branch, definitions))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const data = value as Record<string, unknown>;
      if (schema.required?.some(key => !Object.hasOwn(data, key))) return false;
      for (const [key, field] of Object.entries(data)) {
        const child = schema.properties?.[key];
        if (child) { if (!conforms(field, child, definitions)) return false; }
        else if (schema.additionalProperties === false) return false;
        else if (typeof schema.additionalProperties === 'object' && !conforms(field, schema.additionalProperties, definitions)) return false;
      }
      break;
    }
    case 'array':
      if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) return false;
      if (!value.every((entry, i) => { const child = schema.prefixItems?.[i] ?? schema.items; return !child || conforms(entry, child, definitions); })) return false;
      break;
    case 'string': if (typeof value !== 'string' || schema.pattern && !new RegExp(schema.pattern).test(value)) return false; break;
    case 'integer': if (typeof value !== 'number' || !Number.isInteger(value)) return false; break;
    case 'number': if (typeof value !== 'number' || !Number.isFinite(value)) return false; break;
    case 'boolean': if (typeof value !== 'boolean') return false; break;
    case 'null': if (value !== null) return false; break;
  }
  if (typeof value === 'number' && (schema.minimum !== undefined && value < schema.minimum
    || schema.maximum !== undefined && value > schema.maximum
    || schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)) return false;
  return true;
}
function assertWire(value: unknown, name: string, definitions: Schemas) {
  assert.equal(conforms(value, definitions[name]!, definitions), true, `fixture conforms to ${name}`);
}

test('OpenCode snapshots refuse inherited prototype keys as active sessions', async t => {
  const client = new OpenCodeClient('http://unused.invalid', 'fixture-password');
  let active: Record<string, unknown> | undefined = {};
  t.mock.method(client, 'request', async (_method: string, path: string) => ({
    data: path === '/api/session/active' ? active : [],
  }));
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.deepEqual(await client.snapshot(key), { running: false, permissions: [], forms: [] }, key);
  }
  // An own JSON entry with the same spelling is a real active session.
  active = JSON.parse('{"constructor":{},"ses_live":{}}');
  assert.equal((await client.snapshot('constructor')).running, true);
  assert.equal((await client.snapshot('ses_live')).running, true);
  assert.equal((await client.snapshot('ses_missing')).running, false);
  active = undefined;
  assert.equal((await client.snapshot('constructor')).running, false);
});

// Handwritten wire examples from the pinned 2.2.5 schemas; see the per-test guide.
test('OpenCode 2.2.5 form variants retain ids without interpreting fields', async t => {
  const definitions = await schemas('2.2.5');
  const { forms } = JSON.parse(await readFile(new URL('./fixtures/opencode-2.2.5-readers.json', import.meta.url), 'utf8'));
  for (const form of forms) assertWire(form, 'Form.Info', definitions);
  const client = new OpenCodeClient('http://unused.invalid', 'fixture-password');
  t.mock.method(client, 'request', async (_method: string, path: string) => ({ data:
    path.endsWith('/form') ? forms : path.endsWith('/active') ? { ses_fixture: {} } : [],
  }));
  assert.deepEqual(await client.snapshot('ses_fixture'), { running: true, permissions: [], forms:
    ['frm_string', 'frm_number', 'frm_integer', 'frm_boolean', 'frm_multiselect', 'frm_external'],
  });
});

test('OpenCode 2.2.5 message variants preserve correlated tool approval and safe fallbacks', async t => {
  const definitions = await schemas('2.2.5');
  const samples = JSON.parse(await readFile(new URL('./fixtures/opencode-2.2.5-readers.json', import.meta.url), 'utf8'));
  const client = new OpenCodeClient('http://unused.invalid', 'fixture-password');
  const permission = { id: 'per_fixture', action: 'shell', resources: ['*'], source: { type: 'tool', messageID: 'msg_assistant', id: 'tool_fixture' } };
  assertWire(samples.assistant, 'Session.Message.Assistant', definitions);
  let message = samples.assistant;
  t.mock.method(client, 'request', async () => ({ data: message }));
  for (const state of [
    { status: 'streaming', input: 'partial command' },
    { status: 'running', input: { command: 'printf fixture' }, metadata: {} },
    { status: 'completed', input: { command: 'printf fixture' }, content: [{ type: 'text', text: 'done' }] },
    { status: 'error', input: { command: 'printf fixture' }, error: { type: 'fixture', message: 'fixture' } },
  ]) {
    message = structuredClone(samples.assistant);
    message.content[3].state = state;
    assertWire(message, 'Session.Message.Assistant', definitions);
    const expected = state.status === 'streaming' ? { command: 'shell', subject: null } : { command: 'printf fixture', subject: { command: 'printf fixture' } };
    assert.deepEqual(await client.approvalDetails('ses_fixture', permission), expected, state.status);
  }
  for (const other of [samples.shell, samples.user, ...samples.compactions]) {
    assertWire(other, 'Session.Message.Info', definitions);
    message = other;
    assert.deepEqual(await client.approvalDetails('ses_fixture', permission), { command: 'shell', subject: null }, other.type);
  }
  message = samples.assistant;
  assert.deepEqual(await client.approvalDetails('ses_fixture', { ...permission, source: { ...permission.source, id: 'missing' } }), { command: 'shell', subject: null });
  // Previous server shape: metadata fields were renamed, while the consumed fields stay the same.
  message = structuredClone(samples.assistant);
  delete message.native;
  message.providerState = { private: 'ignored' };
  for (const part of message.content) {
    delete part.native;
    if (part.type === 'tool') { part.providerState = {}; part.providerResultState = {}; }
    else part.state = {};
  }
  assertWire(message, 'Session.Message.Assistant', await schemas('2.0.24'));
  assert.deepEqual(await client.approvalDetails('ses_fixture', permission), { command: 'printf fixture', subject: { command: 'printf fixture' } });
});


test('OpenCode schema fidelity rejects missing required and misplaced metadata fields', async () => {
  const current = await schemas('2.2.5');
  const previous = await schemas('2.0.24');
  const running = { status: 'running', input: { command: 'printf fixture' }, metadata: {} };
  assertWire(running, 'Session.Message.ToolState.Running', current);
  assert.equal(conforms({ status: 'running', input: {} }, current['Session.Message.ToolState.Running']!, current), false);
  assertWire({ type: 'text', text: 'fixture', state: {} }, 'Session.Message.Assistant.Text', previous);
  assert.equal(conforms({ type: 'text', text: 'fixture', providerState: {} }, previous['Session.Message.Assistant.Text']!, previous), false);
  assertWire({ type: 'reasoning', text: 'fixture', state: {} }, 'Session.Message.Assistant.Reasoning', previous);
  assert.equal(conforms({ type: 'reasoning', text: 'fixture', providerState: {} }, previous['Session.Message.Assistant.Reasoning']!, previous), false);
  assertWire({ type: 'text', text: 'fixture', native: {} }, 'Session.Message.Assistant.Text', current);
  assert.equal(conforms({ type: 'text', text: 'fixture', state: {} }, current['Session.Message.Assistant.Text']!, current), false);
});
