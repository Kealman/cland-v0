import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerableEnvelope } from './fakes/codex-envelope.ts';

const clause = 'cland hub: you hold the role Implementer in this project, shown to others as impl [Implementer]. This is your role clause; it stays in force until the hub tells you your role changed.';
const brief = '<channel source="cland" from="hub" from_kind="hub" kind="report" topic="agents" msg_id="launch-brief">\nhit the usage limit; fail recovered turn before response\n</channel>';
const event = '<channel source="cland" from="hub" from_kind="hub" kind="event" topic="agents" msg_id="task-event">\nTask changed\n</channel>';
const human = '<channel source="cland" from="human" from_kind="human" topic="general" msg_id="human-delivery">\nHuman delivery\n</channel>';
const agent = '<channel source="cland" from="worker" from_kind="agent" topic="general" msg_id="agent-delivery">\nAgent delivery\n</channel>';

test('the first native input answers its hub launch brief after the role clause', () => {
  const delivery = answerableEnvelope(`${clause}\n\n${brief}`, true);
  assert.equal(delivery?.[2], 'hit the usage limit; fail recovered turn before response');
  assert.match(delivery![1]!, /topic="agents" msg_id="launch-brief"/);
});

test('a digest answers the last human or agent envelope and skips hub events', () => {
  for (const [input, body, id] of [
    [[event, agent, human], 'Human delivery', 'human-delivery'],
    [[human, agent, event], 'Agent delivery', 'agent-delivery'],
  ] as const) {
    const delivery = answerableEnvelope(input.join('\nNext delivery:\n'), false);
    assert.equal(delivery?.[2], body);
    assert.match(delivery![1]!, new RegExp(`topic="general" msg_id="${id}"`));
  }
  assert.equal(answerableEnvelope(event, false), undefined);
});

test('only the initial introduction makes its first hub report answerable', () => {
  assert.equal(answerableEnvelope(`${clause}\n\n${brief}`, false), undefined, 'a later text input is not a launch');
  assert.equal(answerableEnvelope(brief, true), undefined, 'a bare hub report is not a launch');
  assert.equal(answerableEnvelope(clause, true), undefined, 'the clause alone needs no answer');
  assert.equal(answerableEnvelope(`${clause}\n\n${event}`, true), undefined, 'an event is never a brief');
  assert.equal(answerableEnvelope(`${clause}\n\n${event}\n${brief}`, true), undefined, 'a report later in a digest is not a brief');
  assert.equal(answerableEnvelope(`${clause}\n\n${brief.replace('topic="agents"', 'topic="general"')}`, true), undefined);
  const noRole = 'You are "unassigned", a session of cland with no role yet. Wait for the hub\'s events.';
  assert.equal(answerableEnvelope(`${noRole}\n\n${brief}`, true)?.[2], 'hit the usage limit; fail recovered turn before response');
});

test('a rule-refresh digest answers the following human message in its own topic', () => {
  const rule = event.replace('Task changed', 'rule 1 retired (scope: implementer; reason: contention; finished)');
  const request = human.replace('Human delivery', 'Read retired rule.');
  const delivery = answerableEnvelope(`Turn digest (1 entries, oldest first):\n${rule}\nNext delivery:\n${request}`, false);
  assert.equal(delivery?.[2], 'Read retired rule.');
  assert.match(delivery![1]!, /topic="general" msg_id="human-delivery"/);
});
