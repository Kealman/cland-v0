// T1: provider caller-side timeout semantics on fake time; no transport or processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedProvider } from '../src/executor/droplet/deadline.ts';
import { DigitalOceanApi, DigitalOceanError } from '../src/executor/droplet/api.ts';
import { FakeClock } from './fake-clock.ts';

for (const kind of ['transport', 'deadline'] as const) test(`an unanswered provider preserves its ${kind} error contract`, async () => {
  const clock = new FakeClock();
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'fixture' }, clock, async () => new Promise(() => {}));
  const provider = boundedProvider(api, clock, 15000);
  const work = provider.droplets('cland', kind === 'deadline' ? clock.now().getTime() + 1000 : undefined);
  const rejected = assert.rejects(work, error => {
    assert.ok(error instanceof DigitalOceanError);
    assert.equal(error.status, 0); assert.equal(error.id, kind);
    assert.match(error.message, kind === 'deadline' ? /request deadline reached/ : /time bound/);
    return true;
  });
  await clock.advance(kind === 'deadline' ? 1000 : 15000);
  await rejected;
});

for (const kind of ['transport', 'caller', 'phase'] as const) test(`an inner rejection preserves the ${kind} deadline provenance`, async () => {
  const clock = new FakeClock();
  const explicit = kind === 'transport' ? undefined : clock.now().getTime() + 30000;
  let observed: number | undefined;
  const inner = new DigitalOceanError(0, kind === 'transport' ? 'transport' : 'deadline', kind === 'transport' ? 'request failed or exceeded its time bound' : 'request deadline reached');
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'fixture' }, clock, async (_method, _path, _body, deadline) => {
    observed = deadline;
    throw inner;
  });
  const provider = boundedProvider(api, clock, 15000, kind === 'phase' ? explicit : undefined);
  await assert.rejects(provider.droplets('cland', kind === 'caller' ? explicit : undefined), error => error === inner);
  assert.equal(observed, explicit, 'transport cap must not replace an actual caller/phase deadline');
});

test('provider shutdown detaches an unanswered call and refuses later calls', async () => {
  const clock = new FakeClock();
  const shutdown = new AbortController();
  const entered = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<void>();
  let calls = 0;
  const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'fixture' }, clock, async () => {
    calls++; entered.resolve(); await reply.promise;
    return { sizes: [] };
  });
  const provider = boundedProvider(api, clock, 15000, undefined, shutdown.signal);
  const reason = new Error('executor shutting down');
  const rejected = assert.rejects(provider.sizes(), error => error === reason);
  await entered.promise;
  shutdown.abort(reason);
  await rejected;
  reply.resolve();
  await assert.rejects(provider.sizes(), error => error === reason);
  assert.equal(calls, 1, 'shutdown cannot start a second provider request');
  assert.equal(clock.pending, 0);
});
