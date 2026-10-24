// Static QA brief checks. Never evaluate shell text or contact the project's hub.
import * as help from './cli/usage.ts';
import { decide, DEFAULT_PERMISSIONS, KNOWN_TOOLS, type ToolCall } from './roles/permissions.ts';

export type QaLintFinding = { line: number; message: string; command?: string };
type Command = { path: string[]; flags: Set<string>; forwardAfter?: number };
const flagsIn = (text: string): string[] => [...text.matchAll(/(?:^|[\s[(,|])(--[a-z][a-z-]*|-[A-Za-z])\b/g)].map(m => m[1]!);

/** Parse the same synopsis/continuation text that the build prints for --help. */
function commands(): Command[] {
  const result: Command[] = [];
  for (const usage of Object.values(help)) {
    let current: Command | undefined;
    for (const line of usage.split('\n')) {
      const row = /^ {2,4}([a-z][a-z-]*)(?=\s|$)(.*)$/.exec(line);
      if (!row) {
        if (current) for (const flag of flagsIn(line)) current.flags.add(flag);
        continue;
      }
      // Two or more spaces separate the synopsis from its description column.
      const rest = row[2]!.replace(/ {2,}[\s\S]*$/, '').trimStart();
      if (rest.startsWith('alias for ')) continue;
      const sub = /^([a-z][a-z-]*)(?=\s|$)/.exec(rest)?.[1];
      const alternative = /^<([a-z]+(?:\|[a-z]+)+)>/.exec(rest)?.[1];
      const paths = alternative ? alternative.split('|').map(s => [row[1]!, s]) : [[row[1]!, ...(sub ? [sub] : [])]];
      for (const path of paths) {
        const forwarded = /\[[^\]]+ args…\]/.exec(line);
        const forwardAfter = forwarded ? [...line.slice(0, forwarded.index).matchAll(/<[^>]+>|\[[^\]]+\]/g)].length : undefined;
        current = { path, flags: new Set([...flagsIn(line), '--help']), ...(forwardAfter !== undefined ? { forwardAfter } : {}) };
        result.push(current);
      }
    }
  }
  // Aliases and root switches printed in the main CLI help.
  for (const [alias, original] of [['suite', 'verify'], ['artifact create', 'artifact new']]) {
    for (const c of result.filter(c => c.path.join(' ') === original)) result.push({ ...c, path: alias!.split(' ') });
  }
  result.push({ path: ['--headless'], flags: new Set(flagsIn(help.QA_USAGE)) }, { path: ['--qa'], flags: new Set(flagsIn(help.QA_USAGE)) });
  for (const name of ['help', 'version', '--help', '-h', '--version', '-v']) result.push({ path: [name], flags: new Set() });
  // Repeated synopsis rows describe additional flags on the same command.
  const merged = new Map<string, Command>();
  for (const c of result) {
    const key = c.path.join(' ');
    const existing = merged.get(key);
    if (existing) for (const flag of c.flags) existing.flags.add(flag);
    else merged.set(key, c);
  }
  return [...merged.values()];
}
const COMMANDS = commands();
const SURFACES = new Set(['headless-grid', 'tmux', 'web-terminal', 'hub-api', 'real-browser']);
const ROLES = /\b(coordinator|implementer|reviewer|qa|lead|aide|human)\b/i;

/** Shell words with quotes retained in raw form for diagnostics and cleanup checks. */
function words(text: string): { value: string; raw: string }[] {
  const matches = text.matchAll(/(?:"(?:\\.|[^"\\])*"|'[^']*'|\\.|[^\s;|&`()"'])+|[;|&`()]+/g);
  return [...matches].map(m => ({ raw: m[0], value: m[0].replace(/"((?:\\.|[^"\\])*)"|'([^']*)'|\\(.)/g, (_match, double: string | undefined, single: string | undefined, escaped: string | undefined) => double !== undefined ? double.replace(/\\(["\\$`])/g, '$1') : single ?? escaped ?? '') }));
}

function checkCommand(words: { value: string; raw: string }[]): string | null {
  const tokens = words.map(t => t.value);
  const root = tokens[0];
  const candidates = COMMANDS.filter(c => c.path[0] === root);
  if (!candidates.length) return `unknown subcommand ${root ?? '(missing)'}`;
  const command = candidates.filter(c => c.path.every((p, i) => tokens[i] === p)).sort((a, b) => b.path.length - a.path.length)[0];
  if (!command) return `unknown subcommand ${tokens.slice(0, 2).join(' ')}`;
  if (root === 'task' && tokens[1] === 'plan' && !['set', 'show', 'approve', 'migrate'].includes(tokens[2] ?? '')) return `unknown subcommand ${tokens.slice(0, 3).join(' ')}`;
  if (['verify', 'suite'].includes(root ?? '') && tokens[1] && !tokens[1]!.startsWith('-') && command.path.length === 1 && !['all', 'hub', 'nvim'].includes(tokens[1]!)) return `unknown subcommand ${tokens.slice(0, 2).join(' ')}`;
  const checked = command.forwardAfter === undefined ? words.slice(command.path.length) : words.slice(command.path.length, command.path.length + command.forwardAfter);
  for (const word of checked) {
    const token = word.value;
    if (token === '--') break; // demo exec, for example, forwards the remaining argv.
    if (!token.startsWith('-') || token === '-' || /^-\d/.test(token)) continue;
    const flag = token.split('=')[0]!;
    if (command.flags.has(flag) || (root === 'task' && ['--json', '--as', '--role'].includes(flag))) continue;
    return `unknown flag ${flag} for ${command.path.join(' ')}`;
  }
  return null;
}

const flagValue = (args: string[], flag: string): string | undefined => {
  let value: string | undefined;
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i]!;
    if (arg === flag) value = args[i + 1];
    else if (arg.startsWith(`${flag}=`)) value = arg.slice(flag.length + 1);
  }
  return value;
};

/** Built-in grants only: live claims, explicit grants and topic membership still belong to the hub. */
function roleProblem(role: string, args: string[]): string | null {
  if (role === 'human') return null;
  const [root, sub] = args;
  // Verification uses scheduler admission, not the built-in tool-grant lists.
  // Its report, mode and Aide checks remain in lintQaBrief below; the custom
  // verify grant in KNOWN_TOOLS must not change built-in brief policy.
  if (root === 'verify' || root === 'suite') return null;
  const tool = root === 'artifact' && ['new', 'create'].includes(sub ?? '') ? 'artifact.create'
    : root === 'task' && sub === 'import-github' ? 'task.import'
    : KNOWN_TOOLS.includes(root ?? '') ? root! : sub ? `${root}.${sub}` : root ?? '';
  if (['executor', 'config'].includes(root ?? '') && role !== 'coordinator') return `${role} cannot use ${root}; it belongs to the Coordinator or human`;
  if (root === 'merge' && sub === 'queue') return null;
  if (!KNOWN_TOOLS.includes(tool)) return null;
  const call: ToolCall = { tool, item: args[2] ?? null, own: () => true, claimed: () => true };
  if (tool === 'topic.create') {
    const item = flagValue(args, '--item')?.trim();
    call.item = item && !item.startsWith('-') ? item : null;
  }
  if (tool === 'task.plan') call.planOp = args[2];
  if (tool === 'task.criterion') call.criterionOp = args[3];
  if (tool === 'session.launch') call.launchRole = flagValue(args, '--role') ?? null;
  if (tool === 'task.comment') {
    const kind = flagValue(args, '--verdict');
    call.verdict = kind !== undefined;
    if (kind) call.verdictKind = kind;
  }
  if (tool === 'task.edit' && flagValue(args, '--status')) {
    call.status = flagValue(args, '--status');
    call.statusOnly = args.filter(a => a.startsWith('--') && !['--json', '--as', '--role'].includes(a.split('=')[0]!)).length === 1;
  }
  const decision = decide(role, DEFAULT_PERMISSIONS[role], call);
  return decision.ok ? null : `${role}: ${decision.reason}`;
}

/** Lint table commands, check identifiers/surfaces, and shell cleanup in code. */
export function lintQaBrief(source: string): QaLintFinding[] {
  const findings: QaLintFinding[] = [];
  const ids = new Map<string, number>();
  let headers: string[] = [];
  let role: string | undefined;
  let sectionRole: string | undefined;
  let fence = false;
  let shellFence = false;
  source.split(/\r?\n/).forEach((line, index) => {
    const number = index + 1;
    const add = (message: string, command?: string) => findings.push({ line: number, message, ...(command ? { command } : {}) });
    if (/^\s*```/.test(line)) {
      shellFence = !fence && /^\s*```(?:sh|bash|shell)?\s*$/.test(line);
      fence = !fence; headers = []; return;
    }
    if (!fence && /^\s*(?:[-*]\s*)?(?:\*\*)?(?:role|actor):/i.test(line)) role = ROLES.exec(line)?.[1]?.toLowerCase();
    if (!fence && /^#{1,6}\s/.test(line)) sectionRole = /^#{1,6}\s+(?:role:\s*)?(coordinator|implementer|reviewer|qa|lead|aide|human)\s*$/i.exec(line)?.[1]?.toLowerCase();
    let rowRole = sectionRole ?? role;
    const table = !fence && /^\s*\|/.test(line);
    let snippets: string[] = [];
    if (table) {
      // Markdown permits escaped pipes, including shell pipelines in code spans.
      const rawCells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      const cells = rawCells.map(c => c.replace(/`/g, ''));
      const lower = cells.map(c => c.toLowerCase());
      if (lower.some(c => ['command', 'command and expected outcome', 'surface', 'method', 'action'].includes(c)) || (lower.some(c => ['id', 'case', 'check', 'check id'].includes(c)) && lower.some(c => ['expected', 'note'].includes(c)))) { headers = lower; return; }
      if (cells.every(c => /^:?-+:?$/.test(c))) return;
      const idColumn = headers.findIndex(c => ['id', 'case', 'check', 'check id'].includes(c));
      if (idColumn >= 0) {
        const id = cells[idColumn];
        if (id && id !== 'none') {
          if (ids.has(id)) add(`duplicate check id ${id} (first at line ${ids.get(id)})`);
          else ids.set(id, number);
        }
      }
      const surface = cells[headers.indexOf('surface')];
      if (surface !== undefined && !SURFACES.has(surface)) add(`invalid surface ${surface}; use ${[...SURFACES].join(', ')}`);
      const assigned = cells[headers.findIndex(c => c === 'role' || c === 'actor')];
      if (assigned) {
        rowRole = ROLES.exec(assigned)?.[1]?.toLowerCase();
        if (!rowRole) add(`unknown role ${assigned}`);
      }
      // Inspect command spans in executable columns; expected-output prose stays literal.
      snippets = rawCells.flatMap((cell, column) => {
        if (!/^(command|command and expected outcome|method|action|note)$/.test(headers[column] ?? '')) return [];
        const code = [...cell.matchAll(/`([^`]+)`/g)].map(m => m[1]!);
        return code.length ? code : headers[column]?.startsWith('command') ? [cell] : [];
      });
    } else {
      headers = [];
      snippets = fence && shellFence ? [line] : [];
    }
    for (const snippet of snippets) {
      const parsed = words(snippet);
      const comment = parsed.findIndex(t => t.raw === '#');
      const tokens = comment < 0 ? parsed : parsed.slice(0, comment);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!;
        if (token.value === 'rm') {
          const operands = tokens.slice(i + 1).filter(t => !t.value.startsWith('-'));
          for (const operand of operands) {
            if (/^[;|&`()]+$/.test(operand.value)) break;
            if (/\$|`/.test(operand.raw.replace(/'[^']*'/g, '').replace(/\\./g, ''))) add(`rm operand must be a literal cleanup path: ${operand.raw}`, snippet.trim());
          }
        }
        if (!table) continue; // Commands belong to check tables; shell blocks add cleanup checks only.
        if (token.value.includes('=') || (token.value !== 'cland' && !/(?:^|\/)cland(?:\.ts)?$/.test(token.value))) continue;
        const argv = tokens.slice(i + 1);
        const end = argv.findIndex(t => /^[;|&`()]+$/.test(t.value) || /^[<>]\d?$/.test(t.raw));
        const args = (end < 0 ? argv : argv.slice(0, end)).map(t => t.value);
        // Wrapper definitions and executable paths alone are not literal commands.
        if (!args.length || /^(?:\$|<args|…)/.test(args[0]!)) continue;
        const command = [token.raw, ...(end < 0 ? argv : argv.slice(0, end)).map(t => t.raw)].join(' ');
        const problem = checkCommand(end < 0 ? argv : argv.slice(0, end));
        if (problem) add(problem, command);
        const assignedRole = rowRole ?? (flagValue(args, '--as') !== undefined ? flagValue(args, '--role')?.toLowerCase() : undefined);
        if (assignedRole) {
          const refusal = roleProblem(assignedRole, args);
          if (refusal) add(refusal, command);
        }
        if (assignedRole && ['verify', 'suite'].includes(args[0] ?? '') && !['queue', 'cancel'].includes(args[1] ?? '')) {
          const report = flagValue(args, '--report');
          if (assignedRole === 'implementer' && ((!report && !args.includes('--dry-run')) || (report !== undefined && (report.startsWith('--') || /^(general|agents)$/i.test(report))))) add(`Implementer verify --report must name the item's topic`, command);
          if (['implementer', 'reviewer', 'lead'].includes(assignedRole) && (args[1] === 'all' || args.includes('--all'))) add(`${assignedRole} cannot request verify all; use a mode-free task run`, command);
          if (assignedRole === 'aide') add('Aide cannot submit verification', command);
        }
      }
    }
  });
  return findings;
}
