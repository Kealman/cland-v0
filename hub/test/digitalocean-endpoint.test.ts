// T1: endpoint declarations and validation; no I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { declareDigitalOceanEndpoint, parseDigitalOceanEndpoint } from '../src/executor/droplet/endpoint.ts';

test('legacy real and custom URLs retain the 250 per minute policy', () => {
  assert.deepEqual(parseDigitalOceanEndpoint(), { base: 'https://api.digitalocean.com/v2', requestsPerMinute: 250 });
  assert.deepEqual(parseDigitalOceanEndpoint('http://127.0.0.1:9000/v2'), { base: 'http://127.0.0.1:9000/v2', requestsPerMinute: 250 });
});
test('endpoint declaration metadata is normalized and omitted from transport', () => {
  const value = declareDigitalOceanEndpoint('HTTP://LOCALHOST:80/v2///', 100000);
  assert.equal(value, 'http://localhost/v2#requests-per-minute=100000');
  assert.deepEqual(parseDigitalOceanEndpoint(value), { base: 'http://localhost/v2', requestsPerMinute: 100000 });
});
test('equivalent real endpoint declarations cannot increase the production cap', () => {
  assert.deepEqual(parseDigitalOceanEndpoint('https://API.DIGITALOCEAN.COM:443/v2///#requests-per-minute=100000'), { base: 'https://api.digitalocean.com/v2', requestsPerMinute: 250 });
  assert.equal(declareDigitalOceanEndpoint('https://api.digitalocean.com/v2', 100000), 'https://api.digitalocean.com/v2#requests-per-minute=250');
  assert.equal(parseDigitalOceanEndpoint(declareDigitalOceanEndpoint('https://api.digitalocean.com/v2', 250)).requestsPerMinute, 250);
});
for (const fragment of ['requests-per-minute=0', 'requests-per-minute=-1', 'requests-per-minute=1.5', 'requests-per-minute=Infinity', 'requests-per-minute=9007199254740992', 'requests-per-minute=250&requests-per-minute=100000', 'other=100000']) test(`reject invalid endpoint declaration ${fragment}`, () => {
  assert.throws(() => parseDigitalOceanEndpoint(`http://127.0.0.1:9000/v2#${fragment}`));
});
for (const [name, source] of [['file scheme', 'file:///tmp/api'], ['query', 'http://127.0.0.1/v2?limit=100000'], ['credentials', 'http://user:password@127.0.0.1/v2']]) test(`reject non-base endpoint ${name}`, () => {
  assert.throws(() => parseDigitalOceanEndpoint(source), /HTTP\(S\) base/);
});
