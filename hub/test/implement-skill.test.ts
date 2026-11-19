// T1: documentation bytes and pure lint policy; no hub or native processes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkWorkflow, workflowFindings } from './implement-workflow-policy.ts';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('workflow lint rejects subsystem additions and directs authors to their destinations', () => {
  const baseline = ['Implement the item.'];
  const source = 'Implement the item.\n\nPool creation uses the provider watchdog.';
  const findings = workflowFindings(source, baseline);
  assert.equal(findings.length, 1);
  assert.match(findings[0]!, /docs\/hub\//);
  assert.match(findings[0]!, /CHANGES\//);
  assert.deepEqual(workflowFindings(baseline[0]!, baseline), []);
});

test('workflow markers permit only the following paragraph and require an item and reason', () => {
  const marker = '<!-- cland-workflow-change: T-123 shared review workflow -->';
  assert.deepEqual(workflowFindings(`${marker}\nNew review procedure.`, []), []);
  assert.deepEqual(workflowFindings(`${marker}\n\nNew review procedure.`, []), []);
  assert.equal(workflowFindings(`${marker}\nNew procedure.\n\nPool instruction.`, []).length, 1);
  for (const invalid of ['<!-- cland-workflow-change: -->', '<!-- cland-workflow-change: T-123 -->', '<!-- cland-workflow-change: a reason -->']) {
    assert.ok(workflowFindings(`${invalid}\nNew procedure.`, []).length > 0);
  }
  assert.ok(workflowFindings('Changed workflow.', ['Original workflow.']).length > 0);
  assert.ok(workflowFindings(marker, []).length > 0, 'orphan marker');
});

test('the existing lint command wires report mode and findings refuse only in enforcement mode', () => {
  const baseline = JSON.parse(read('hub/test/fixtures/implement-workflow.json')) as string[];
  const source = `${baseline.join('\n\n')}\n\nNew subsystem instruction.`;
  const reported = checkWorkflow(source, baseline);
  assert.equal(reported.mode, 'report');
  assert.equal(reported.exitCode, 0);
  assert.equal(reported.findings.length, 1);
  const enforced = checkWorkflow(source, baseline, true);
  assert.equal(enforced.mode, 'enforce');
  assert.equal(enforced.exitCode, 1);
  assert.deepEqual(enforced.findings, reported.findings);
  assert.equal(checkWorkflow(read('.agents/skills/implement/SKILL.md'), baseline).exitCode, 0);
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.ok(pkg.scripts['test:lint']!.includes('npm run test:static'));
  assert.match(pkg.scripts['test:static']!, /(?:^| && )node hub\/test\/lint-implement-workflow\.ts(?: && |$)/);
});

function migrationContract(skill: string): void {
  const before = read('hub/test/fixtures/implement-skill-before.md').split('\n\n');
  const moves = JSON.parse(read('hub/test/fixtures/implement-moves.json')) as Record<string, number[]>;
  const replacements = (JSON.parse(read('hub/test/fixtures/implement-merge-replacements.json')) as {
    replacements: { position: number; destination: string; previous: string; text: string }[];
  }).replacements;
  assert.equal(new Set(replacements.map(change => change.position)).size, replacements.length);
  // The immutable workflow baseline records retained bytes at migration time.
  // Live workflow replacements are governed by checkWorkflow, not old prose.
  const workflow = (JSON.parse(read('hub/test/fixtures/implement-workflow.json')) as string[]).join('\n\n');
  const index = read('hub/README.md');
  const moved = new Set<number>();
  for (const [name, positions] of Object.entries(moves)) {
    const path = `docs/hub/implementation/${name}.md`;
    assert.ok(index.includes(`../${path}`), path);
    const destination = Buffer.from(read(path));
    for (const position of positions) {
      assert.ok(!moved.has(position), `duplicate move ${position}`);
      moved.add(position);
      const replacement = replacements.find(change => change.position === position);
      if (replacement) {
        assert.equal(replacement.destination, name);
        assert.equal(replacement.previous, before[position], `superseded paragraph ${position} differs from historical source`);
      }
      const bytes = Buffer.from(replacement?.text ?? before[position]!);
      assert.ok(destination.includes(bytes), `${path}: current moved paragraph ${position}`);
      assert.ok(!skill.includes(bytes.toString()), `subsystem paragraph ${position} left in workflow`);
    }
  }
  before.forEach((paragraph, position) => {
    if (paragraph.trim() && !moved.has(position)) assert.ok(workflow.includes(paragraph.trim()), `workflow paragraph ${position} lost from migration baseline`);
  });
  for (const replacement of replacements) assert.ok(moved.has(replacement.position), 'replacement must name a moved paragraph');
}

test('every subsystem paragraph survives verbatim at its indexed destination', () => {
  migrationContract(read('.agents/skills/implement/SKILL.md'));
});

test('a marked workflow replacement passes the complete migration and enforcement contract', () => {
  const baseline = JSON.parse(read('hub/test/fixtures/implement-workflow.json')) as string[];
  const skill = baseline.join('\n\n') + '\n';
  const old = 'Implement the work described by the user in the spec or tickets.';
  assert.ok(skill.includes(old), 'positive replacement control');
  const replacement = 'Implement the claimed work and collect its review receipts.';
  const unmarked = skill.replace(old, replacement);
  const marked = skill.replace(old, `<!-- cland-workflow-change: T-123 shared implementation workflow -->\n${replacement}`);
  for (const candidate of [unmarked, marked]) migrationContract(candidate);
  assert.equal(checkWorkflow(unmarked, baseline, true).exitCode, 1);
  assert.deepEqual(checkWorkflow(marked, baseline, true), { mode: 'enforce', findings: [], exitCode: 0 });
});
