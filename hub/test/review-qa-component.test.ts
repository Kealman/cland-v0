// T1: role-clause source assertions; native request/verdict transport remains in review-qa.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { parseRoles } from '../src/roles/config.ts';

test('the Reviewer and QA clauses in the roles.toml defaults say how a request arrives, how the verdict is recorded and reported, and the /codex:rescue fallback', (t) => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const reviewer = (roles.get('reviewer')?.clause ?? '');
  const qa = (roles.get('qa')?.clause ?? '');
  const coordinator = (roles.get('coordinator')?.clause ?? '');
  for (const [kind, clause] of [['review', reviewer], ['qa', qa]] as const) {
    assert.match(clause, new RegExp(`${kind} request T-`), `${kind}: the request's first line`);
    assert.match(clause, /task\.view/, `${kind}: reads the item`);
    assert.match(clause, new RegExp(`verdict: ${kind}`), `${kind}: the verdict header`);
    assert.match(clause, /result: clear \| not clear/, `${kind}: the result`);
    assert.match(clause, /run:/, `${kind}: the run id`);
    assert.match(clause, /by severity/, `${kind}: findings ranked`);
    assert.match(clause, /file:line/, `${kind}: findings located`);
    assert.match(clause, /`send`/, `${kind}: reports back`);
    assert.match(clause, /\/codex:rescue/, `${kind}: the fallback`);
    // Explicit human action requests are the exception; ordinary replies require a mention and decision questions climb.
    assert.match(clause, /When the human mentions you in a topic .*Other messages to the human require that mention; decision questions go to the Coordinator\./s, `${kind}: ordinary human replies require a mention`);
    assert.match(clause, /`send` kind `request` with no `to`/, `${kind}: human action requests use the request kind`);
  }
  assert.match(reviewer, /no edits|do not edit|never edit/i, 'the Reviewer edits nothing');
  assert.match(qa, /nvim_input/, 'QA drives a headless Neovim with nvim_input');
  assert.match(qa, /screenstring\(\)/, 'QA reads its grid with screenstring()');
  assert.match(qa, /cland task/, 'QA uses the cland task CLI');
  const implementer = roles.get('implementer')?.clause ?? '';
  assert.match(implementer, /review request T-/, 'the Implementer sends its own conventional review request');
  assert.match(implementer, /qa request T-/, 'the Implementer sends its own conventional QA request');
  assert.match(coordinator, /The item’s lead requests review and QA and handles not-clear verdicts and retries/, 'the Coordinator gives the loop to the item lead');
  assert.match(coordinator, /Lead an unclaimed item outside a claimed Lead subtree yourself/, 'the Coordinator is the fallback for unclaimed work outside container Leads');
  assert.match(coordinator, /\/codex:rescue --wait --fresh --model gpt-6\.1-sol/, 'the Coordinator fallback for review');
  assert.match(coordinator, /gpt-6-astra/, 'the Coordinator fallback for QA');
});
