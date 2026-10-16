import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRulebook, renderRulebook } from '../src/rules/rulebook.ts';

const source = '# Project rules\r\n\r\n## 1 One suite\r\nScope: coordinator, implementer\r\nDate: 2026-10-14\r\nStatus: active\r\nOrigin: memory:/rules.md\r\nReason: avoid contention\r\n\r\nRun one suite.\r\n\r\n## 3 Old rule\r\nScope: all\r\nDate: 2026-10-15\r\nStatus: retired 2026-10-15\r\nOrigin: shell\r\nReason: replaced\r\n\r\nOld text.\r\n';

test('rulebook parses every field and preserves untouched rule bytes while rendering an edit', () => {
  const book = parseRulebook(source);
  assert.deepEqual(book.rules[0], { number: 1, title: 'One suite', scope: ['coordinator', 'implementer'], date: '2026-10-14', status: 'active', origin: 'memory:/rules.md', reason: 'avoid contention', text: 'Run one suite.' });
  assert.equal(book.rules[1]?.retired, '2026-10-15');
  assert.equal(renderRulebook(book), source);
  const first = book.rules[0]!;
  const changed = renderRulebook(book, [{ ...first, scope: 'all', text: 'Run serially.' }, book.rules[1]!]);
  assert.equal(changed.slice(changed.indexOf('## 3')), source.slice(source.indexOf('## 3')));
  assert.equal(parseRulebook(changed).rules[0]?.text, 'Run serially.');
});

test('rulebook rejects malformed rules with a line and reason', () => {
  for (const [bad, reason] of [
    [source.replace('Scope: coordinator, implementer', 'Scope: wizard'), /line 4.*unknown role wizard/],
    [source.replace('## 3 Old rule', '## 1 Old rule'), /line 12.*increasing/],
    [source.replace('2026-10-14', '2026-02-30'), /line 5.*date/],
    [source.replace('Status: active', 'Status: deleted'), /line 6.*status/],
    [source.replace('Origin: shell', 'Origin: invented'), /line 16.*origin/],
    [source.replace('Reason: avoid contention', 'Reason: '), /line 8.*reason/],
  ] as const) assert.throws(() => parseRulebook(bad), reason);
});

test('rulebook round-trips separate retirement provenance and rejects invalid origins', () => {
  const retired = source.replace('Reason: replaced\r\n', 'Reason: replaced\r\nRetired-origin: message:general/human-retirement\r\n');
  const book = parseRulebook(retired);
  assert.equal(book.rules[1]?.origin, 'shell');
  assert.equal(book.rules[1]?.retired_origin, 'message:general/human-retirement');
  assert.equal(renderRulebook(book), retired);
  const changed = renderRulebook(book, [book.rules[0]!, { ...book.rules[1]!, text: 'Archived text.' }]);
  const reparsed = parseRulebook(changed).rules[1]!;
  assert.equal(reparsed.origin, 'shell');
  assert.equal(reparsed.retired_origin, 'message:general/human-retirement');
  for (const invalid of ['', 'invented']) {
    assert.throws(() => parseRulebook(retired.replace('Retired-origin: message:general/human-retirement', `Retired-origin: ${invalid}`)), /line 18.*retirement origin/);
  }
  assert.throws(() => parseRulebook(retired.replace('Status: retired 2026-10-15', 'Status: active')), /line 18.*retired status/);
});
