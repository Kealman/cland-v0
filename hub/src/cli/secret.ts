import { existsSync, readFileSync } from 'node:fs';
import { emitKeypressEvents } from 'node:readline';
import type { Readable } from 'node:stream';
import { ensureGitignore, layout, MANAGED_MARK, projectRoot } from '../project.ts';
import { symlinkOnPath } from '../init/files.ts';
import { isSecretName, resolveSecrets, SECRET_NAMES, secretFingerprint, setSecret, unsetSecret } from '../remote/secrets.ts';

const USAGE = 'usage: cland secret set <name> | list | unset <name>; set reads stdin or a hidden prompt, never a value argument';

export async function runSecret(args: string[], cwd = process.cwd()): Promise<number> {
  const [sub, name, ...extra] = args;
  if (extra.length || (sub === 'list' ? name !== undefined : (sub !== 'set' && sub !== 'unset') || !name || !isSecretName(name))) {
    throw new Error(`${USAGE}\nnames: ${SECRET_NAMES.join(', ')}`);
  }
  const root = projectRoot(cwd);
  const l = layout(root);
  if (!existsSync(l.dir)) throw new Error('no cland project here; run cland init first');
  if (sub === 'list') {
    const secrets = resolveSecrets(root);
    for (const name of SECRET_NAMES) {
      const value = secrets[name];
      if (value !== undefined) process.stdout.write(`${name} ${secretFingerprint(value)}\n`);
    }
  } else {
    // Validate the file before reading stdin, and never follow a project-owned ignore symlink.
    resolveSecrets(root);
    if (symlinkOnPath(root, l.gitignore) !== null) throw new Error('.cland/.gitignore: symlink refused');
    ensureGitignore(l);
    const ignore = readFileSync(l.gitignore, 'utf8');
    // A final literal rule cannot be undone by an earlier custom negation.
    // Preserve ownership rather than rewriting a project-owned ignore file.
    const lastRule = ignore.split(/\r?\n/).map(line => line.trimEnd()).filter(line => line && !line.startsWith('#')).at(-1);
    if (!ignore.startsWith(MANAGED_MARK) && lastRule !== 'secrets.toml' && lastRule !== '/secrets.toml') {
      throw new Error('.cland/.gitignore: add /secrets.toml as its final ignore rule before storing secrets');
    }
    if (sub === 'set') setSecret(root, name as typeof SECRET_NAMES[number], await readSecret());
    else unsetSecret(root, name as typeof SECRET_NAMES[number]);
    process.stdout.write(`${sub === 'set' ? 'set' : 'unset'} ${name}\n`);
  }
  return 0;
}

type SecretInput = Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (value: boolean) => unknown };

export async function readSecret(input: SecretInput = process.stdin, prompt: Pick<NodeJS.WriteStream, 'write'> = process.stderr): Promise<string> {
  if (input.isTTY) {
    if (!input.setRawMode) throw new Error('hidden secret input needs a raw terminal; pipe the value through stdin');
    return hiddenSecret(input as SecretInput & { setRawMode: (value: boolean) => unknown }, prompt);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 4098) throw new Error('secret input too large (at most 4096 bytes and a final newline)');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

/** Native raw input keeps the terminal from echoing typed or pasted credentials. */
async function hiddenSecret(input: SecretInput & { setRawMode: (value: boolean) => unknown }, prompt: Pick<NodeJS.WriteStream, 'write'>): Promise<string> {
  const wasRaw = Boolean(input.isRaw);
  const wasFlowing = input.readableFlowing === true;
  emitKeypressEvents(input);
  input.setRawMode(true);
  try {
    prompt.write('Secret: ');
    input.resume();
    return await new Promise<string>((resolve, reject) => {
      let value = '';
      const finish = (error?: Error) => {
        input.off('keypress', keypress);
        input.off('end', ended);
        input.off('error', failed);
        error ? reject(error) : resolve(value);
      };
      const ended = () => finish(new Error('secret input ended before confirmation'));
      const failed = () => finish(new Error('cannot read secret input'));
      const keypress = (text: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean }) => {
        if (key.ctrl && (key.name === 'c' || key.name === 'd')) finish(new Error('secret input cancelled'));
        else if (key.name === 'return' || key.name === 'enter') finish();
        else if (key.name === 'backspace') value = [...value].slice(0, -1).join('');
        else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) {
          value += text;
          if (Buffer.byteLength(value) > 4096) finish(new Error('secret input too large (at most 4096 bytes)'));
        }
      };
      input.on('keypress', keypress);
      input.once('end', ended);
      input.once('error', failed);
    });
  } finally {
    input.setRawMode(wasRaw);
    if (!wasFlowing) input.pause();
    prompt.write('\n');
  }
}
