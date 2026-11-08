// T1: Claude's public PreToolUse payload, evaluated without running its Bash command.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { literalRmRefusal } from '../src/cli/literal-rm.ts';

test('literal-rm refuses computed rm and rmdir targets with a literal-path retry', () => {
  for (const command of [
    'rm -rf $(mktemp -d)', 'rmdir "$(pwd)/empty"', 'rm -rf `pwd`/tmp',
    'rm -rf "$target"', 'rmdir ${target}', 'echo paths | xargs rm -rf',
    'find scratch -type d -print0 | xargs -0 rmdir',
    'true && sudo rm -rf "$target"', 'if true; then command rmdir "$target"; fi',
    'for target in scratch; do rm -rf "$target"; done',
  ]) {
    const refusal = literalRmRefusal({ tool_name: 'Bash', tool_input: { command } });
    assert.match(refusal ?? '', /Refused by cland hook literal-rm/, command);
    assert.match(refusal ?? '', /approval.*stalls this session/, command);
    assert.match(refusal ?? '', /every path written out literally/, command);
  }
});

test('literal-rm allows literal paths, git rm, heredoc bodies and unrelated payloads', () => {
  for (const command of [
    'rm -rf /private/tmp/example.AbC123', 'rmdir "scratch folder"', 'git rm "$target"',
    'git rm -f file.ts', 'echo harmless',
    "cat <<'EOF' > script.sh\nrm -rf $(pwd)/scratch\nEOF",
    'cat <<-EOF\n\trmdir "$target"\n\tEOF',
  ]) assert.equal(literalRmRefusal({ tool_name: 'Bash', tool_input: { command } }), null, command);
  for (const input of [null, {}, { tool_name: 'Read', tool_input: { command: 'rm "$target"' } }, { tool_name: 'Bash', tool_input: { command: 42 } }]) {
    assert.equal(literalRmRefusal(input), null);
  }
});

test('literal-rm refuses unquoted glob targets including shell script strings', () => {
  for (const command of [
    'rm -f fence*.sh', 'rmdir a?b', 'rm [ab].txt',
    'rmdir scratch*', 'rm a?b', 'rmdir [ab]',
    "bash -c 'cd /tmp/x; rm -f fence*.sh'", 'sh -c "rmdir scratch?"',
    'true; rm *.txt', 'true && rm *.txt', 'false || rmdir [ab]',
    'if true; then rm *.txt; fi', 'for x in scratch; do rmdir x?; done',
    'sudo rm -- *.txt', 'command rmdir scratch[12]',
    'rm literal "quoted path" other*.txt',
  ]) {
    const refusal = literalRmRefusal({ tool_name: 'Bash', tool_input: { command } });
    assert.match(refusal ?? '', /unquoted glob/, command);
    assert.match(refusal ?? '', /every path written out literally/, command);
    assert.match(refusal ?? '', /leave.*mktemp -d.*in place/, command);
  }
});

test('literal-rm leaves quoted and escaped glob literals and non-rm data alone', () => {
  for (const command of [
    'rm "a*b"', "rmdir 'a?b'", 'rm "[ab].txt"', String.raw`rm a\*b a\?b \[ab\]`,
    'rm unmatched[', 'rm /tmp/literal "scratch folder"',
    "bash -c 'rm /tmp/literal'", `sh -c 'rmdir "scratch folder"'`,
    'echo "rm *.txt"', 'printf "text; rm *.txt"', 'echo *.txt',
    "cat <<'EOF'\nrm *.txt\nrmdir a?b\nEOF",
    'cat <<-EOF\n\trm [ab]\n\tEOF',
  ]) assert.equal(literalRmRefusal({ tool_name: 'Bash', tool_input: { command } }), null, command);
});

for (const command of ["rm ';' fence*.sh", 'rm [a"b"]', 'rm []a]', 'rmdir [!]]']) {
  test(`literal-rm refuses glob after literal separator or in bracket class: ${command}`, () => {
    assert.match(literalRmRefusal({ tool_name: 'Bash', tool_input: { command } }) ?? '', /unquoted glob/);
  });
}

test('literal-rm preserves quoted separator arguments as data', () => {
  for (const command of ["echo ';' rm fence*.sh", 'printf "|" rmdir a?b', 'rm "[]a]"', 'rm "[a"b"]"']) {
    assert.equal(literalRmRefusal({ tool_name: 'Bash', tool_input: { command } }), null, command);
  }
});
