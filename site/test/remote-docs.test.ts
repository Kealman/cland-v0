// T1: published source is checked against the shipped help and config/secret vocabulary.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
  if (key && (section.startsWith('remote') || section === 'speech' || section === 'artifacts')) configNames.push(`${section}.${key[1]}`);
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
    const tokens = command.slice('cland '.length).split(/\s+/).map(word => word.replace(/^\[|\]$/g, ''));
    const usage = [CONFIG_USAGE, HUB_USAGE, REMOTE_USAGE, SECRET_USAGE, SETUP_USAGE, DOCTOR_USAGE]
      .find(value => value.startsWith(`  ${tokens[0]} `)) ?? '';
    const flags = tokens.filter(word => word.startsWith('--'));
    for (const flag of flags) if (![...usage.matchAll(/--[a-z][a-z-]*/g)].some(match => match[0] === flag)) errors.push(`flag: ${flag}`);
    const words = tokens.filter(word => !word.startsWith('--'));
    if (!signatures.some(signature => signature.length === words.length && signature.every((word, i) => {
      if (!word.startsWith('<')) return word === words[i];
      return !word.includes('|') || word.slice(1, -1).split('|').includes(words[i]!);
    }))) errors.push(`command: ${command}`);
  }
  for (const match of text.matchAll(/\b(?:remote|speech|artifacts)\.[a-z][\w.]*/g)) {
    if (!secretNames.includes(match[0]) && !configNames.includes(match[0])) errors.push(`config: ${match[0]}`);
  }
  for (const match of text.matchAll(/(?<![\w./])(?:telegram|discord)\.[a-z_]+|\bspeech\.(?:[a-z_]+_key)/g)) {
    if (!secretNames.includes(match[0])) errors.push(`secret: ${match[0]}`);
  }
  return errors;
}

test('remote documentation guard rejects unknown commands, config keys and secret names', () => {
  assert.ok(configNames.length >= 4);
  assert.deepEqual(secretNames, /names: ([^\n]+)/.exec(SECRET_USAGE)![1]!.split(', '));
  assert.deepEqual(vocabularyErrors('`cland remote pair telegram CODE` `remote.telegram.enable` `telegram.key`'),
    ['command: cland remote pair telegram CODE', 'config: remote.telegram.enable', 'secret: telegram.key']);
  assert.deepEqual(vocabularyErrors('`speech.engine` `artifacts.max_upload_bytes`'),
    ['config: speech.engine', 'config: artifacts.max_upload_bytes']);
  assert.deepEqual(vocabularyErrors('`cland secret set telegram.token` `cland config set remote.telegram.enabled true` https://discord.com/developers/applications'), []);
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

test('remote guide distinguishes missed cards from outage replacements after 150 seconds', () => {
  const guide = source(guidePath);
  const catchup = guide.split('## Mute, outages and catch-up')[1]!.split('## Status and maintenance')[0]!;
  assert.match(catchup, /After the gap line, missed open cards and pending outcome edits are delivered/);
  assert.match(catchup, /outage lasts longer than 150 seconds, every open card is re-sent at the bottom/);
  assert.match(catchup, /a button pressed then may have been lost; press again/);
  assert.match(catchup, /old copy shows \*\*↓ Re-sent below\*\* without buttons/);
  assert.match(catchup, /Outages of 150 seconds or less do not re-send cards already delivered/);
});

test('CLI reference lists exactly the remote and secret subcommands in usage', () => {
  const reference = commands(source('site/src/content/docs/docs/cli.md'));
  for (const [group, usage] of [['remote', REMOTE_USAGE], ['secret', SECRET_USAGE]] as const) {
    const expected = [...usage.matchAll(new RegExp(`^ {2}${group} (\\w+)`, 'gm'))].map(match => match[1]!);
    const actual = reference.filter(command => command.startsWith(`cland ${group} `)).map(command => command.split(' ')[2]!);
    assert.deepEqual(actual.sort(), expected.sort(), `${group} subcommands match help, without omissions or extras`);
  }
});

test('remote media guide documents shipped speech and upload settings and exact data-use lines', () => {
  const guide = source(guidePath);
  assert.match(guide, /^## Photos, files and voice$/m);
  for (const name of ['artifacts.max_upload_mb', 'speech.provider', 'speech.model', 'speech.language', 'speech.max_seconds', 'speech.command']) {
    assert.ok(configNames.includes(name), `${name} exists in generated config`);
    assert.ok(guide.includes(name), `${name} is documented`);
  }
  for (const name of ['CLAND_SPEECH_MIME', 'CLAND_SPEECH_LANGUAGE']) {
    assert.ok(source('hub/src/speech/command.ts').includes(`${name}:`), `${name} is supplied to the command`);
    assert.ok(guide.includes(name), `${name} is documented`);
  }
  const dataUse = source('hub/src/speech/provider.ts').split('export const SPEECH_DATA_USE = {')[1]!.split('} as const;')[0]!;
  const lines = [...dataUse.matchAll(/: '([^'\n]+)'/g)].map(match => match[1]!);
  assert.equal(lines.length, 3);
  for (const line of lines) assert.ok(guide.includes(line), `exact data-use line: ${line}`);
  assert.match(guide, /provider = ""/);
  assert.match(guide, /🎤 not transcribed/);
});

test('web guide names composer file attachments and inline image formats', () => {
  const phone = source(phonePath);
  assert.match(phone, /composer[\s\S]*?file attachments/);
  assert.match(phone, /Attach a file/);
  assert.match(phone, /inline[\s\S]*?PNG, JPEG, GIF and WebP/);
  assert.ok(phone.includes('artifacts.max_upload_mb'));
  assert.deepEqual(vocabularyErrors(phone.split('## Threads and asks')[1]!.split('## On your phone')[0]!), []);
});

test('remote guide explains the setup speech offer and nonterminal command', () => {
  const setup = source(guidePath).split('### Through setup')[1]!.split('### By hand')[0]!;
  assert.match(setup, /cland secret set speech.elevenlabs_key/);
  assert.match(setup, /ElevenLabs/);
  assert.match(setup, /hidden/);
});

test('doctor guide names Discord fatal codes and local-only recovery instructions', () => {
  const guide = source(guidePath);
  assert.match(guide, /4004.*new token.*cland secret set discord.token/);
  assert.match(guide, /4014.*Message Content/);
  assert.match(guide, /Doctor makes no (?:Telegram or Discord|platform) request/);
});

test('Discord setup guide names application checks, invite permissions and local pairing commands', () => {
  const guide = source(guidePath);
  for (const text of ['Install Link', 'None', 'Public Bot', 'Message Content', 'Interactions Endpoint URL', 'permissions=117824', '/cland pair', 'cland secret set discord.token', 'cland config set remote.discord.enabled true', 'cland remote approve discord <code>']) assert.ok(guide.includes(text), `guide includes ${text}`);
});

test('both public remote pages describe Discord media, voice and local diagnostics', () => {
  const guide = source(guidePath);
  const phone = remoteSection(source(phonePath));
  for (const page of [guide, phone]) {
    for (const fact of ['Telegram', 'Discord', 'voice', 'attachments', 'cland setup', 'cland doctor', 'cland remote approve discord <code>']) {
      assert.ok(page.includes(fact), `remote page covers ${fact}`);
    }
  }
  const media = guide.split('## Photos, files and voice')[1]!.split('## Mute, outages and catch-up')[0]!;
  assert.match(media, /Discord[\s\S]*20 MiB[\s\S]*ten files[\s\S]*25 MiB/);
  assert.match(media, /you \(Telegram\)/);
  assert.match(media, /you \(Discord\)/);
  assert.match(media, /Discord voice/);
  const recovery = guide.split('## Mute, outages and catch-up')[1]!.split('## Status and maintenance')[0]!;
  assert.match(recovery, /Discord[\s\S]*500[\s\S]*oldest first/);
  assert.match(recovery, /replayed button presses never answer/);
  assert.match(guide, /CLAND_DISCORD_TOKEN/);
  for (const action of ['test', 'unpair']) assert.ok(commands(guide).includes(`cland remote ${action} discord`));
});

test('README remote commands describe the built-in Discord client and both setup offers', () => {
  const readme = source('hub/README.md');
  const remote = readme.split('## Remote commands')[1]!.split('### Remote state in the workbenches')[0]!;
  assert.doesNotMatch(remote, /Discord's\s+callbacks require an injected platform client/);
  assert.match(remote, /built-in Discord/);
  const config = readme.split('The default platform factory')[1]!.split('A changed remote/speech')[0]!;
  assert.doesNotMatch(config, /Discord[\s\S]*requires an injected factory/);
  const setup = readme.split('### Telegram in setup')[1]!.split('## cland init and cland update')[0]!;
  assert.match(setup, /Discord/);
  assert.match(setup, /ElevenLabs/);
});

test('documentation vocabulary guard rejects an invented command flag', () => {
  assert.deepEqual(vocabularyErrors('`cland remote status --invented`'), ['flag: --invented']);
  assert.deepEqual(vocabularyErrors('`cland remote status [--json]`'), []);
});

test('README public remote commands, settings, secrets and flags use shipped vocabulary', () => {
  const readme = source('hub/README.md');
  const sections = [
    readme.split('## Project secrets')[1]!.split('### Remote state in the workbenches')[0]!,
    readme.split('### Telegram in setup')[1]!.split('## cland init and cland update')[0]!,
  ];
  for (const section of sections) {
    // These are dispatcher frame types, not configuration keys.
    const publicText = section.replace(/`remote\.(?:status|unpair|test)`/g, '');
    assert.deepEqual(vocabularyErrors(publicText), []);
  }
});

test('chat guide distinguishes Telegram typed ask answers from Discord topic replies', () => {
  const chat = source(guidePath).split('## In the chat')[1]!.split('## Photos, files and voice')[0]!;
  assert.match(chat, /On Telegram, a text reply to an open ask card answers that ask/);
  assert.match(chat, /On Discord, typed replies send a message to the topic/);
  assert.match(chat, /answer with the card's buttons or modal, or a voice reply/);
});

for (const [name, path, remote] of [
  ['landing feature', 'site/src/pages/index.astro', /id: 'remote',[\s\S]*?href: '\/docs\/remote-control\/'/],
  ['README feature', 'README.md', /^- .*\[.*remote control.*\]\(https:\/\/cland\.app\/docs\/remote-control\/\).*$/im],
  ['Features entry', 'site/src/content/docs/docs/features.md', /^- .*\[Remote control\]\(\/docs\/remote-control\/\).*$/m],
] as const) {
  test(`${name} names both shipped remotes and links their guide`, () => {
    const entry = source(path).match(remote)?.[0] ?? '';
    assert.ok(entry, `${path}: remote feature links the guide`);
    for (const fact of [/Telegram/, /Discord/, /General/, /both ways/, /asks/, /approvals/, /cards/, /photos/i, /files/, /voice notes/, /cland setup/]) {
      assert.match(entry, fact, `${path}: shipped remote fact ${fact}`);
    }
    assert.doesNotMatch(entry, /Telegram groups|forum topics|thread per item|Components V2|several humans|webhooks|cost accounting/i);
  });
}

const landingSource = source('site/src/pages/index.astro');
const featureList = landingSource.slice(landingSource.indexOf('const features = ['), landingSource.indexOf('const pad ='));
const featureSection = landingSource.split('<section id="features"')[1]!.split('</section>')[0]!;

test('landing shows all eleven features in the chosen order without carousel controls', () => {
  assert.deepEqual([...featureList.matchAll(/id: '([^']+)'/g)].map(match => match[1]),
    ['harness', 'accounts', 'remote', 'inbox', 'gate', 'items', 'topics', 'plans', 'verify', 'artifacts', 'release']);
  assert.match(featureSection, /features\.map\(/);
  assert.doesNotMatch(landingSource, /carousel|scroll-snap|aria-roledescription/);
  assert.match(featureSection, /All features in the docs →/);
});

test('feature cards keep anchors and only number, title, text and docs link in a responsive grid', () => {
  assert.match(featureSection, /id=\{`feature-\$\{s.id\}`\}/);
  assert.match(featureSection, /pad\(i \+ 1\)/);
  for (const field of ['s.h', 's.p', 's.href']) assert.ok(featureSection.includes(field));
  assert.doesNotMatch(featureSection, /Screenshot|Diagram|<img|<svg|<button|hidden/);
  assert.match(landingSource, /\.feature-grid\s*\{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(landingSource, /@media \(max-width: 900px\)\s*\{\s*\.feature-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test('feature link clicks use GoatCounter feature ids and privacy wording includes clicks', () => {
  assert.match(featureSection, /data-goatcounter-click=\{`feature-\$\{s.id\}`\}/);
  assert.match(source('site/src/layouts/SiteLayout.astro'), /data-goatcounter=\{GOATCOUNTER\}[^>]*src="https:\/\/gc.zgo.at\/count.js"/);
  for (const path of ['site/src/components/SiteFooter.astro', 'site/src/content/docs/docs/faq.md']) {
    assert.match(source(path), /visits and link clicks[\s\S]*?(?:no|without) cookies[\s\S]*?personal data/);
  }
});

test('every landing feature points to an existing documentation page', () => {
  const links = [...featureList.matchAll(/href: '(\/docs\/[^']+)'/g)].map(match => match[1]!);
  assert.equal(links.length, 11);
  for (const href of links) {
    const slug = href.split('#')[0]!.replace(/^\/docs\//, '').replace(/\/$/, '');
    assert.ok(['md', 'mdx'].some(ext => existsSync(new URL(`../src/content/docs/docs/${slug}.${ext}`, import.meta.url))), href);
  }
});
