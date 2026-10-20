// T1: role-clause source assertions; native request/verdict transport remains in review-qa.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { parseRoles } from '../src/roles/config.ts';

test('the Reviewer and QA clauses in the roles.toml defaults say how a request arrives, how the verdict is recorded and reported, and the /codex:rescue fallback', (t) => {
  const roles = parseRoles(DEFAULT_ROLES_TOML);
  const reviewer = (roles.get('reviewer')?.clause ?? '');
  const qa = (roles.get('qa')?.clause ?? '');
  const coordinator = (roles.get('coordinator')?.clause ?? '');
  const qaSkill = readFileSync(new URL('../../.agents/skills/qa/SKILL.md', import.meta.url), 'utf8');
  const implementSkill = readFileSync(new URL('../../.agents/skills/implement/SKILL.md', import.meta.url), 'utf8');
  assert.match(qa, /Follow the `qa` skill’s verdict procedure/, 'QA points to verdict syntax');
  for (const [kind, clause] of [['review', reviewer], ['qa', qa]] as const) {
    const verdict = kind === 'qa' ? qaSkill : clause;
    assert.match(clause, new RegExp(`${kind} request T-`), `${kind}: the request's first line`);
    assert.match(clause, /task\.view/, `${kind}: reads the item`);
    assert.match(verdict, new RegExp(`verdict: ${kind}`), `${kind}: the verdict header`);
    assert.match(verdict, /result: clear \| not clear/, `${kind}: the result`);
    assert.match(verdict, /run:/, `${kind}: the run id`);
    assert.match(verdict, /by severity/, `${kind}: findings ranked`);
    assert.match(verdict, /file:line/, `${kind}: findings located`);
    assert.match(clause, /`send`/, `${kind}: reports back`);
    assert.match(clause, /\/codex:rescue/, `${kind}: the fallback`);
    // Explicit human action requests are the exception; ordinary replies require a mention and decision questions climb.
    assert.match(clause, /When the human mentions you in a topic .*Other messages to the human require that mention; decision questions go to the Coordinator\./s, `${kind}: ordinary human replies require a mention`);
    assert.match(clause, /`send` kind `request` with no `to`/, `${kind}: human action requests use the request kind`);
  }
  assert.match(reviewer, /no edits|do not edit|never edit/i, 'the Reviewer edits nothing');
  assert.match(qa, /Follow the `qa` skill’s execution procedure/, 'QA points to UI/CLI controls');
  assert.match(qa, /Beyond the brief you may run shell\/build\/tests, tracker CLI and headless Neovim checks/, 'QA keeps its check permissions inline');
  assert.match(qaSkill, /nvim_input/, 'QA drives a headless Neovim with nvim_input');
  assert.match(qaSkill, /screenstring\(\)/, 'QA reads its grid with screenstring()');
  assert.match(qaSkill, /cland task/, 'QA uses the cland task CLI');
  const implementer = roles.get('implementer')?.clause ?? '';
  assert.match(implementer, /Follow the `implement` skill’s review\/QA request procedure/, 'the Implementer points to request syntax');
  assert.match(implementSkill, /review request T-/, 'the Implementer sends its own conventional review request');
  assert.match(implementSkill, /qa request T-/, 'the Implementer sends its own conventional QA request');
  assert.match(coordinator, /Item leads request review\/QA and retries/, 'the Coordinator gives the loop to the item lead');
  assert.match(coordinator, /lead unclaimed work outside Lead subtrees/, 'the Coordinator is the fallback for unclaimed work outside container Leads');
  assert.match(coordinator, /follow the `qa` skill’s rescue procedure/, 'the Coordinator points to fallback commands');
  assert.match(coordinator, /read-only review or QA brief.*Your verdict cannot pass the gate/, 'the Coordinator retains fallback limits');
  assert.match(qaSkill, /\/codex:rescue --wait --fresh --model gpt-6\.1-sol/, 'the Coordinator fallback for review');
  assert.match(qaSkill, /gpt-6-astra/, 'the Coordinator fallback for QA');
});
