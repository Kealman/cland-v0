// T2: injected provider transport and clock; fake loopback HTTP and scripted transport; no child processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalOceanApi } from '../src/executor/droplet/api.ts';
import { FakeClock } from './fake-clock.ts';
import * as apiTypes from '../src/executor/droplet/api.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { until } from './until.ts';

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
