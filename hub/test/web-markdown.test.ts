// T1: pure per-message Markdown tokens; no renderer, browser or process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../../web/src/markdown.ts';

test('messages preserve heading levels and join paragraph lines', () => {
  assert.deepEqual(parseMarkdown('# Update\r\n\r\nFirst line\r\nsecond line\n\n### Details ###'), [
    { kind: 'heading', level: 1, children: [{ kind: 'text', text: 'Update' }] },
    { kind: 'paragraph', children: [{ kind: 'text', text: 'First line second line' }] },
    { kind: 'heading', level: 3, children: [{ kind: 'text', text: 'Details' }] },
  ]);
  assert.deepEqual(parseMarkdown(' \n\t'), []);
});

test('lists retain text continuations, ordered starts, quotes and tables stay text', () => {
  assert.deepEqual(parseMarkdown('- first\n  continued\n- second\n\n3. third\n4. fourth\n\n> one\n> two\n\n| A | B |\n| --- | --- |\n| **raw** | T-12 |'), [
    { kind: 'list', ordered: false, start: 1, items: [[{ kind: 'text', text: 'first continued' }], [{ kind: 'text', text: 'second' }]] },
    { kind: 'list', ordered: true, start: 3, items: [[{ kind: 'text', text: 'third' }], [{ kind: 'text', text: 'fourth' }]] },
    { kind: 'quote', children: [{ kind: 'text', text: 'one two' }] },
    { kind: 'table', text: '| A | B |\n| --- | --- |\n| **raw** | T-12 |' },
  ]);
});

test('fences retain their language and literal body and stop at each message end', () => {
  assert.deepEqual(parseMarkdown('```ts\n**literal** T-12\n``` trailing\n~~~\n```\nafter\n\n~~~~ js\nconst x = 1;\n~~~~'), [
    { kind: 'code', language: 'ts', text: '**literal** T-12\n``` trailing\n~~~' },
    { kind: 'paragraph', children: [{ kind: 'text', text: 'after' }] },
    { kind: 'code', language: 'js', text: 'const x = 1;' },
  ]);
  assert.deepEqual(parseMarkdown('````python\none\n```\ntwo'), [
    { kind: 'code', language: 'python', text: 'one\n```\ntwo' },
  ]);
  assert.deepEqual(parseMarkdown('next message'), [{ kind: 'paragraph', children: [{ kind: 'text', text: 'next message' }] }]);
});

test('inline formatting and configured item ids become small renderer tokens', () => {
  assert.deepEqual(parseMarkdown('`T-12` **bold T-12** *italic* [docs](https://example.test/docs) http://example.test X-9 E-417 A-3', { itemPrefixes: ['T', 'E', 'X'] }), [
    { kind: 'paragraph', children: [
      { kind: 'code', text: 'T-12' }, { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'bold ' }, { kind: 'item', id: 'T-12' }] },
      { kind: 'text', text: ' ' }, { kind: 'em', children: [{ kind: 'text', text: 'italic' }] },
      { kind: 'text', text: ' ' }, { kind: 'link', href: 'https://example.test/docs', text: 'docs' },
      { kind: 'text', text: ' ' }, { kind: 'link', href: 'http://example.test', text: 'http://example.test' },
      { kind: 'text', text: ' ' }, { kind: 'item', id: 'X-9' },
      { kind: 'text', text: ' ' }, { kind: 'item', id: 'E-417' }, { kind: 'text', text: ' A-3' },
    ] },
  ]);
  assert.deepEqual(parseMarkdown('XT-12 T-12x unknown ~~strike~~ ['), [
    { kind: 'paragraph', children: [{ kind: 'text', text: 'XT-12 T-12x unknown ~~strike~~ [' }] },
  ]);
});

test('HTML, images and unsafe or unsupported link destinations remain literal text', () => {
  for (const source of [
    '<img src="https://evil.test/image" onerror="alert(1)">',
    '<script>alert(1)</script>', '<a href="https://evil.test">click</a>',
    '![image](https://evil.test/image)',
    '[run](javascript:alert(1))', '[run](JaVaScRiPt:alert(1))',
    '[data](data:text/html,payload)', '[old](vbscript:msgbox(1))',
    '[mail](mailto:human@example.test)', '[local](/relative)', '[local](//evil.test)',
    '[bad](https://)', '[bad](https://example.test/\u0000payload)',
  ]) assert.deepEqual(parseMarkdown(source), [{ kind: 'paragraph', children: [{ kind: 'text', text: source }] }], source);
  assert.deepEqual(parseMarkdown('[secure](HTTPS://example.test/path) and https://example.test/path.'), [
    { kind: 'paragraph', children: [
      { kind: 'link', href: 'HTTPS://example.test/path', text: 'secure' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', href: 'https://example.test/path', text: 'https://example.test/path' },
      { kind: 'text', text: '.' },
    ] },
  ]);
});

test('tables without outer pipes keep their rows and unsupported syntax stays visible', () => {
  assert.deepEqual(parseMarkdown('Name | Value\n--- | ---\nT-12 | **raw**\n\n![unfinished\n~~strike~~'), [
    { kind: 'table', text: 'Name | Value\n--- | ---\nT-12 | **raw**' },
    { kind: 'paragraph', children: [{ kind: 'text', text: '![unfinished ~~strike~~' }] },
  ]);
});

test('unsupported fence separators fall back to text and parsing advances', () => {
  for (const separator of ['\u2028', '\u2029']) {
    assert.deepEqual(parseMarkdown(`\`\`\`${separator}payload\n\nafter`), [
      { kind: 'paragraph', children: [{ kind: 'text', text: `\`\`\`${separator}payload` }] },
      { kind: 'paragraph', children: [{ kind: 'text', text: 'after' }] },
    ]);
  }
});
