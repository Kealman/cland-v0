/** One conservative ownership policy for awaited Git and its caller census. */
export type GitCommandPolicy = { kind: 'read-only' | 'writer'; args: readonly string[]; localRepository: boolean };
type Grammar = { flags: readonly string[]; values?: Readonly<Record<string, readonly string[] | null>>; numericCount?: boolean };
const diff: Grammar = { flags: ['--no-commit-id', '--name-only', '--name-status', '--no-renames', '--stat', '--numstat', '--shortstat', '--check', '--quiet', '--exit-code', '--cached', '--staged', '--raw', '--no-ext-diff', '--no-textconv', '-r', '-z'], values: { '--diff-filter': null } };
const log: Grammar = { flags: ['--reverse', '--oneline', '--no-walk', '--no-patch', '--no-ext-diff', '--no-textconv', '-s', '-z'], values: { '--format': null, '--pretty': null, '--max-count': null }, numericCount: true };
const reads: Readonly<Record<string, Grammar>> = {
  'rev-parse': { flags: ['--verify', '--quiet', '-q', '--short', '--abbrev-ref', '--symbolic-full-name', '--show-toplevel', '--git-common-dir', '--git-dir', '--absolute-git-dir', '--is-bare-repository', '--is-inside-work-tree', '--show-prefix'],
    values: { '--git-path': null, '--path-format': ['absolute', 'relative'], '--short': null } },
  status: { flags: ['--porcelain', '--short', '-s', '--branch', '-b', '--show-stash', '--ahead-behind', '--no-ahead-behind', '-z', '--null', '--ignored', '-uno', '-unormal', '-uall'],
    values: { '--porcelain': ['1', '2', 'v1', 'v2'], '--untracked-files': ['no', 'normal', 'all'], '--ignore-submodules': ['none', 'untracked', 'dirty', 'all'], '--ignored': ['traditional', 'matching', 'no'] } },
  log, show: log, diff, 'diff-tree': diff, 'diff-files': diff,
  'ls-tree': { flags: ['--name-only', '--name-status', '--full-tree', '-r', '-t', '-d', '-z'], values: { '--format': null } },
  'ls-files': { flags: ['--others', '--exclude-standard', '--cached', '--deleted', '--modified', '--stage', '--unmerged', '-z'] },
  'for-each-ref': { flags: ['--shell', '--count'], values: { '--format': null, '--sort': null, '--count': null } },
  'merge-base': { flags: ['--is-ancestor', '--all', '--octopus', '--independent', '--fork-point'] },
  'check-ref-format': { flags: ['--branch', '--allow-onelevel', '--refspec-pattern', '--normalize'] },
  'show-ref': { flags: ['--verify', '--quiet', '-q', '--heads', '--tags', '--head', '--hash', '--dereference'] },
  'rev-list': { flags: ['--count', '--objects', '--no-object-names', '--stdin', '--all', '--not', '--reverse', '--topo-order'], values: { '--max-count': null } },
};
const worktreeList: Grammar = { flags: ['--porcelain', '-z', '--verbose', '-v'] };
const symbolicRef: Grammar = { flags: ['--short', '--quiet', '-q'] };
const configRead: Grammar = { flags: ['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '--local', '--global', '--system', '--null', '-z'], values: { '--file': null } };

function parse(args: readonly string[], grammar: Grammar): { flags: Set<string>; operands: number } | null {
  const flags = new Set<string>();
  let operands = 0;
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]!;
    if (arg === '--') return { flags, operands: operands + args.length - at - 1 };
    if (!arg.startsWith('-')) { operands++; continue; }
    if (grammar.numericCount && /^-\d+$/.test(arg)) continue;
    if (grammar.flags.includes(arg)) { flags.add(arg); continue; }
    const equals = arg.indexOf('='), key = equals < 0 ? arg : arg.slice(0, equals);
    if (!grammar.values || !Object.hasOwn(grammar.values, key)) return null;
    const value = equals < 0 ? args[++at] : arg.slice(equals + 1);
    const allowed = grammar.values[key];
    if (value === undefined || allowed && !allowed.includes(value)) return null;
    flags.add(key);
  }
  return { flags, operands };
}

export function gitCommandPolicy(args: readonly string[], lazyFetch = true): GitCommandPolicy {
  const writer: GitCommandPolicy = { kind: 'writer', args, localRepository: false };
  let localRepository = true;
  let at = 0;
  while (args[at]?.startsWith('-')) {
    const option = args[at++];
    if (option === '--no-pager' || option === '--no-lazy-fetch' || option === '--no-optional-locks' || option === '--literal-pathspecs') continue;
    if (option === '--bare') { localRepository = false; continue; }
    if (option === '-C' || option === '--git-dir' || option === '--work-tree') {
      if (args[at++] === undefined) return writer;
      localRepository = false;
      continue;
    }
    if (option?.startsWith('--git-dir=') || option?.startsWith('--work-tree=')) { localRepository = false; continue; }
    if (option === '-c' && ['gc.auto=0', 'maintenance.auto=false', 'core.fsmonitor=false'].includes(args[at++] ?? '')) continue;
    return writer;
  }
  const command = args[at++];
  const commandAt = at;
  let grammar = command && Object.hasOwn(reads, command) ? reads[command] : undefined;
  if (command === 'worktree' && args[at++] === 'list') grammar = worktreeList;
  if (command === 'symbolic-ref') grammar = symbolicRef;
  if (command === 'config') grammar = configRead;
  const parsed = grammar && parse(args.slice(at), grammar);
  if (!parsed) return writer;
  if (command === 'symbolic-ref' && parsed.operands !== 1) return writer;
  if (command === 'config' && !['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list'].some(flag => parsed.flags.has(flag))) return writer;
  const safe = ['diff', 'diff-tree', 'diff-files', 'log', 'show'].includes(command ?? '')
    ? [...args.slice(0, commandAt), '--no-ext-diff', '--no-textconv', ...args.slice(commandAt)] : args;
  return { kind: 'read-only', localRepository, args: [...(lazyFetch ? ['--no-lazy-fetch'] : []), '--no-optional-locks', '-c', 'core.fsmonitor=false', ...safe] };
}
