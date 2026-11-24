// T2: injected provider transport and clock; fake loopback HTTP and scripted transport; no child processes.
import test, { type TestContext } from 'node:test';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';
import { FakeClock } from './fake-clock.ts';
import * as apiTypes from '../src/executor/droplet/api.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { until, testWaitMs } from './until.ts';
import { receiptFixtureCase, type ReceiptStep } from './receipt-fixture-case.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, ownDirectory, drainFixtureCleanup, onCleanup, fenceFixtureCleanup } from './process-cleanup.ts';

type Fake = Awaited<ReturnType<typeof fakeDigitalOcean>>;
function hookCase(t: TestContext, transport: 'scripted' | 'http', body: (f: {
  fake: Fake; client: DigitalOceanApi; signal: AbortSignal; step: ReceiptStep;
  release: (action: () => void) => void;
  cleanup: () => Promise<void>;
  expectClose: (check: (error: unknown) => boolean) => Promise<void>;
}) => Promise<void>) {
  return receiptFixtureCase(t, false, async (fixtures, step, adoptRoot, release) => {
    fenceFixtureCleanup(fixtures);
    let fake: Fake | undefined;
    let acceptedClose: unknown;
    const abort = new AbortController();
    release(() => abort.abort());
    // Installed before acquisition; the shared owner joins late setup first.
    onCleanup(fixtures, async () => {
      try { await fake?.close(); }
      catch (error) { if (error !== acceptedClose) throw error; }
    });
    const clock = new FakeClock();
    const token = `cland-test-hook-${transport}`;
    const api = await step('fake provider setup', async () => {
      fake = await fakeDigitalOcean(token, { machine: 'scripted', transport, clock, testContext: fixtures });
      adoptRoot(fake.stateRoot);
      return fake;
    });
    const client = transport === 'scripted' ? api.provider : new DigitalOceanApi({ DIGITALOCEAN_TOKEN: token, CLAND_DIGITALOCEAN_API: api.url }, clock);
    await body({ fake: api, client, signal: abort.signal, step, release,
      cleanup: () => drainFixtureCleanup(fixtures),
      expectClose: check => step('provider closure receipt', () => assert.rejects(api.close(), error => {
        acceptedClose = error; // The body owns this observed rejection, including a failing predicate.
        if (!check(error)) return false;
        return true;
      })),
    });
  });
}

for (const transport of ['scripted', 'http'] as const) test(`beforeCreate retains its original assertion through drainage (${transport})`, t => hookCase(t, transport, async ({ fake, client, signal, step, expectClose }) => {
  const original = new assert.AssertionError({ message: 'reservation must exist before create' });
  fake.beforeCreate(async () => { throw original; });
  await step('provider failure receipt', () => assert.rejects(client.create({ name: 'hook-control', region: 'lon1', size: 'c-8', image: 900, ssh_keys: [], tags: [] }, undefined, { signal }), { status: 500, id: 'lease-missing' }));
  await expectClose(error => error === original);
  assert.equal(fake.droplets.length, 0);
}));

test('hook case retains its native guard after rejected close until same-owner repair', t => {
  const originalSpawn = cp.spawn;
  const observer = caseDeadlines(t, { timeoutMs: testWaitMs() });
  const context = { name: t.name, signal: t.signal, after: () => {} } as unknown as TestContext;
  const gate = Promise.withResolvers<void>();
  const incomplete = new Error('controlled provider drainage rejection');
  let fake: Fake | undefined;
  let guardedSpawn = originalSpawn;
  let request: Promise<unknown> | undefined;
  let cleanup: (() => Promise<void>) | undefined;
  let restoreClose: (() => void) | undefined;
  const dispose = async () => {
    gate.resolve(); restoreClose?.();
    await cleanup?.(); await request;
    await drainFixtureCleanup(context);
  };
  observer.fixtures.after(dispose);
  return (async () => {
    await observer.wait('owned hook case setup', () => hookCase(context, 'scripted', async f => {
      fake = f.fake; cleanup = f.cleanup; guardedSpawn = cp.spawn;
      assert.notEqual(guardedSpawn, originalSpawn, 'positive native guard installed');
      const entered = Promise.withResolvers<void>();
      f.release(() => gate.resolve());
      fake.beforeCreate(async () => { entered.resolve(); await gate.promise; });
      request = f.client.create({ name: 'fenced-close-control', region: 'lon1', size: 'c-8', image: 900, ssh_keys: [], tags: [] }, undefined, { signal: f.signal }).catch(() => {});
      const close = t.mock.method(fake, 'close', async () => { throw incomplete; });
      restoreClose = () => close.mock.restore();
      await f.step('held provider writer receipt', () => entered.promise);
    }));
    assert.ok(fake); assert.ok(cleanup);
    try {
      await observer.wait('same-owner close refusal', () => assert.rejects(cleanup!(), error => error === incomplete || error instanceof AggregateError && error.errors.includes(incomplete)));
      assert.equal(cp.spawn, guardedSpawn, 'native guard retained after rejected close');
      await observer.wait('retained provider root receipt', () => fs.stat(fake!.stateRoot));
    } finally { await observer.wait('same-owner repaired cleanup receipt', dispose); }
    await observer.wait('removed provider root receipt', () => assert.rejects(fs.stat(fake!.stateRoot), { code: 'ENOENT' }));
    assert.equal(cp.spawn, originalSpawn, 'native seam restored only after repaired cleanup');
  })();
});

for (const transport of ['scripted', 'http'] as const) test(`checked wait receives the hook assertion even when the caller catches the provider failure (${transport})`, t => hookCase(t, transport, async ({ fake, client, signal, step, release, expectClose }) => {
  const original = new assert.AssertionError({ message: 'armed lease is missing' });
  fake.beforeCreate(async () => { throw original; });
  const waiting = Promise.withResolvers<void>();
  release(() => waiting.resolve());
  const observed = assert.rejects(fake.checked(waiting.promise), error => error === original);
  const request = client.create({ name: 'checked-control', region: 'lon1', size: 'c-8', image: 900, ssh_keys: [], tags: [] }, undefined, { signal }).catch(() => {});
  try {
    await step('original assertion receipt', () => observed);
    await step('caught request completion', () => request);
    await step('retained assertion receipt', () => assert.rejects(fake.checked(Promise.resolve('later wait')), error => error === original));
  } finally { waiting.resolve(); }
  await expectClose(error => error === original);
}));

test('intentional create refusal does not fail checked waits or teardown', t => hookCase(t, 'scripted', async ({ fake, client, signal, step }) => {
    fake.beforeCreate(async () => {});
    fake.faults.create = 500;
    await step('intentional refusal receipt', () => assert.rejects(fake.checked(client.create({ name: 'refusal-control', region: 'lon1', size: 'c-8', image: 900, ssh_keys: [], tags: [] }, undefined, { signal })), { status: 500, id: 'refused' }));
    assert.equal(await fake.checked(Promise.resolve('healthy')), 'healthy');
}));

for (const frozen of [false, true]) test(`hook assertion stays primary when root removal rejects (frozen=${frozen})`, t => hookCase(t, 'scripted', async ({ fake, client, signal, step, expectClose }) => {
  const original = new assert.AssertionError({ message: 'reservation assertion remains primary' });
  if (frozen) Object.freeze(original);
  const secondary = new Error('controlled root removal failure');
  fake.beforeCreate(async () => { throw original; });
  await step('hook failure receipt', () => assert.rejects(client.create({ name: 'cleanup-control', region: 'lon1', size: 'c-8', image: 900, ssh_keys: [], tags: [] }, undefined, { signal }), { status: 500 }));
  const remove = fs.rm;
  let removalAttempts = 0;
  const rejectRemoval: typeof fs.rm = async (path, options) => {
    if (path === fake.stateRoot) { removalAttempts++; throw secondary; }
    return remove(path, options);
  };
  const mocked = t.mock.method(fs, 'rm', rejectRemoval);
  syncBuiltinESMExports();
  try {
    await expectClose(error => {
      assert.ok(error instanceof Error);
      if (frozen) { assert.equal(error.cause, original); assert.equal(error.message, original.message); }
      else assert.equal(error, original);
      assert.deepEqual(Reflect.get(error, 'suppressed'), [secondary]);
      return true;
    });
    assert.equal(removalAttempts, 1, 'production removal path reached the controlled rejection');
    await step('retained root receipt', () => fs.stat(fake.stateRoot));
  } finally {
    mocked.mock.restore(); syncBuiltinESMExports();
    await step('drained retained root disposal', () => remove(fake.stateRoot, { recursive: true, force: true }));
  }
}));

test('late rejected provider setup keeps its root until guarded cleanup observes closure', t => receiptFixtureCase(t, false, async (fixtures, step, _adoptRoot, release) => {
  const observationClock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const gate = Promise.withResolvers<void>();
  const context = { name: 'held provider setup control', signal: t.signal, after: () => {} } as unknown as TestContext;
  const owner = caseDeadlines(context, { clock: observationClock, timeoutMs: 10,
    ownership: { beforeDirectories, guardDirectoryRemoval }, releaseOnClose: () => gate.resolve(),
  });
  release(() => gate.resolve());
  fixtures.after(() => drainFixtureCleanup(context));
  let fake: Fake | undefined;
  let closed = false;
  let remove: (() => Promise<void>) | undefined;
  owner.fixtures.after(async () => { await fake?.close(); closed = true; });
  const rejected = new Error('controlled late acquisition rejection');
  const acquisition = owner.run(async admit => admit(async () => {
    fake = await fakeDigitalOcean('cland-test-late-hook-setup', { machine: 'scripted', transport: 'http', clock: new FakeClock() });
    owner.adoptRoot(fake.stateRoot);
    remove = ownDirectory(context, fake.stateRoot, { beforeRemove: () => {
      assert.equal(closed, true, 'provider closure not yet observed');
    } });
    entered.resolve();
    await gate.promise;
    throw rejected;
  }));
  const original = assert.rejects(acquisition, error => error === rejected);
  const observation = assert.rejects(owner.wait('bounded setup observation', () => acquisition), /deadline exceeded/);
  await step('held setup receipt', () => entered.promise);
  await observationClock.advance(10);
  await observation;
  assert.ok(fake); assert.ok(remove);
  // The real guarded removal joins late setup, then refuses before provider closure.
  await step('guarded removal refusal', () => assert.rejects(remove!(), /provider closure not yet observed/));
  await original;
  await step('retained root receipt', () => fs.stat(fake!.stateRoot));
  await step('owned provider closure', () => drainFixtureCleanup(context));
  assert.equal(closed, true);
  await step('removed root receipt', () => assert.rejects(fs.stat(fake!.stateRoot), { code: 'ENOENT' }));
  await step('closed provider admission receipt', () => assert.rejects(fake!.provider.account(), { id: 'closed' }));
}));

test('300 queued calls share a token budget across clients in every 60 second window', async () => {
  const clock = new FakeClock(0);
  const sent: number[] = [];
  const transport = async () => { sent.push(clock.now().getTime()); return { account: {} }; };
  const clients = ['http://pacing.invalid/v2#requests-per-minute=250', 'http://PACING.invalid:80/v2///#requests-per-minute=250'].map(base => new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-pacing', ...(base ? { CLAND_DIGITALOCEAN_API: base } : {}) }, clock, transport));
  const work = Array.from({ length: 300 }, (_, i) => clients[i % 2]!.account());
  await clock.advance(0);
  assert.equal(sent.length, 250);
  await clock.advance(59999);
  assert.equal(sent.length, 250);
  await clock.advance(1);
  await Promise.all(work);
  assert.equal(sent.length, 300);
  for (const start of sent) assert.ok(sent.filter(time => time >= start && time < start + 60000).length <= 250);
});

for (const mode of ['http', 'scripted'] as const) test(`429 carries retry time and fences the shared token without automatic resend (${mode})`, async t => {
  const clock = new FakeClock();
  const token = `cland-test-429-${mode}`;
  const fake = await fakeDigitalOcean(token, { clock, requestsPerMinute: 250, machine: 'scripted', transport: mode });
  t.after(() => fake.close());
  Object.assign(fake.faults, { rateLimits: 1, retryAfter: '2', rateLimitReset: String(clock.now().getTime() / 1000 + 3) });
  const client = mode === 'scripted' ? fake.provider : new DigitalOceanApi({ DIGITALOCEAN_TOKEN: token, CLAND_DIGITALOCEAN_API: fake.url }, clock);
  await assert.rejects(client.account(), error => {
    assert.ok(error instanceof apiTypes.RateLimited);
    assert.equal(error.status, 429);
    assert.equal(error.retryAt, clock.now().getTime() + 3000);
    return true;
  });
  const next = client.account();
  await clock.advance(2999);
  assert.equal(fake.requests.length, 1);
  await clock.advance(1);
  assert.deepEqual(await next, { status: 'active' });
  assert.equal(fake.requests.length, 2, 'only the explicitly requested call is sent');
});


test('queued budget waits respect deadlines and cancellation without sending', async () => {
  const clock = new FakeClock(0);
  let sent = 0;
  const transport = async () => { sent++; return { account: {} }; };
  const env = { DIGITALOCEAN_TOKEN: 'cland-test-deadline' };
  const client = new DigitalOceanApi(env, clock, transport);
  await Promise.all(Array.from({ length: 250 }, () => client.account()));
  const timed = assert.rejects(client.account(100), error => error instanceof apiTypes.DigitalOceanError && error.id === 'deadline');
  const controller = new AbortController();
  const cancelled = new DigitalOceanApi(env, clock, transport, controller.signal).account();
  const aborted = assert.rejects(cancelled, { name: 'AbortError' });
  controller.abort();
  await clock.advance(100);
  await Promise.all([timed, aborted]);
  assert.equal(sent, 250);
  assert.equal(clock.pending, 0);
  await new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-other' }, clock, transport).account();
  assert.equal(sent, 251, 'different token retains its own budget');
});

for (const [headers, offset] of [
  [{ 'Retry-After': '2' }, 2000],
  [{ 'Retry-After': new Date(4000).toUTCString() }, 4000],
  [{ 'ratelimit-reset': '5' }, 5000],
  [{ 'Retry-After': 'bad', 'ratelimit-reset': 'bad' }, undefined],
  [{}, undefined],
] as const) test(`429 header retry time: ${JSON.stringify(headers)}`, () => {
  const refusal = apiTypes.rateLimited(new Headers(headers), 0);
  assert.equal(refusal.retryAt, offset);
  assert.ok(refusal instanceof apiTypes.DigitalOceanError);
});

test('a missing-header 429 preserves provider text and permits the next explicit call', async t => {
  const clock = new FakeClock();
  const token = 'cland-test-429-compatibility';
  const fake = await fakeDigitalOcean(token, { clock, requestsPerMinute: 250, machine: 'scripted', transport: 'http' });
  t.after(() => fake.close());
  fake.faults.create = 429;
  fake.faults.echoToken = true;
  const client = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: token, CLAND_DIGITALOCEAN_API: fake.url }, clock);
  await assert.rejects(client.create({ name: 'fixture', tags: [], size: 'c-8', region: 'lon1', image: 'ubuntu', ssh_keys: [] }), error => {
    assert.ok(error instanceof apiTypes.RateLimited);
    assert.equal(error.retryAt, undefined);
    assert.equal(error.id, 'refused');
    assert.match(error.message, /429 refused/);
    assert.ok(!error.message.includes(token));
    return true;
  });
  assert.deepEqual(await client.account(), { status: 'active' });
  assert.equal(fake.requests.length, 2);
});

test('pacing counts actual sends when the caller blocks before continuations drain', async () => {
  const clock = new FakeClock(0);
  const sent: number[] = [];
  const clients = [0, 1].map(() => new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-blocked-send' }, clock, async () => {
    sent.push(clock.now().getTime()); return { account: {} };
  }));
  const first = Array.from({ length: 250 }, (_, i) => clients[i % 2]!.account());
  clock.block(60000);
  const next = Array.from({ length: 50 }, (_, i) => clients[i % 2]!.account());
  await Promise.all([...first, ...next]);
  for (const start of sent) assert.ok(sent.filter(time => time >= start && time < start + 60000).length <= 250,
    `more than 250 actual sends in minute starting ${start}`);
});

for (const source of ['null', '"refused"', '42', '[]', '{}', '{', '']) test(`429 body ${JSON.stringify(source)} retains the typed refusal and retry header`, async t => {
  const clock = new FakeClock(0);
  t.mock.method(globalThis, 'fetch', async () => new Response(source, { status: 429, headers: { 'Retry-After': '2' } }));
  const client = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-null-429', CLAND_DIGITALOCEAN_API: 'http://fake.invalid/v2' }, clock);
  await assert.rejects(client.account(), error => {
    assert.ok(error instanceof apiTypes.RateLimited);
    assert.equal(error.retryAt, 2000);
    return true;
  });
});

test('429 headers fence a sibling client before held body diagnostics complete', async t => {
  const clock = new FakeClock(0);
  let bodyStarted = false;
  let body!: ReadableStreamDefaultController<Uint8Array>;
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { body = controller; }, pull() { bodyStarted = true; } }, { highWaterMark: 0 });
  t.mock.method(globalThis, 'fetch', async () => {
    sent++;
    return sent === 1 ? new Response(stream, { status: 429, headers: { 'Retry-After': '2' } }) : Response.json({ account: { status: 'active' } });
  });
  const env = { DIGITALOCEAN_TOKEN: 'cland-test-held-429', CLAND_DIGITALOCEAN_API: 'http://fake.invalid/v2' };
  const refused = assert.rejects(new DigitalOceanApi(env, clock).account(), error => {
    assert.ok(error instanceof apiTypes.RateLimited);
    assert.equal(error.retryAt, 2000, 'retry time starts at header receipt');
    return true;
  });
  const observedRefusal = Promise.allSettled([refused]);
  let sibling: Promise<unknown> | undefined;
  try {
    await until(() => bodyStarted, { what: 'client reads the held 429 response body' });
    sibling = new DigitalOceanApi(env, clock).account();
    await clock.advance(1999);
    assert.equal(sent, 1, 'sibling stays fenced while refusal body is held');
    await clock.advance(1);
    assert.deepEqual(await sibling, { status: 'active' });
    assert.equal(sent, 2);
  } finally {
    body.enqueue(new TextEncoder().encode('{"id":"rate_limited","message":"try later"}'));
    body.close();
    await clock.advance(2000);
    await observedRefusal;
    if (sibling) await Promise.allSettled([sibling]);
  }
  await refused;
});

test('independent API authorities do not inherit traffic from the same opaque token', async () => {
  const clock = new FakeClock(0);
  const sends = { first: 0, second: 0 };
  const first = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-independent-apis', CLAND_DIGITALOCEAN_API: 'http://first-fake.invalid/v2' }, clock, async () => { sends.first++; return { account: {} }; });
  const second = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-independent-apis', CLAND_DIGITALOCEAN_API: 'http://second-fake.invalid/v2' }, clock, async () => { sends.second++; return { account: {} }; });
  await Promise.all(Array.from({ length: 250 }, () => first.account()));
  const outcome = second.account(15000).then(() => 'sent', error => error.id);
  await clock.advance(15000);
  assert.equal(await outcome, 'sent');
  assert.deepEqual(sends, { first: 250, second: 1 });
});

test('the fake endpoint declares a higher budget for its scripted transport', async () => {
  const clock = new FakeClock(0);
  const fake = await fakeDigitalOcean('cland-test-declared-budget', { machine: 'scripted', clock, requestsPerMinute: 100000 });
  const work = Array.from({ length: 300 }, () => fake.provider.account());
  try {
    await clock.advance(0);
    assert.equal(fake.requests.length, 300);
    await Promise.all(work);
  } finally {
    await clock.advance(60000);
    await Promise.allSettled(work);
    await fake.close();
  }
});

test('an under-budget call invokes transport without a clock-scheduled hop', async () => {
  const clock = new FakeClock(0);
  let calls = 0;
  const client = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-immediate-send' }, clock, async () => { calls++; return { account: { status: 'active' } }; });
  const work = client.account();
  assert.equal(calls, 1);
  assert.equal(clock.pending, 0);
  assert.deepEqual(await work, { status: 'active' });
});

test('the real DigitalOcean endpoint ignores a high-rate fragment and still paces at 250', async t => {
  const clock = new FakeClock(0);
  const urls: string[] = [];
  const logs: unknown[][] = [];
  for (const method of ['log', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { logs.push(args); });
  t.mock.method(globalThis, 'fetch', async (url: URL) => { urls.push(url.href); return Response.json({ account: { status: 'active' } }); });
  const client = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: 'cland-test-real-cap', CLAND_DIGITALOCEAN_API: 'https://api.digitalocean.com/v2#requests-per-minute=100000' }, clock);
  const work = Array.from({ length: 300 }, () => client.account());
  const settled = Promise.allSettled(work);
  try {
    await clock.advance(0);
    assert.equal(urls.length, 250);
    await clock.advance(59999);
    assert.equal(urls.length, 250);
    await clock.advance(1);
    const outcomes = await settled;
    assert.ok(outcomes.every(result => result.status === 'fulfilled'));
    assert.equal(urls.length, 300);
    assert.ok(urls.every(url => url === 'https://api.digitalocean.com/v2/account'));
    assert.ok(!JSON.stringify(logs).includes('requests-per-minute'));
  } finally { await clock.advance(60000); await settled; }
});

test('aborted scoped droplet GET joins the fake request before returning',async t=>{
 const clock=new FakeClock(),fake=await fakeDigitalOcean('cland-test-abort-get',{machine:'scripted',clock});
 const abort=new AbortController();let request:Promise<void>|undefined;
 t.after(async()=>{abort.abort();try{await request;}finally{await fake.close();}});
 fake.faults.getDelayMs=300000;fake.faults.getDelayPath='/droplets/999';
 let outcome='pending';
 request=fake.provider.droplet(999,clock.now().getTime()+300000,abort.signal).then(()=>{outcome='resolved';},error=>{outcome=error.name;});
 await until(()=>fake.requests.some(r=>r.method==='GET'&&r.path==='/v2/droplets/999'),{what:'GET entered'});
 abort.abort();await request;assert.equal(outcome,'AbortError');
 await fake.close(); // close drains the cancelled request; no clock advance is needed.
});
