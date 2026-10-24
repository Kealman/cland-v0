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
