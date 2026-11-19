// T0: the same pure policy used by the T1 controls, with no Git/hub dependency.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkWorkflow } from './implement-workflow-policy.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('./fixtures/implement-workflow.json')) as string[];
const control = checkWorkflow('A subsystem addition.', []);
assert.ok(control.findings.length, 'workflow lint positive control');
assert.equal(control.exitCode, 0, 'new guard defaults to report mode');
assert.equal(checkWorkflow('A subsystem addition.', [], true).exitCode, 1);
assert.equal(checkWorkflow('<!-- cland-workflow-change: T-1 shared workflow -->\nA workflow edit.', [], true).exitCode, 0);
const result = checkWorkflow(read('../../.agents/skills/implement/SKILL.md'), baseline, process.argv.includes('--enforce'));
for (const finding of result.findings) console.error(`[${result.mode}] ${finding}`);
process.exitCode = result.exitCode;
console.log(`implement workflow lint (${result.mode}): ${result.findings.length} findings`);
