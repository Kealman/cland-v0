// T1: model syntax, session policy and fake-record publication with injected I/O; no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModel, formatModel } from '../src/adapters/opencode/client.ts';
import { sessionPolicy } from '../src/adapters/opencode/policy.ts';
import { writeSessionRecord, isSessionRecord } from './fakes/session-record.ts';

test('fake OpenCode session publication keeps a complete record during a partial write', () => {
  const path = '/fake/sessions/ses-1.json';
  const before = { id: 'ses-1', directory: '/old' };
  const after = { id: 'ses-1', directory: '/next' };
  const records = new Map([[path, JSON.stringify(before)]]);
  let observedPartial = false;
  writeSessionRecord(path, after, {
    temporary: target => `${target}.tmp`,
    write: (target, text) => {
      records.set(target, text.slice(0, text.length / 2));
      observedPartial = true;
      assert.deepEqual(JSON.parse(records.get(path)!), before);
      assert.deepEqual([...records.keys()].filter(isSessionRecord), [path], 'listing excludes partial temporary records');
      records.set(target, text);
    },
    rename: (from, to) => { records.set(to, records.get(from)!); records.delete(from); },
  });
  assert.equal(observedPartial, true, 'positive control: the partial write window was observed');
  assert.deepEqual(JSON.parse(records.get(path)!), after);
  assert.deepEqual([...records.keys()], [path], 'publication leaves no temporary entry');
});

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
