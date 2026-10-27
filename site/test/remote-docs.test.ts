// T1: published source is checked against the shipped help and config/secret vocabulary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG_USAGE, HUB_USAGE, REMOTE_USAGE, SECRET_USAGE, SETUP_USAGE, DOCTOR_USAGE } from '../../hub/src/cli/usage.ts';
import { commands, guidePath, phonePath, remoteSection, source } from './remote-docs-source.ts';

// Pages installs only site dependencies. Read the authoritative declarations
// without importing the hub's runtime dependency graph into its prebuild test.
export const configNames: string[] = [];
let section = '';
for (const line of source('hub/src/init/config.ts').split('\n')) {
  const heading = /^\[([\w.]+)\]$/.exec(line);
  if (heading) section = heading[1]!;
  const key = /^(\w+) =/.exec(line);
  if (key && section.startsWith('remote')) configNames.push(`${section}.${key[1]}`);
}
export const secretNames = [...source('hub/src/remote/secrets.ts')
  .match(/export const SECRET_NAMES = \[([^\]]+)\]/)![1]!.matchAll(/'([^']+)'/g)].map(match => match[1]!);

const help = [CONFIG_USAGE, HUB_USAGE, REMOTE_USAGE, SECRET_USAGE, SETUP_USAGE, DOCTOR_USAGE].join('\n');
const signatures = [...help.matchAll(/^ {2}(\S.*?)(?= {2,}|$)/gm)].map(match => {
  const tokens = match[1]!.match(/<[^>]+>|\[[^\]]+\]|\S+/g)!;
  const firstArgument = tokens.findIndex(word => word.startsWith('<') || word.startsWith('['));
  if (firstArgument < 0) return tokens;
  let end = firstArgument;
  while (tokens[end]?.startsWith('<')) end++;
  return tokens.slice(0, end);
});

function vocabularyErrors(text: string): string[] {
  const errors: string[] = [];
  for (const command of commands(text)) {
    const words = command.slice('cland '.length).split(/\s+/);
    if (!signatures.some(signature => signature.length === words.length && signature.every((word, i) => {
      if (!word.startsWith('<')) return word === words[i];
      return !word.includes('|') || word.slice(1, -1).split('|').includes(words[i]!);
    }))) errors.push(`command: ${command}`);
  }
  for (const match of text.matchAll(/\bremote\.[a-z][\w.]*/g)) {
    if (!configNames.includes(match[0])) errors.push(`config: ${match[0]}`);
  }
  for (const match of text.matchAll(/(?<![\w.])(?:telegram|discord)\.[a-z_]+|\bspeech\.(?:[a-z_]+_key)/g)) {
    if (!secretNames.includes(match[0])) errors.push(`secret: ${match[0]}`);
  }
  return errors;
}

test('remote documentation guard rejects unknown commands, config keys and secret names', () => {
  assert.ok(configNames.length >= 4);
  assert.deepEqual(secretNames, /names: ([^\n]+)/.exec(SECRET_USAGE)![1]!.split(', '));
  assert.deepEqual(vocabularyErrors('`cland remote pair telegram CODE` `remote.telegram.enable` `telegram.key`'),
    ['command: cland remote pair telegram CODE', 'config: remote.telegram.enable', 'secret: telegram.key']);
  assert.deepEqual(vocabularyErrors('`cland secret set telegram.token` `cland config set remote.telegram.enabled true`'), []);
});

test('remote guide and web Remotes section use shipped commands, config keys and secret names', () => {
  const guide = source(guidePath);
  const phone = remoteSection(source(phonePath));
  assert.ok(commands(guide).length >= 10, 'guide covers the terminal commands');
  assert.deepEqual(vocabularyErrors(guide), []);
  assert.deepEqual(vocabularyErrors(phone), []);
});

test('Remote control is under Features and linked from the overview and web Remotes section', () => {
  const sidebar = source('site/astro.config.mjs');
  const features = /group\('Features', \[([\s\S]*?)\]\)/.exec(sidebar)?.[1] ?? '';
  assert.match(features, /\['Remote control', 'docs\/remote-control'\]/);
  assert.match(source('site/src/content/docs/docs/features.md'), /\]\(\/docs\/remote-control\/\)/);
  const remotes = remoteSection(source(phonePath));
  assert.match(remotes, /\]\(\/docs\/remote-control\/\)/);
  assert.match(remotes, /approve in the terminal or Neovim/);
});

test('CLI reference lists exactly the remote and secret subcommands in usage', () => {
  const reference = commands(source('site/src/content/docs/docs/cli.md'));
  for (const [group, usage] of [['remote', REMOTE_USAGE], ['secret', SECRET_USAGE]] as const) {
    const expected = [...usage.matchAll(new RegExp(`^ {2}${group} (\\w+)`, 'gm'))].map(match => match[1]!);
    const actual = reference.filter(command => command.startsWith(`cland ${group} `)).map(command => command.split(' ')[2]!);
    assert.deepEqual(actual.sort(), expected.sort(), `${group} subcommands match help, without omissions or extras`);
  }
});
