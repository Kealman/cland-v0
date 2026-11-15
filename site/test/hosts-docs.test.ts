// T1: source-only public docs contracts; no runtime/native imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOST_USAGE, LOGIN_USAGE, CONFIG_USAGE, ROLE_USAGE, HUB_USAGE, SETUP_USAGE, DOCTOR_USAGE } from '../../hub/src/cli/usage.ts';
import { commands, hostsPath, source, poolSteps } from './hosts-docs-source.ts';
import { readHostPools } from '../../hub/src/host/pools.ts';
import { DEFAULT_HOST_WEIGHTS } from '../../hub/src/host/scheduler.ts';

const help = [HOST_USAGE, LOGIN_USAGE, CONFIG_USAGE, ROLE_USAGE, HUB_USAGE, SETUP_USAGE, DOCTOR_USAGE].join('\n');
export function vocabularyErrors(page: string): string[] {
  const errors: string[] = [];
  for (const command of commands(page)) {
    const words = command.slice(6).split(/\s+/);
    const prefix = words.slice(0, 2).join(' ');
    const line = help.split('\n').find(line => line.trimStart().startsWith(prefix + ' ') || line.trim() === prefix);
    if (!line) errors.push(`command: ${prefix}`);
    for (const flag of words.filter(word => word.startsWith('--'))) {
      const usage = [HOST_USAGE, LOGIN_USAGE, CONFIG_USAGE, ROLE_USAGE, HUB_USAGE, SETUP_USAGE, DOCTOR_USAGE].find(text => text.includes(`  ${words[0]} `)) ?? '';
      if (![...usage.matchAll(/--[a-z][a-z-]*/g)].some(match => match[0] === flag)) errors.push(`flag: ${flag}`);
    }
  }
  const pools = source('hub/src/host/pools.ts');
  const poolKeys = /POOL_KEYS = \[([^\]]+)/.exec(pools)![1]!;
  const globalKeys = /GLOBAL_KEYS = \[([^\]]+)/.exec(pools)![1]!;
  for (const key of page.matchAll(/\b(hosts\.(?:<pool>|[a-z_-]+)(?:\.[a-z_]+)?)/g)) {
    const parts = key[1]!.split('.');
    if (key[1] === 'hosts.<pool>') continue; // A table heading, rather than a setting.
    if (!(parts.length === 2 ? globalKeys : poolKeys).includes(`'${parts.at(-1)}'`)) errors.push(`config: ${key[1]}`);
  }
  return errors;
}

test('hosts vocabulary guard rejects invented command, flag and setting', () => {
  assert.deepEqual(vocabularyErrors('`cland host invent` `cland host status --invented` `hosts.agents.invented`'), ['command: host invent', 'flag: --invented', 'config: hosts.agents.invented']);
  assert.deepEqual(vocabularyErrors('cland config set hosts.second.invented true\n`cland host status --j`'), ['flag: --j', 'config: hosts.second.invented']);
});

test('hosts guide is linked under Features and covers the built host and login workflow', () => {
  const page = source(hostsPath);
  assert.match(source('site/astro.config.mjs'), /group\('Features',[\s\S]*?\['Hosts, pools and logins', 'docs\/hosts'\]/);
  assert.match(source('site/src/content/docs/docs/features.md'), /\]\(\/docs\/hosts\/\)/);
  for (const heading of ['Configuration', 'Role placement', 'Commands', 'Lifecycle and failures', 'Money', 'Logins', 'Workbench, doctor and setup']) assert.ok(page.includes(`## ${heading}`), heading);
  for (const fact of ['Claude Code', 'OpenCode', 'Codex', "human’s Mac", 'one place', '1.3 GB', '80%', '3 minutes', '15 minutes']) assert.ok(page.includes(fact), fact);
  assert.deepEqual(vocabularyErrors(page), []);
  assert.ok(poolSteps(page).length >= 5);
});

test('hosts guide quotes emitted waiting reasons and doctor/setup rows', () => {
  const page = source(hostsPath);
  const scheduler = source('hub/src/host/scheduler.ts');
  for (const reason of ['waiting for a host', 'waiting for a login ${input.harness}', 'waiting for host ${booting.id} to boot']) {
    assert.ok(scheduler.includes(reason));
    assert.ok(page.includes(reason.replace('${input.harness}', '<harness>').replace('${booting.id}', '<id>')));
  }
  const doctor = source('hub/src/doctor/hosts.ts');
  for (const label of ['host spend', 'host ${pool} image', 'host ${provider} token', 'host login ${login.name}', 'host ${pool.name} ${harness} logins', 'host ${host.id} reachability']) {
    assert.ok(doctor.includes(label));
    assert.ok(page.includes(label.replace(/\$\{[^}]+\}/g, '<name>')), label);
  }
  for (const row of ['agent hosts', 'agent hosts image', 'optional agent hosts; default No', 'agent hosts need role placement']) {
    assert.ok(source('hub/src/setup/steps/hosts.ts').includes(row));
    assert.ok(page.includes(row));
  }
});

test('hosts guide defaults match the shared pool parser and slot policy', () => {
  const page = source(hostsPath);
  const config = readHostPools({ agents: { provider: 'digitalocean' }, second: { provider: 'digitalocean' } });
  const pool = config.pools.second!;
  for (const [key, value] of Object.entries({ size: pool.size, region: pool.region, transport: pool.transport, idle_stop: pool.idleStop })) {
    assert.ok(page.includes(`\`hosts.<pool>.${key}\` | \`${value}\``), key);
  }
  assert.ok(page.includes(`\`hosts.lease\` | \`${config.lease}\``));
  assert.ok(page.includes(`\`hosts.daily_spend_usd\` | ${config.dailySpendUsd};`));
  assert.ok(page.includes(`\`hosts.<pool>.slots\` | ${pool.slots} for`));
  assert.ok(page.includes(`\`hosts.<pool>.min_hosts\` | ${config.pools.agents!.minHosts} for \`agents\`, ${pool.minHosts} for other pools`));
  assert.ok(page.includes(`\`hosts.<pool>.max_hosts\` | ${pool.maxHosts};`));
  assert.ok(page.includes(`\`hosts.<pool>.spread\` | \`${pool.spread}\``));
  assert.ok(page.includes(`\`hosts.relaunch_after_signin\` | \`${config.relaunchAfterSignIn}\``));
  assert.ok(page.includes(`Claude Code uses ${DEFAULT_HOST_WEIGHTS['claude-code']}, Codex ${DEFAULT_HOST_WEIGHTS.codex} and OpenCode ${DEFAULT_HOST_WEIGHTS.opencode}`));
});
