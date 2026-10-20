// T1: model selection syntax at the OpenCode client boundary; no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModel, formatModel } from '../src/adapters/opencode/client.ts';
import { sessionPolicy } from '../src/adapters/opencode/policy.ts';

test('OpenCode ignores approval, sandbox and permissions in favor of its own policy', { timeout: 500 }, () => {
  for (const approval of [null, 'never', 'on-request', 'untrusted'] as const) {
    for (const mode of [null, 'read-only', 'workspace-write', 'danger-full-access'] as const) {
      for (const permissions of [null, 'auto', 'skip'] as const) {
        const policy = sessionPolicy({ cwd: '/project', approval, permissions,
          sandbox: mode ? { mode, writableRoots: [], network: 'none' } : null });
        assert.deepEqual(policy.rules, [], `${approval}/${mode}/${permissions}`);
        assert.deepEqual(policy.unsupported.map(row => row.field), [
          ...(approval ? ['approval'] : []), ...(mode ? ['sandbox', 'network'] : []), ...(permissions ? ['permissions'] : []),
        ]);
      }
    }
  }
});

test('OpenCode model references preserve explicit variants', { timeout: 500 }, () => {
  for (const [input, expected] of [
    ['openai/gpt-5.2#high', { providerID: 'openai', id: 'gpt-5.2', variant: 'high' }],
    ['big-pickle#low', { providerID: 'opencode', id: 'big-pickle', variant: 'low' }],
    ['provider/org/model', { providerID: 'provider', id: 'org/model' }],
  ] as const) {
    assert.deepEqual(parseModel(input), expected);
    assert.equal(formatModel(expected), input.startsWith('big-pickle') ? `opencode/${input}` : input);
  }
});
