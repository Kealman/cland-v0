// Web: real WebAuthn ceremonies through CDP in isolated Headless Shell; no GUI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture } from './harness.ts';

test('passkey invite registration and fresh-context sign-in consume the invite and persist only public credential facts', async t => {
  const clock = new FakeClock(Date.now());
  const logs: unknown[] = [];
  const fixture = await webFixture(t, { clock, log: e => logs.push(e), prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Passkeys'); config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  await askHubFrame(fixture.hub.discovery, { type: 'auth.mode', mode: 'users' }, 3000, {});
  const listed = await askHubFrame(fixture.hub.discovery, { type: 'user.list' }, 3000, {}) as { users: Array<{ name: string }> };
  const firstName = listed.users[0]!.name;
  const created = await askHubFrame(fixture.hub.discovery, { type: 'user.add', name: 'alex', displayName: 'Alex Smith' }, 3000, {}) as { url: string };
  await fixture.pageCase(t, async (page, fixtureOrigin) => {
    const origin = fixtureOrigin.replace('127.0.0.1', 'localhost');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const frames: string[] = [];
    page.on('websocket', ws => ws.on('framesent', event => frames.push(String(event.payload))));
    const bodies: string[] = [];
    const responseSentinels: string[] = [];
    page.on('request', req => { if (req.url().includes('/passkey/finish')) bodies.push(req.postData()!); });
    await page.goto(created.url);
    await page.getByRole('heading', { name: 'Alex Smith' }).waitFor();
    assert.equal(new URL(page.url()).hostname, 'localhost');
    const redirect = await page.request.get(created.url, { maxRedirects: 0 });
    assert.equal(redirect.status(), 302);
    assert.equal(redirect.headers()['location'], created.url.replace('127.0.0.1', 'localhost'));
    assert.equal(redirect.headers()['referrer-policy'], 'no-referrer');
    assert.equal(redirect.headers()['cache-control'], 'no-store');
    // A native client resolving localhost and the actual browser both reach the IPv4 edge.
    const reached = await fetch(origin + '/signin/status', { signal: AbortSignal.timeout(3000) });
    assert.equal(reached.status, 200);
    for (const [target, wrong] of [[origin, fixtureOrigin], [fixtureOrigin, origin]]) {
      const foreign = await page.request.post(target + '/invite/passkey/options', { headers: { Origin: wrong! }, data: { token: new URL(created.url).searchParams.get('token') } });
      assert.equal(foreign.status(), 403); assert.equal(foreign.headers()['set-cookie'], undefined);
    }
    await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.getByRole('region', { name: 'Profile', exact: true }).getByText('Alex Smith', { exact: true }).waitFor();
    const reusedRegistration = await page.request.post(origin + '/invite/passkey/finish', { headers: { Origin: origin }, data: JSON.parse(bodies[0]!) });
    assert.equal(reusedRegistration.status(), 400); assert.equal(reusedRegistration.headers()['set-cookie'], undefined);
    assert.equal((await page.request.get(created.url.replace('127.0.0.1', 'localhost'))).status(), 400);
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    assert.equal(credentials.length, 1);
    const fresh = await fixture.browser.newContext();
    try {
      const login = await fresh.newPage();
      await fixture.syncPageClock(login);
      const assertions: string[] = [];
      login.on('request', req => { if (req.url().endsWith('/signin/passkey/finish')) assertions.push(req.postData()!); });
      const second = await fresh.newCDPSession(login);
      await second.send('WebAuthn.enable');
      const added = await second.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
      await second.send('WebAuthn.addCredential', { authenticatorId: added.authenticatorId, credential: credentials[0]! });
      await login.goto(origin + '/signin');
      await login.getByLabel('Name', { exact: true }).fill('alex');
      await login.getByRole('button', { name: 'Use passkey', exact: true }).click();
      await login.getByRole('button', { name: 'Accounts', exact: true }).click();
      await login.getByRole('region', { name: 'Profile', exact: true }).getByText('Alex Smith', { exact: true }).waitFor();
      assert.equal(assertions.length, 1);
      await fresh.clearCookies();
      const post = (path: string, data: unknown) => fresh.request.post(origin + path, { headers: { Origin: origin }, data });
      const refused = async (data: unknown) => {
        const result = await post('/signin/passkey/finish', data);
        assert.equal(result.status(), 400); assert.equal(result.headers()['set-cookie'], undefined);
      };
      const previous = JSON.parse(assertions[0]!);
      await refused(previous); // Exact replay, with the original spent challenge.
      const next = await (await post('/signin/passkey/options', { name: 'alex' })).json();
      await refused({ ...previous, challenge: next.challenge }); // Old signed client-data on a fresh challenge.
      await refused({ ...previous, challenge: next.challenge }); // A failed attempt spends it too.
      const admin = await (await post('/signin/passkey/options', { name: firstName })).json();
      assert.ok(admin.challenge);
      await login.goto(origin + '/signin');
      const expired = await (await post('/signin/passkey/options', { name: 'alex' })).json();
      const sign = async (options: typeof expired) => login.evaluate(async options => {
        const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const encode = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const credential = await navigator.credentials.get({ publicKey: { ...options, challenge: decode(options.challenge), allowCredentials: options.allowCredentials.map((r: { id: string; type: 'public-key' }) => ({ ...r, id: decode(r.id) })) } }) as PublicKeyCredential;
        const response = credential.response as AuthenticatorAssertionResponse;
        return { credentialId: encode(credential.rawId), clientDataJSON: encode(response.clientDataJSON), authenticatorData: encode(response.authenticatorData), signature: encode(response.signature) };
      }, options);
      const foreign = await sign({ ...admin, allowCredentials: expired.allowCredentials });
      await refused({ challenge: admin.challenge, response: foreign });
      const signed = await sign(expired);
      responseSentinels.push(...Object.values(previous.response) as string[], ...Object.values(signed));
      await clock.advance(120_000);
      await refused({ challenge: expired.challenge, response: signed });
      await fixture.releasePageClocks([login]);

    } finally { await fresh.close(); }
    const db = new DatabaseSync(join(fixture.root, '.cland/hub.db'));
    try {
      assert.deepEqual(db.prepare('pragma table_info(passkeys)').all().map(r => r.name), ['user_id', 'credential_id', 'public_key', 'counter']);
      const rows = db.prepare('select * from passkeys').all(); assert.equal(rows.length, 1);
      assert.match(String(rows[0]!.public_key), /^-----BEGIN PUBLIC KEY-----/);
      assert.ok(Number(rows[0]!.counter) > 0);
    } finally { db.close(); }
    assert.equal(bodies.length, 1);
    const response = JSON.parse(bodies[0]!).response;
    const journal = await askHubFrame(fixture.hub.discovery, { type: 'events.list' }, 3000, {});
    const database = await readFile(join(fixture.root, '.cland/hub.db'));
    for (const secret of [response.clientDataJSON, response.attestationObject, ...responseSentinels.filter(value => value.length > 100)]) {
      assert.ok(secret.length > 20);
      assert.equal(JSON.stringify([logs, journal, frames]).includes(secret), false);
      assert.equal(database.includes(Buffer.from(secret)), false);
    }
  });
});

test('WebAuthn unavailable leaves only password registration and explains it in a tooltip', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Passkeys'); config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  await askHubFrame(fixture.hub.discovery, { type: 'auth.mode', mode: 'users' }, 3000, {});
  const created = await askHubFrame(fixture.hub.discovery, { type: 'user.add', name: 'alex', displayName: 'Alex Smith' }, 3000, {}) as { url: string };
  await fixture.pageCase(t, async page => {
    await page.addInitScript(() => { Object.defineProperty(window, 'PublicKeyCredential', { value: undefined }); });
    await page.goto(created.url);
    await page.getByRole('heading', { name: 'Alex Smith' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Create passkey' }).count(), 0);
    assert.match(await page.locator('label[for="password"]').getAttribute('title') ?? '', /Passkeys are unavailable/);
    await page.getByLabel('Set password').fill('fallback private password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.getByRole('region', { name: 'Profile', exact: true }).getByText('Alex Smith', { exact: true }).waitFor();
  });
});
