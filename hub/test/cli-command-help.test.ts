// T1: the CLI's pure help entry covers every advertised command without processes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandHelp } from '../src/cli/help.ts';
import { sealedHelpProject } from './cli-usage-fixture.ts';

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
