// T1: public dispatcher frames, in-memory roles/store and a fake clock; no listeners or processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHubBase } from '../src/hub/server.ts';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { dispatcherSpoke } from './validation-support.ts';
import { validateToolArguments } from '../src/tool-arguments.ts';
import { TOOLS } from '../src/spoke/tools.ts';
import { FakeClock } from './fake-clock.ts';

test('criterion typos, missing op and invalid op are correctable validation errors without refusal notices', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('impl', 'implementer');
  const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'impl', 'impl-id');
  const before = hub.core.topicHistory('agents').messages.length;
  for (const args of [{ action: 'done' }, {}, { op: 'finish' }, { op: 'done', operation: 'done' }]) {
    const result = await spoke.call<Record<string, unknown>>('task.criterion', { id: 'T-1', criterion: 'C1', ...args });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'invalid_argument', JSON.stringify(result));
    assert.match(String(result.reason), /op/);
    for (const value of ['done', 'verify', 'fail', 'add', 'edit', 'remove']) assert.ok(String(result.reason).includes(value));
    if ('action' in args) assert.match(String(result.reason), /action/);
    if ('operation' in args) assert.match(String(result.reason), /operation/);
  }
  assert.equal(hub.core.topicHistory('agents').messages.length, before);
  const refused = await spoke.call<Record<string, unknown>>('task.criterion', { id: 'T-1', criterion: 'C1', op: 'verify', run: 'fixture' });
  assert.equal(refused.code, 'forbidden');
  assert.equal(hub.core.topicHistory('agents').messages.at(-1)?.kind, 'refusal');
});


test('available spoke tools reject unknown fields, missing fields, wrong types and invalid enums before scope checks', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('coord', 'coordinator');
  hub.core.assignRole('rev', 'reviewer');
  hub.core.assignRole('helper', 'aide');
  const coord = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'coord', 'coord-id');
  const rev = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'rev', 'rev-id');
  const helper = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'helper', 'helper-id');
  const before = hub.core.topicHistory('agents').messages.length;
  const baselines: Record<string, Record<string, unknown>> = {
    verify: { report: 'agents' }, 'merge.queue': {}, merge: { item: 'T-1' },
    'artifact.create': { kind: 'note', title: 'Fixture', topic: 'agents', content: 'Fixture' },
    'artifact.keep': { artifact: 'A-1' }, 'artifact.archive': { artifact: 'A-1' },
    'artifact.move': { artifact: 'A-1', folder: 'A-2' }, 'artifact.list': {},
    'artifact.promote': { artifact: 'A-1', path: 'evidence.md' },
    send: { text: 'Fixture' }, subscribe: { subject: { session: 'impl' }, events: ['session.state'] },
    unsubscribe: { subscription: 'fixture' }, subscriptions: {},
    'topic.create': { title: 'Fixture' }, resolve: { topic: 'general' },
    'ask.forward': { ask: 'fixture' }, 'ask.answer': { ask: 'fixture', text: 'Fixture' },
    ask: { topic: 'general', question: 'Which?', options: [] }, who: {}, status: { text: 'Fixture' },
    rename: { name: 'next' }, 'session.archive': { session: 'next' },
    'session.prune': { olderThan: '1d' }, 'session.launch': { name: 'next' }, history: {},
    'role.handover': { to: 'next', note: 'Fixture' }, 'role.state': {},
    'task.plan': { id: 'T-1', op: 'show' }, 'task.criterion': { id: 'T-1', op: 'done', criterion: 'C1' },
    'task.hold': { id: 'T-1' }, 'task.create': { title: 'Fixture', size: 'S' },
    'task.view': { id: 'T-1' }, 'task.list': {}, 'task.comment': { id: 'T-1', text: 'Fixture' },
    'task.edit': { id: 'T-1' }, 'task.close': { id: 'T-1' }, 'task.link': { id: 'T-1' },
    'task.rank': { id: 'T-1', top: true }, 'task.claim': { id: 'T-1' },
    'rule.add': { text: 'Fixture', scope: 'all', reason: 'Fixture' },
    'rule.edit': { number: 1 }, 'rule.retire': { number: 1, reason: 'Fixture' }, 'rule.list': {},
  };
  assert.deepEqual(Object.keys(baselines).sort(), TOOLS.map(tool => tool.name).sort());
  for (const tool of TOOLS) {
    const schema = tool.inputSchema as { properties: Record<string, { type?: unknown; enum?: readonly unknown[] }>; required?: readonly string[] };
    const base = baselines[tool.name]!;
    assert.doesNotThrow(() => validateToolArguments(tool.name, base), `${tool.name} baseline must be valid`);
    const cases = [
      { args: { ...base, misspelled_field: true }, field: 'misspelled_field' },
      ...(schema.required ?? []).map(field => { const args = { ...base }; delete args[field]; return { args, field }; }),
      ...Object.entries(schema.properties).filter(([, value]) => value.enum).map(([field]) => ({ args: { ...base, [field]: 'invalid-enum-value' }, field })),
      ...Object.entries(schema.properties).map(([field, value]) => ({ args: { ...base, [field]: value.type === 'number' || value.type === 'integer' ? 'wrong-type' : 42 }, field })),
    ];
    for (const { args, field } of cases) {
      const type = tool.name === 'verify' ? 'suite.start' : ['subscribe', 'unsubscribe', 'subscriptions'].includes(tool.name) ? `event.${tool.name}` : tool.name;
      const caller = tool.name === 'task.hold' ? rev : tool.name === 'artifact.promote' ? helper : coord;
      const result = await caller.call<Record<string, unknown>>(type, args);
      const what = `${tool.name} ${JSON.stringify(args)}: ${JSON.stringify(result)}`;
      assert.equal(result.ok, false, what);
      assert.equal(result.code, 'invalid_argument', what);
      // The accepted-field inventory contains every field; it is not evidence of the actual diagnostic.
      const diagnostic = String(result.reason).split('; accepted fields:')[0]!;
      assert.ok(diagnostic.includes(field), `${what}: diagnostic must identify ${field}`);
    }
  }
  assert.equal(hub.core.topicHistory('agents').messages.length, before);
});


test('legacy item aliases and wire-only task list summary fields remain accepted', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('impl', 'implementer');
  const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'impl', 'impl-id');
  assert.doesNotThrow(() => validateToolArguments('task.claim', { item: 'T-1', force: true }));
  assert.doesNotThrow(() => validateToolArguments('ask', { topic: 'general', question: 'Approve?', free: true }));
  assert.throws(() => validateToolArguments('ask', { topic: 'general', question: 'Approve?', free: true }, true), /required property 'options'/);
  assert.doesNotThrow(() => validateToolArguments('ask', { topic: 'general', question: 'Approve?', options: [], free: true }, true));
  const legacy = await spoke.call<Record<string, unknown>>('task.list', { item: 'T-1' });
  assert.equal(legacy.code, undefined, JSON.stringify(legacy));
  assert.match(String(legacy.error), /no tracker/);
  const result = await spoke.call<Record<string, unknown>>('task.list', { projection: 'summary', ids: ['T-1'], include_containers: true });
  assert.equal(result.code, undefined, JSON.stringify(result));
  assert.match(String(result.error), /no tracker/);
});

test('cross-field send and subscription validation also returns invalid_argument', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('impl', 'implementer');
  const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'impl', 'impl-id');
  const before = hub.core.topicHistory('agents').messages.length;
  for (const [tool, args, field] of [
    ['send', { to: ['coordinator'], text: 'fixture', request: 'review' }, 'request'],
    ['send', { kind: 'request', text: 'fixture' }, 'request'],
    ['event.subscribe', { subject: { session: 'impl' }, events: ['topic'] }, 'events'],
    ['topic.create', { title: '   ' }, 'title'],
  ] as const) {
    const result = await spoke.call<Record<string, unknown>>(tool, args);
    assert.equal(result.code, 'invalid_argument', JSON.stringify(result));
    assert.ok(String(result.reason).includes(field));
  }
  assert.equal(hub.core.topicHistory('agents').messages.length, before);
});

test('plan operation requirements validate before plan-set authorization', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('impl', 'implementer');
  const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'impl', 'impl-id');
  const before = hub.core.topicHistory('agents').messages.length;
  for (const [args, field] of [
    [{ op: 'set' }, 'id'], [{ op: 'set', id: 'T-1' }, 'yaml'],
    [{ op: 'show' }, 'id'], [{ op: 'approve' }, 'id'],
  ] as const) {
    const result = await spoke.call<Record<string, unknown>>('task.plan', args);
    assert.equal(result.code, 'invalid_argument', JSON.stringify(result));
    assert.ok(String(result.reason).includes(field));
  }
  assert.equal(hub.core.topicHistory('agents').messages.length, before);
  const valid = await spoke.call<Record<string, unknown>>('task.plan', { id: 'T-1', op: 'set', yaml: 'stages: []' });
  assert.equal(valid.code, 'forbidden');
  assert.equal(hub.core.topicHistory('agents').messages.at(-1)?.kind, 'refusal');
});

test('declared conditional tool arguments validate before scope checks', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  hub.core.assignRole('coord', 'coordinator');
  const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'coord', 'coord-id');
  const before = hub.core.topicHistory('agents').messages.length;
  for (const [tool, args, field] of [
    ['task.plan', { id: 'T-1', op: 'show', allow_large: {} }, 'allow_large'],
    ['task.criterion', { id: 'T-1', op: 'done' }, 'criterion'],
    ['task.criterion', { id: 'T-1', op: 'add' }, 'text'],
    ['task.criterion', { id: 'T-1', op: 'edit', criterion: 'C1' }, 'text'],
    ['task.criterion', { id: 'T-1', op: 'verify', criterion: 'C1' }, 'run'],
    ['task.criterion', { id: 'T-1', op: 'fail', criterion: 'C1' }, 'note'],
    ['task.create', { title: 'Fixture' }, 'size'],
    ['task.create', { title: 'Fixture', size: 'S', found_by: 'review' }, 'regression_of'],
    ['task.rank', { id: 'T-1' }, 'top'],
    ['task.comment', { id: 'T-1' }, 'text'],
    ['task.comment', { id: 'T-1', verdict: 'qa', run: 'fixture' }, 'result'],
    ['task.comment', { id: 'T-1', verdict: 'review', result: 'clear', run: 'fixture' }, 'scope'],
    ['task.comment', { id: 'T-1', verdict: 'qa', result: 'clear', run: 'fixture', scope: 'full' }, 'scope'],
    ['artifact.create', { kind: 'note', title: 'Fixture', topic: 'agents' }, 'content'],
    ['session.launch', { name: 'next', item: 'T-1', cwd: '/virtual/project' }, 'cwd'],
  ] as const) {
    const result = await spoke.call<Record<string, unknown>>(tool, args);
    assert.equal(result.code, 'invalid_argument', JSON.stringify(result));
    assert.ok(String(result.reason).split('; accepted fields:')[0]!.includes(field), JSON.stringify(result));
  }
  assert.equal(hub.core.topicHistory('agents').messages.length, before);
});

test('hub tool availability refuses barred roles before inspecting malformed arguments', async t => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  t.after(() => hub.close());
  for (const [role, tool, args] of [
    ['aide', 'role.handover', { to: 'missing' }],
    ['reviewer', 'task.create', { misspelled_field: true }],
    ['implementer', 'task.close', {}],
  ] as const) {
    const name = `caller-${role}`;
    hub.core.assignRole(name, role);
    const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', name, `${role}-id`);
    const result = await spoke.call<Record<string, unknown>>(tool, args);
    assert.equal(result.code, 'forbidden', JSON.stringify(result));
    assert.equal(result.permission, tool);
    assert.doesNotMatch(String(result.reason), /accepted fields|required property|unknown field/);
    assert.equal(hub.core.topicHistory('agents').messages.at(-1)?.kind, 'refusal');
  }
});

test('custom grants cannot expose argument diagnostics for fixed role prohibitions', async t => {
  const defaults = parseRoles(DEFAULT_ROLES_TOML);
  const roles = new Map(defaults);
  for (const [role, tools] of [['implementer', ['rename', 'artifact.promote', 'rule.add', 'ask']], ['coordinator', ['task.hold']]] as const) {
    const definition = roles.get(role)!;
    roles.set(role, { ...definition, permissions: { tools: [...definition.permissions.tools, ...tools] } });
  }
  const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
  const peers: Array<{ close: () => void }> = [];
  t.after(async () => { for (const peer of peers) peer.close(); await hub.close(); });
  for (const [role, tool, malformed, valid] of [
    ['implementer', 'rename', { name: 42 }, { name: 'next' }],
    ['implementer', 'artifact.promote', { artifact: 42, path: 'evidence.md' }, { artifact: 'A-1', path: 'evidence.md' }],
    ['implementer', 'rule.add', { text: 42 }, { text: 'Fixture', scope: 'all', reason: 'Fixture' }],
    ['implementer', 'ask', { question: 42 }, { topic: 'general', question: 'Which?', options: [] }],
    ['coordinator', 'task.hold', {}, { id: 'T-1' }],
  ] as const) {
    const name = `custom-${role}`;
    hub.core.assignRole(name, role);
    const spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', name, `${role}-id`);
    peers.push(spoke);
    for (const args of [malformed, valid]) {
      const result = await spoke.call<Record<string, unknown>>(tool, args);
      assert.equal(result.code, 'forbidden', `${tool}: ${JSON.stringify(result)}`);
      assert.equal(result.permission, tool);
      assert.doesNotMatch(String(result.reason), /accepted fields|required property|unknown field/);
    }
  }
});

test('Lead root-only prohibitions keep their reason before generic availability with or without custom grants', async t => {
  const validInputs: Record<string, Record<string, unknown>> = { release: { version: '0.1.0' }, sync: {}, push: {}, 'hub.stop': {}, 'hub.reload': {}, rename: { name: 'next' }, 'session.resume': { session: 'worker' } };
  const rootTools = Object.keys(validInputs);
  for (const custom of [false, true]) {
    const roles = new Map(parseRoles(DEFAULT_ROLES_TOML));
    if (custom) {
      const lead = roles.get('lead')!;
      roles.set('lead', { ...lead, permissions: { tools: [...lead.permissions.tools, ...rootTools] } });
    }
    const hub = createHubBase({ secret: 'fixture', env: {}, clock: new FakeClock(), roles: { get: () => roles } });
    let spoke: Awaited<ReturnType<typeof dispatcherSpoke>> | undefined;
    t.after(async () => { spoke?.close(); await hub.close(); });
    hub.core.assignRole('node-lead', 'lead');
    spoke = await dispatcherSpoke(t, hub.dispatcher, '/virtual/project', 'node-lead', 'lead-id');
    for (const tool of rootTools) {
      for (const args of [validInputs[tool]!, { name: 42, session: 42, misspelled_field: true }]) {
        const result: Record<string, unknown> = await spoke.call<Record<string, unknown>>(tool, args);
        assert.equal(result.code, 'forbidden', JSON.stringify(result));
        assert.equal(result.permission, tool);
        assert.equal(result.reason, `root level: only the Coordinator may use ${tool}`);
      }
    }
  }
});
