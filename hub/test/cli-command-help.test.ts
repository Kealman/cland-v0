// T1: the CLI's pure help entry covers every advertised command without processes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandHelp } from '../src/cli/help.ts';
import { sealedHelpProject } from './cli-usage-fixture.ts';

const taskCommands = ['create', 'view', 'migrate', 'plan', 'list', 'comment', 'edit', 'close', 'link', 'hold', 'criterion', 'rank', 'claim', 'import-github'];

test('task help advertises the complete tested subcommand inventory', () => {
  const advertised = [...commandHelp('task', ['--help'])!.matchAll(/^  task (\S+)/gm)].map(match => match[1]);
  assert.deepEqual([...new Set(advertised)].sort(), [...taskCommands].sort());
});

for (const sub of taskCommands) test(`task ${sub} answers both immediate help flags with its own usage`, () => {
  for (const flag of ['--help', '-h']) {
    const help = commandHelp('task', [sub, flag]);
    assert.equal(typeof help, 'string', `task ${sub} ${flag} resolves before execution`);
    assert.ok(help!.startsWith(`  task ${sub} `));
    assert.deepEqual([...new Set([...help!.matchAll(/^  task (\S+)/gm)].map(match => match[1]))], [sub]);
    assert.match(help!, /every task command takes --json, and --as <name> \[--role r\]/);
  }
});

test('task help leaves ordinary arguments, unknown commands and non-immediate flags to parsing', () => {
  for (const args of [['criterion'], ['criterion', 'T-1', '--help'], ['criterion', '--help', 'extra'], ['unknown', '--help'], ['toString', '-h'], ['list', '--json']]) {
    assert.equal(commandHelp('task', args), undefined, args.join(' '));
  }
});

test('every command listed by cland --help answers both help flags without a hub or project changes', t => {
  const fixture = sealedHelpProject(t);
  const before = fixture.snapshot();
  const previousCwd = process.cwd();
  const previousEnv = process.env;
  try {
    process.chdir(fixture.project);
    process.env = fixture.env;
    const help = commandHelp('--help', []);
    assert.equal(typeof help, 'string');
    // Derive complete command tokens, excluding options and colon-labelled prose
    // such as T-779's "release: optional [release.homebrew] ..." annotation.
    const commands = [...new Set([...help!.matchAll(/^  ([^\s-]\S*)/gm)]
      .map(match => match[1]!).filter(token => !token.endsWith(':')))];
    assert.ok(commands.includes('hub') && commands.includes('task') && commands.includes('session'));
    for (const command of commands) {
      for (const flag of ['--help', '-h']) {
        const result = commandHelp(command, [flag]);
        assert.equal(typeof result, 'string', `${command} ${flag} has a help dispatch`);
        assert.ok(result!.split('\n').some(line => line.match(/^  (\S+)/)?.[1] === command), `${command} ${flag} prints its usage`);
        assert.doesNotMatch(result!, /usage: cland \[<command>\]/, 'command help is specific');
        assert.deepEqual(fixture.snapshot(), before, `${command} ${flag} leaves project and profiles unchanged`);
      }
    }
  } finally {
    process.chdir(previousCwd);
    process.env = previousEnv;
  }
});
