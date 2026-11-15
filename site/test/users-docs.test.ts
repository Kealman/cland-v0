// T1: declarations as text, no native imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTH_USAGE, USER_USAGE, HUB_USAGE, SETUP_USAGE, DOCTOR_USAGE, TOPIC_USAGE } from '../../hub/src/cli/usage.ts';
import { commands, source, usersPath, usersSection, inviteSteps } from './users-docs-source.ts';
import { scanCapture } from '../scripts/capture-safety.ts';

const usages = [AUTH_USAGE, USER_USAGE, HUB_USAGE, SETUP_USAGE, DOCTOR_USAGE, TOPIC_USAGE];
export function vocabularyErrors(text: string): string[] {
  const errors: string[] = [];
  for (const command of commands(text)) {
    const words = command.slice(6).split(/\s+/);
    const usage = usages.find(value => value.startsWith(`  ${words[0]} `)) ?? '';
    const prefix = words.slice(0, words[0] === 'auth' && words[1] === 'mode' ? 3 : ['setup', 'doctor'].includes(words[0]!) ? 1 : 2).join(' ');
    if (!usage.split('\n').some(line => line.trim().startsWith(prefix + ' ') || line.trim() === prefix)) errors.push(`command: ${prefix}`);
    for (const flag of words.filter(word => word.startsWith('--'))) if (!usage.includes(flag)) errors.push(`flag: ${flag}`);
  }
  for (const key of text.matchAll(/\bauth\.[a-z_]+/g)) {
    if (key[0] !== 'auth.mode' || !source('hub/src/init/config.ts').includes("auth.mode !== 'single'")) errors.push(`config: ${key[0]}`);
  }
  return errors;
}

test('users guide is discoverable and covers the built sign-in workflow', () => {
  const page = source(usersPath);
  assert.match(source('site/astro.config.mjs'), /group\('Features',[\s\S]*?\['Users and sign-in modes', 'docs\/users'\]/);
  assert.match(source('site/src/content/docs/docs/features.md'), /\]\(\/docs\/users\/\)/);
  for (const heading of ['The two modes', 'Switching and reset', 'Users and invites', 'Passkeys and passwords', 'Attribution with --as', 'Remotes in users mode', 'Setup and doctor', 'Deferred']) assert.ok(page.includes(`## ${heading}`), heading);
  assert.deepEqual(vocabularyErrors(page), []);
  assert.deepEqual(inviteSteps(page), ['cland auth mode users', 'cland user add teammate', 'cland user list', 'cland user invite teammate']);
  assert.throws(() => scanCapture('/invite?' + 'token=' + 'a'.repeat(64), 'unused-control'));
  scanCapture(page, 'unused-control');
});

test('users vocabulary rejects invented commands flags and settings', () => {
  assert.deepEqual(vocabularyErrors('`cland user erase` `cland user list --invented` `auth.invented`'), ['command: user erase', 'flag: --invented', 'config: auth.invented']);
  assert.deepEqual(vocabularyErrors('`cland auth mode single`'), ['command: auth mode single']);
});

test('web multi-user section names built controls and shared attribution', () => {
  const section = usersSection(source('site/src/content/docs/docs/web-and-phone.mdx'));
  assert.ok(section.length > 0);
  assert.deepEqual(vocabularyErrors(section), []);
  const component = source('web/src/accounts/Users.tsx');
  for (const label of ['Users', 'Name', 'Display name', 'Role', 'State', 'Create user', 'Invite link', 'Copy invite', 'Dismiss invite']) {
    assert.ok(component.includes(label), label);
    assert.ok(section.includes(`**${label}**`), label);
  }
  for (const fact of ['passkey', 'password', 'one inbox', 'who wrote', 'approvals', '/docs/users/']) assert.ok(section.includes(fact), fact);
  for (const label of ['Create passkey', 'Set password', 'Use passkey', 'Password', 'Sign in']) {
    assert.ok(source('web/src/SignIn.tsx').includes(`'${label}'`), label);
    assert.ok(section.includes(`**${label}**`), label);
  }
});

test('CLI Users and sign-in lists exactly the built usage subcommands', () => {
  const section = /^## Users and sign-in\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(source('site/src/content/docs/docs/cli.md'))?.[1] ?? '';
  const expected = [...(USER_USAGE + AUTH_USAGE).matchAll(/^  ((?:user|auth) [a-z-]+)\b/gm)].map(match => match[1]!).sort();
  const inventory = (text: string) => [...text.matchAll(/`cland ((?:user|auth) [a-z-]+)\b/g)].map(match => match[1]!).sort();
  assert.equal(expected.length, 5);
  assert.deepEqual(inventory(section), expected);
  assert.notDeepEqual(inventory(section + '`cland user invented`'), expected);
  assert.notDeepEqual(inventory(section + '`cland user list`'), expected);
});

test('users guide describes setup and doctor from their source declarations', () => {
  const page = source(usersPath);
  for (const path of ['hub/src/setup/steps/signin.ts', 'hub/src/doctor/users.ts']) {
    const declaration = source(path);
    for (const label of ['sign-in mode', 'cland user invite', 'cland auth mode users'].filter(label => declaration.includes(label))) assert.ok(page.includes(label), label);
  }
  for (const fact of ['skip', 'open', 'ok', '--yes', 'hub not running', 'cland hub reload', 'cland hub start']) assert.ok(page.includes(fact), fact);
});

test('offline setup rows and unreadable-config fallback match the signin declaration', () => {
  const page = source(usersPath);
  const declaration = source('hub/src/setup/steps/signin.ts');
  for (const detail of ['single mode', 'users mode; hub not running', 'single mode default; detect when the hub is available', 'choose the web sign-in mode']) {
    assert.ok(declaration.includes(`'${detail}'`), detail);
    assert.ok(page.includes(`\`${detail}\``), detail);
  }
  assert.match(declaration, /o\.yes \|\| o\.noAide/);
  assert.match(page, /--yes` or `--no-aide/);
  assert.match(page, /project config[\s\S]*?`skip`[\s\S]*?`cland auth mode users`[\s\S]*?`open`[\s\S]*?`cland hub start`/);
});

test('CLI identity examples match the auth parser contract', () => {
  const cli = source('site/src/content/docs/docs/cli.md');
  const parser = source('hub/src/cli/auth.ts');
  assert.ok(parser.includes("args[2] === '--display'"));
  assert.ok(cli.includes('cland user add <name> [--display <name>]'));
  assert.ok(parser.includes('${result.user.name}  ${result.user.role}  ${result.user.state}'));
  assert.match(source(usersPath), /Add and invite print name, role and state/);
  assert.ok(parser.includes("args.includes('--help')"));
  assert.match(cli, /`auth` and `user` also accept `--help`/);
});
