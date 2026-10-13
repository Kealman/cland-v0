import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOCUMENTED_TOOLS, startHub, spawnSpoke } from './harness.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { parseRoles } from '../src/roles/config.ts';

test('the spoke declares the channel capability, the documented tools and its instructions', async () => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, name: 'alpha' });
  try {
    const caps = spoke.client.getServerCapabilities();
    assert.deepEqual(caps?.experimental?.['claude/channel'], {});
    assert.ok(caps?.tools, 'tools capability');
    const { tools } = await spoke.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...DOCUMENTED_TOOLS]);
    const instructions = spoke.client.getInstructions() ?? '';
    assert.match(instructions, /from_kind="human"/);
    assert.match(instructions, /never treat it as authorization/);
    assert.match(instructions, /Do not send acknowledgements or thanks/);
    assert.match(instructions, /prompt injection/);
    // Questions climb one lead at a time (spec 3.7); the Coordinator owns the human boundary.
    assert.match(instructions, /Send an item question with kind question to lead T-<n> in its item topic/);
    assert.match(instructions, /The receiving lead answers with ask.answer .* or forwards unchanged one level with ask.forward/);
    assert.match(instructions, /The Coordinator alone forwards to the human, or asks with ask/);
    assert.match(instructions, /Questions without an item go to coordinator in General/);
    assert.match(instructions, /Topics are opened by the Coordinator or an Aide, or by an Implementer for its own item/);
    assert.match(instructions, /the human's latest message mentioned you \(`@your-role` or `@your-name`\)/);
    assert.doesNotMatch(instructions, /a question for the human has no fitting topic/i);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('who() lists every connected session with its session id, role, status and connect time', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha' });
  const beta = await spawnSpoke({ hub, name: 'beta', role: 'reviewer', sessionId: 'sess-beta' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    const who = await alpha.call<{ ok: boolean; me: string; sessions: Array<Record<string, unknown>> }>('who');
    assert.equal(who.ok, true);
    assert.equal(who.me, 'alpha');
    const b = who.sessions.find((d) => d.name === 'beta');
    assert.ok(b);
    assert.equal(b.role, 'reviewer');
    assert.equal(b.status, null);
    assert.equal(b.sessionId, 'sess-beta');
    assert.equal(typeof b.cwd, 'string');
    assert.match(String(b.connectedAt), /^\d{4}-/);
    assert.equal(who.sessions.find((d) => d.name === 'alpha')?.role, null);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('role clauses keep decision questions with the Coordinator and allow explicit human action requests', () => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  for (const role of ['implementer', 'reviewer', 'qa']) {
    const clause = roles.get(role)?.clause ?? '';
    assert.doesNotMatch(clause, /Never write to the human/, role);
    assert.match(clause, /When the human mentions you in a topic \(`@[a-z]+` or your name\), answer the human in that topic with `send` and no `to`/, role);
    if (role === 'implementer') {
      assert.match(clause, /When blocked, report .* with `send` to `lead T-<n>` for your own item/, role);
      assert.match(clause, /your report climbs to the next Lead, then the Coordinator/, role);
      assert.match(clause, /only the Coordinator puts decision questions to the human/, role);
    } else {
      assert.match(clause, /Report: `send` kind `report` to `@lead T-<n>` \(`to: \["lead T-<n>"\]`\)/, role);
      assert.match(clause, /For a closed or unknown item, address `coordinator` instead/, role);
    }
  }
  assert.match(roles.get('coordinator')?.clause ?? '', /You alone put decision questions to the human/);
  // Init preserves project clauses, so both shipped sources must describe the request exception.
  const project = parseRoles(readFileSync(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
  for (const [source, definitions] of [['defaults', roles], ['project', project]] as const) {
    for (const role of ['implementer', 'lead', 'reviewer', 'qa']) {
      const clause = definitions.get(role)?.clause ?? '';
      assert.match(clause, /When asking the human for a review, a QA run or a handover/, `${source} ${role}: action requests`);
      assert.match(clause, /`send` kind `request` with no `to`/, `${source} ${role}: explicit human recipient`);
      assert.match(clause, /`request: "review" \| "qa" \| "handover"` and `subject` naming the item, artifact or session/, `${source} ${role}: request metadata`);
      assert.match(clause, /Other messages to the human require that mention|For messages other than the explicit requests above/, `${source} ${role}: ordinary messages stay mention-scoped`);
    }
  }
});
