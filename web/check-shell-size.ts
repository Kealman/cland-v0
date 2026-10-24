// Compare the production shell entry against a measured pre-change byte count.
// Run after build: node web/check-shell-size.ts <baseline-js-bytes> [growth-bytes]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const baseline = Number(process.argv[2]);
const allowance = Number(process.argv[3] ?? 1024);
assert.ok(Number.isSafeInteger(baseline) && baseline > 0, 'supply measured baseline JS bytes');
assert.ok(Number.isSafeInteger(allowance) && allowance >= 0, 'supply allowed growth bytes');
const dist = new URL('./dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1]!);
assert.equal(scripts.length, 1, 'one initial production shell entry');
assert.equal(html.includes('modulepreload'), false, 'include initial preload chunks in the measurement if splitting changes');
const bytes = (await readFile(new URL(`.${scripts[0]}`, dist))).length;
assert.ok(bytes - baseline <= allowance, `initial JS grew ${bytes - baseline} bytes (limit ${allowance})`);
console.log(`Initial shell JS: baseline ${baseline}, current ${bytes}, growth ${bytes - baseline} bytes, limit ${allowance}`);
