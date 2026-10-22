// T1: the public brief linter consumes text and the shipped help; no process or hub.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintQaBrief } from '../src/qa-lint.ts';

// Use a reserved invalid fixture name: the real command surface grows between task and merge builds.
test('brief command findings name the source line and offending command', () => {
  const brief = '| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland no-such-command hello` | topic |\n| M2 | `cland task view T-957 --imaginary` | item |';
  const findings = lintQaBrief(brief);
  assert.deepEqual(findings.map(f => [f.line, f.command]), [[3, 'cland no-such-command hello'], [4, 'cland task view T-957 --imaginary']]);
  assert.match(findings[0]!.message, /subcommand/);
  assert.match(findings[1]!.message, /--imaginary/);
});

test('brief role assignments reject Implementer reports to General', () => {
  const brief = '| id | role | command | expected |\n| --- | --- | --- | --- |\n| M1 | Implementer | `cland verify --report general` | green |';
  assert.match(lintQaBrief(brief)[0]!.message, /Implementer.*item.s topic/);
});

test('brief records reject duplicate ids, invalid surfaces and variable cleanup', () => {
  const brief = '| id | surface | command | expected |\n| --- | --- | --- | --- |\n| M1 | hub-api | `cland task view T-957 --json` | item |\n| M1 | droplet | `rm -rf "$ROOT"` | removed |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 3);
  assert.match(findings[0]!.message, /duplicate check id M1/);
  assert.match(findings[1]!.message, /invalid surface droplet/);
  assert.match(findings[2]!.message, /literal cleanup path/);
});

test('valid brief accepts quoted values, command aliases and forwarded arguments', () => {
  const brief = '| id | role | surface | command | expected |\n| --- | --- | --- | --- | --- |\n| M1 | Implementer | hub-api | `cland verify --dry-run --diagnostics --report "$TOPIC"` | planned |\n| M2 | Human | hub-api | `cland task plan show E-952 --json` | plan |\n| M3 | Human | hub-api | `cland artifact create --kind note --title "hello --fake" --topic topic-1 --content text` | artifact |\n| M4 | QA | hub-api | `cland demo exec E-952 -- node --not-a-cland-flag` | ran |\n| M5 | QA | hub-api | `rm -r /tmp/qa-t957-literal` | removed |';
  assert.deepEqual(lintQaBrief(brief), []);
});

test('brief accepts demo status freshness checks at a named commit', () => {
  const brief = '| id | role | command | expected |\n| --- | --- | --- | --- |\n| M1 | QA | `cland demo status E-1 --commit <sha> --json` | current freshness |';
  assert.deepEqual(lintQaBrief(brief), []);
});

test('assigned roles use the built-in permission checks across brief sections', () => {
  const brief = 'Role: Implementer\n\n## Manual checks\n| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland task create "new" --size S` | refused |\n| M2 | `cland task comment T-957 hello` | comment |\n| M3 | `cland verify --report general` | refused |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 2);
  assert.match(findings[0]!.message, /implementer.*may not use task.create/i);
  assert.match(findings[1]!.message, /Implementer.*topic/);
});

test('cleanup checks cover fenced scripts and retain literal operands', () => {
  const findings = lintQaBrief('```sh\nrm -rf "${ROOT}/scratch"\nrm -- "$ROOT"\nrm -r /tmp/qa-t957\n```');
  assert.deepEqual(findings.map(f => f.line), [2, 3]);
});

test('quoted prose does not turn embedded flag names into flags', () => {
  assert.deepEqual(lintQaBrief('| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland task comment T-957 "mentions --fake"` | saved |'), []);
});

test('table parsing separates pipelines and shell substitution from cland argv', () => {
  const brief = '| id | command | expected |\n| --- | --- | --- |\n| M1 | `echo $(node hub/bin/cland.ts --version)` | version |\n| M2 | `cland task view T-957 --json \\| jq .item`; `cland no-such-command name` | item |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.command, 'cland no-such-command name');
});

test('role columns check reserved commands and scoped verdicts', () => {
  const brief = '| id | role | command | expected |\n| --- | --- | --- | --- |\n| M1 | Implementer | `cland release --item R-377` | refused |\n| M2 | Reviewer | `cland task comment T-957 checked --verdict qa --result clear --run r` | refused |\n| M3 | QA | `cland task hold T-957` | held |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 2);
  assert.match(findings[0]!.message, /implementer.*release/i);
  assert.match(findings[1]!.message, /reviewer.*only review/i);
});

test('literal dollar cleanup and narrative mentions do not become commands', () => {
  const brief = 'A path named `cland` and a `cland topic` mention.\n```sh\nrm -f \'$LITERAL\'\n# rm -rf "$ROOT"\n```\n| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland --version` | `cland project: run cland init` |';
  assert.deepEqual(lintQaBrief(brief), []);
});

test('command tables without ids still check commands against the build', () => {
  const findings = lintQaBrief('| role | command | expected |\n| --- | --- | --- |\n| Implementer | `cland verify --report=General` | refused |\n| Human | `cland suite alias` | refused |');
  assert.equal(findings.length, 2);
  assert.match(findings[0]!.message, /Implementer/);
  assert.match(findings[1]!.message, /unknown subcommand suite alias/);
});

test('help-declared Neovim argv forwarding leaves forwarded flags unchecked', () => {
  const brief = '| id | command | expected |\n| --- | --- | --- |\n| M1 | `cland open <P1> --headless "+lua …"` | opens |\n| M2 | `cland open /tmp/qa-t957 --nvim-option-at-runtime` | forwarded |\n| M3 | `cland task view T-957 --nvim-option-at-runtime` | refused |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.line, 5);
  assert.match(findings[0]!.message, /unknown flag --nvim-option-at-runtime/);
});

test('shell quoting cannot hide a role-mismatched report target', () => {
  for (const report of ['--report="General"', '--report=gen"eral"', '--report \'General\'']) {
    const brief = '| role | command | expected |\n| --- | --- | --- |\n| Implementer | `cland verify ' + report + '` | refused |';
    assert.match(lintQaBrief(brief)[0]!.message, /Implementer.*topic/);
  }
});

test('root commands do not treat help description columns as subcommands', () => {
  for (const command of ['cland subscriptions', 'cland subscriptions --json', 'cland -h', 'cland -v']) {
    assert.deepEqual(lintQaBrief('| command | expected |\n| --- | --- |\n| `' + command + '` | ok |'), [], command);
  }
});

test('unknown short flags fail while help aliases and forwarded flags remain valid', () => {
  const brief = '| command | expected |\n| --- | --- |\n| `cland task view T-957 -z` | refused |\n| `cland qa lint -h` | help |\n| `cland open /tmp/qa-t957 -u NONE` | forwarded |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.line, 3);
  assert.match(findings[0]!.message, /unknown flag -z/);
});

test('equals-form verdict options use the same role boundary as separate options', () => {
  for (const verdict of ['--verdict review', '--verdict=review']) {
    const brief = '| role | command | expected |\n| --- | --- | --- |\n| Implementer | `cland task comment T-957 checked ' + verdict + ' --result clear --scope full --run r` | refused |';
    assert.match(lintQaBrief(brief)[0]!.message, /implementer.*verdict/i);
  }
});

test('role normalization handles equals-form actors and the last verdict option', () => {
  const brief = '| role | command | expected |\n| --- | --- | --- |\n| | `cland task comment T-957 checked --as=impl --role=implementer --verdict=review --result=clear --run=r` | refused |\n| Reviewer | `cland task comment T-957 checked --verdict=review --verdict qa --result=clear --run=r` | refused |';
  const findings = lintQaBrief(brief);
  assert.equal(findings.length, 2);
  assert.match(findings[0]!.message, /implementer.*verdict/i);
  assert.match(findings[1]!.message, /reviewer.*only review/i);
});

test('Implementer topic creation requires a nonempty item option rather than a title', () => {
  for (const binding of ['', ' --item=', ' --item ""', ' --item "   "', ' --item --json', ' -- --item T-957']) {
    const brief = '| role | command | expected |\n| --- | --- | --- |\n| Implementer | `cland topic create hello' + binding + '` | refused |';
    const findings = lintQaBrief(brief);
    assert.equal(findings.length, 1, binding || 'missing --item');
    assert.match(findings[0]!.message, /implementer.*topic.*own item/i);
  }
  for (const binding of [' --item T-957', ' --item=T-957', ' --item= --item T-957']) {
    assert.deepEqual(lintQaBrief('| role | command | expected |\n| --- | --- | --- |\n| Implementer | `cland topic create hello' + binding + '` | topic |'), [], binding);
  }
});
