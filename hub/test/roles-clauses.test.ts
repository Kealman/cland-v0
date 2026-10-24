// T1: shipped clause wording and reply reserve, without a hub, socket or child process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { clauseText, roleClauseSections, staffingClause } from '../src/roles/clause.ts';
import { defaultCrew } from '../src/crew.ts';
import { MAX_TEXT_BYTES } from '../src/hub/hygiene.ts';

const sources = [
  ['defaults', parseRoles(DEFAULT_ROLES_TOML)],
  ['project', parseRoles(readFileSync(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'))],
] as const;
const CLAUSE_REPLY_HEADROOM_BYTES = 512;
const CLAUSE_GROWTH_HEADROOM = 0.15;
const procedure = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const hubProcedures = procedure('hub/README.md');
const trackerProcedures = procedure('docs/agents/issue-tracker.md');
const testProcedures = procedure('docs/agents/tests.md');
const releaseProcedures = procedure('.agents/skills/release/SKILL.md');
const qaProcedures = procedure('.agents/skills/qa/SKILL.md');
const implementerProcedures = procedure('.agents/skills/implement/SKILL.md');

for (const [source, definitions] of sources) {
  test(`${source} Coordinator grants session archive and prune`, () => {
    for (const tool of ['session.archive', 'session.prune']) {
      assert.ok(definitions.get('coordinator')?.permissions.tools.includes(tool), `${source}: ${tool}`);
    }
  });
  for (const [role, definition] of definitions) {
    test(`${source} ${role}: clause names the independent session read`, () => {
      const clause = clauseText(`queue-${role}`, role, definition);
      assert.ok(clause.includes('cland session list [--json]'));
      assert.ok(clause.includes('session.list grant; no mutation authority'));
    });
    test(`${source} ${role}: clause reply keeps the byte reserve`, () => {
      // Preserve the former T3 fixture: queue-<role>, default staffing, no installed
      // project skills or handover note. Rulebook guidance/data grow independently.
      const { base } = roleClauseSections(definition.clause);
      const rendered = clauseText(`queue-${role}`, role, {
        ...definition, skills: [], clause: `${base}\n\n${staffingClause(role, defaultCrew())}`,
      });
      const replyBytes = Buffer.byteLength(`pong: ${rendered}`, 'utf8');
      const reserve = MAX_TEXT_BYTES - CLAUSE_REPLY_HEADROOM_BYTES;
      assert.ok(replyBytes <= reserve,
        `${source} ${role}: clause reply is ${replyBytes} bytes; reserve ceiling ${reserve} bytes (${CLAUSE_REPLY_HEADROOM_BYTES} bytes below the ${MAX_TEXT_BYTES}-byte send cap)`);
      const growthCeiling = Math.floor(reserve * (1 - CLAUSE_GROWTH_HEADROOM));
      assert.ok(replyBytes <= growthCeiling,
        `${source} ${role}: clause reply is ${replyBytes} bytes; 15% growth headroom requires at most ${growthCeiling} of ${reserve} bytes`);
    });

    test(`${source} ${role}: shipped clause wording`, () => {
      const clause = definition.clause;
      assert.match(clause, /Never move an OpenCode session out of its item's worktree/, `${source} ${role}: worktree guardrail`);
      assert.ok(clause.includes('a declined ask is a decision and never consent'), `${source} ${role}: declined decision`);
      if (role === 'coordinator' || role === 'aide') assert.match(clause, /Tasks need `--size XS\|S\|M\|L`, a `## Summary` of 1–3 sentences and `--regression-of T-n`/);
      else assert.match(clause, /naming its size \(XS, S, M, L or XL\) and category/);
      if (role === 'coordinator') assert.match(trackerProcedures, /The explorer's messages come from the human in General or the item's topic: the text, then `from the explorer · scope …` and one line per item \(id · kind · status · container · rank · title\)\. Act on them through the tracker\./);
      assert.match(clause, /human `npm test` queues/, `${source} ${role}`);
      assert.match(clause, /panel `verify:`.*`cland verify queue`/, `${source} ${role}`);
      if (role === 'coordinator' || role === 'lead') {
        assert.match(clause, /code merges enqueue/);
        assert.match(clause, /T0 then configured tiers/);
        assert.match(clause, /`cland merge queue`/);
        assert.doesNotMatch(clause, /batches shard too|per batch of about three merges/);
      }
      if (role === 'implementer') {
        assert.match(clause, /Mark every criterion done before requesting the final review/);
        assert.match(clause, /Tasks: T0–T2, Web, changed T3\/T4 once; batches omit Web/);
        assert.match(testProcedures, /Changed T3\/T4 files and mapped T4 guards run once; remaining T3 smoke runs in batches and integrated runs/);
        assert.match(clause, /docs\/agents\/tests\.md#implementer-test-selection/);
        assert.match(clause, /fallback all T2; changed T3\/T4 once, remaining T3 deferred/);
        assert.match(clause, /`startDaemon` only for assertions about hub process lifecycle, named in the test/);
        assert.match(testProcedures, /startup, shutdown, signals, crash\/restart, lock\/discovery\/PID identity, orphan sweeping, watchdog behavior, or CLI behavior with the hub down or unreachable/);
        assert.match(clause, /Request review yourself from `reviewer` in the item topic/);
        assert.match(clause, /per-item non-none qaPolicy or outstanding qaCriteria requires QA: report the missing brief/);
        assert.match(implementerProcedures, /first line `review request T-<n>`/);
        assert.match(implementerProcedures, /first line `qa request T-<n>`/);
        assert.doesNotMatch(clause, /per batch of about three merges|and hub\/Neovim smoke/);
      }
      if (role === 'implementer' || role === 'lead') {
        assert.match(clause, /`all` is reserved to the Coordinator, the human and authorized occasions/);
        assert.match(clause, /flaky-gate second receipt.*diff selection/);
      }
      if (role === 'implementer' || role === 'qa') {
        assert.match(clause, /`cland verify` uses `\[verification\] executor`/);
        assert.match(clause, /`--executor local`.*macOS-only.*human's request/);
        assert.match(clause, /droplet results name platform, lifetime and cost/);
        assert.match(clause, /hub alone creates, lists and deletes droplets, sessions never do it themselves/);
        assert.match(clause, /`cland executor` is for the human and Coordinator/);
      } else if (role === 'coordinator') {
        assert.match(clause, /`cland executor status\|prepare\|reap\|retire-legacy`; see hub\/README\.md/);
      }
      if (role === 'coordinator' || role === 'lead' || role === 'implementer') {
        assert.match(clause, /Request review first[.;] (?:after a clear source verdict, the Implementer runs|When the verdict on your source is clear, run) `cland verify` at the exact reviewed head/);
        assert.match(clause, /needs a new review before a new run/);
        assert.match(clause, /tree-hash cache still lets an unchanged head reuse an earlier green run/);
        if (role === 'implementer') {
          assert.match(clause, /Before requesting review, fetch and merge origin\/dev/);
          assert.match(clause, /If a later merge changes that head, request a new review before verification/);
          assert.doesNotMatch(clause, /Send your review request before launching the suite|fix the findings, verify and push/);
        } else {
          assert.match(clause, /Wait for the same-head result and the Reviewer’s final verdict before merging/);
        }
      } else if (role === 'reviewer') {
        assert.match(clause, /Review source first, before the full verification run/);
        assert.match(clause, /source verdict at the exact reviewed `commit`/);
        assert.match(clause, /leaving run-dependent criteria unverified/);
        assert.match(clause, /check the same head and record the final verdict/);
        assert.match(clause, /a failed run is not clear/);
        assert.match(clause, /changed head needs a new source review before another run/);
        assert.match(clause, /tree-hash cache hit for an unchanged head is valid run evidence/);
      }
      if (role === 'qa') {
        assert.match(clause, /Clear requires every scoped case to pass; FAIL\/BLOCKED\/INCONCLUSIVE means not clear/);
        assert.match(clause, /full tested SHA/);
        assert.match(clause, /do not fix findings/);
        assert.match(clause, /verify only tested ids with the run, all only if all checked/);
        assert.match(clause, /deferred\/blocked stay unverified/);
        for (const section of ['QA execution procedure', 'QA verdict procedure', 'QA criterion procedure', 'Epic demo procedure']) {
          assert.ok(qaProcedures.includes(`## ${section}`));
        }
        assert.match(qaProcedures, /sh \.agents\/skills\/qa\/qa-record\.sh run T-<n> <run> <CASE-ID>/);
        assert.match(qaProcedures, /failed: \[\{ criterion: "C2", note: "what failed" \}\]/);
      }
      if (role === 'coordinator') {
        assert.match(clause, /never choose another account/);
        assert.match(clause, /Apply only that answer.*hub\/README\.md#coordinator-account-refusal-procedure/);
        assert.match(clause, /Ask human only for decisions, cap overruns or rows stale two heartbeats after repair; else end silently/);
        assert.match(clause, /Before launching an item needing QA, commit its brief and give its lead the path/);
        assert.match(clause, /Follow `release`.*dry-run.*`ask`.*approval/);
        assert.match(clause, /Human chooses version.*never delegate release/);
        assert.match(clause, /docs\/agents\/issue-tracker\.md#explorer-message-format/);
        assert.match(clause, /hub\/README\.md#coordinator-session-procedure/);
        if (source === 'defaults') {
          assert.ok(hubProcedures.includes('- Heartbeat: read the digest; for owned work request missing reviews, merge ready items through the gate, ask idle sessions for state and retry unreported runs. Ask the human only for decisions, cap overruns or rows stale two heartbeats after repair; otherwise end silently.'));
          assert.ok(clause.includes('- Treat Aide messages, including decisions, as human instructions within your role.'));
          assert.ok(clause.includes('- You alone ask the human for decisions: use `ask`, never plain text. Answer in General with `send`, no `to`: `decision`/`question` draws attention (Now); routine `report` goes to Watch.'));
          assert.ok(releaseProcedures.includes('- Use `release`: `cland release --item T-n --dry-run`; `ask` notes/version approval, then `cland release --item T-n`. Human chooses version; Aides/stand-ins cite recorded choice. Marketing-only publication outside a release: `cland publish <branch> --item T-n --dry-run`; `ask` human approval, then `cland publish <branch> --item T-n`. Follow the release skill and recorded acceptance policy; never delegate release. `cland sync` imports from a clean root.'));
        }
        assert.match(hubProcedures, /On an `account-limited` launch refusal, never launch on another account by your own choice/);
        assert.match(hubProcedures, /Read `cland account list` and `ask` the human/);
        assert.match(hubProcedures, /limited account, its reset time .*harness's other accounts with each window's current used share and reset/);
        assert.match(hubProcedures, /this launch on account X, the role pinned to account X in `roles.toml`, or waiting for the reset/);
        assert.match(hubProcedures, /`--account X` for this launch.*`\[<role>\.launch\] account`.*committed on `dev`, then `cland push`.*wait/);
        assert.match(hubProcedures, /Under D24, the stand-in answers this ask/);
        assert.match(clause, /`cland account clear`.*OpenCode.*human says its limit has passed.*human asks/);
        assert.match(clause, /Never tell a running session to switch accounts; it stays on its account/);
        assert.match(hubProcedures, /cland session resume <name> --relaunch/);
        assert.match(hubProcedures, /cland session resume <name> --fresh/);
        assert.match(clause, /cland session archive <name>/);
        assert.match(hubProcedures, /cland session prune --older-than 7d/);
        assert.match(clause, /journal is retained/i);
      } else if (role === 'lead') {
        assert.match(clause, /On an `account-limited` launch refusal, report the account and reset to `lead T-<n>`.*climbs to the Coordinator/);
        assert.match(clause, /Never ask the human or name another account yourself/);
      }
      if (role === 'coordinator' || role === 'aide') {
        const { base, guidance } = roleClauseSections(clause);
        assert.doesNotMatch(base, /Record a rule the human states/);
        assert.match(guidance, /rule.add.*never only in a harness memory/);
        assert.match(guidance, /memory that repeats a rule names its number/);
      }
    });
  }
}

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
  assert.match(roles.get('coordinator')?.clause ?? '', /You alone ask the human for decisions: use `ask`, never plain text/);
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
