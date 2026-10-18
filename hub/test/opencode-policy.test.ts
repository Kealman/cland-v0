// T1: model selection syntax at the OpenCode client boundary; no native resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModel, formatModel } from '../src/adapters/opencode/client.ts';

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
