import { setupHub } from '../hub.ts';
import { Cancelled } from '../prompter.ts';
import type { SetupStep } from '../types.ts';

export const signin: SetupStep = async o => {
  const name = 'sign-in mode';
  const open = { name, verdict: 'open' as const, detail: 'choose the web sign-in mode', fix: 'cland auth mode users' };
  const client = o.hub ?? setupHub(o.root, o.env);
  if (!client.signinStatus) return o.yes || o.noAide
    ? [{ name, verdict: 'skip', detail: 'single mode default; detect when the hub is available' }] : [open];
  let status;
  try { status = await client.signinStatus(); }
  catch { return o.yes || o.noAide ? [{ name, verdict: 'skip', detail: 'single mode default; detect when the hub is available' }] : [open]; }
  if (status.mode === 'users') return [{ name, verdict: 'ok', detail: `users mode; ${status.users.length} users` }];
  if (status.mode !== 'single') return [open];
  if (o.yes) return [{ name, verdict: 'skip', detail: 'single mode' }];
  if (!o.interactive) return [{ name, verdict: 'skip', detail: 'single mode', fix: open.fix }];
  if (!client.signinUsers) return [open];
  if (!await o.prompter.confirm('Let several people sign in to the web (users mode)?', false)) return [{ name, verdict: 'skip', detail: 'single mode' }];
  if (!o.narrate) return [open];
  if (!await o.prompter.confirm('Switching signs out the current browser sessions; cland auth reset is the only way back. Continue?', false)) return [{ name, verdict: 'skip', detail: 'single mode' }];
  // Never put the credential in SetupLine, errors, JSON or a prompt transcript.
  let invited;
  try { invited = await client.signinUsers(); }
  catch { return [{ ...open, detail: 'could not switch sign-in mode; inspect cland user list' }]; }
  const pending = { name, verdict: 'open' as const, detail: `users mode; ${invited.user.name} awaiting passkey`, fix: `cland user invite ${invited.user.name}` };
  if (!invited.url) return [pending];
  o.narrate(`${invited.user.name}\n${invited.url}\n`);
  const stop = new AbortController();
  const signal = o.signal ? AbortSignal.any([o.signal, stop.signal]) : stop.signal;
  const pause = o.prompter.pause('Register a passkey on the invite page; Enter skips waiting.', signal);
  const observe = async () => {
    while (!signal.aborted) {
      const current = await client.signinStatus!();
      if (current.users.some(user => user.id === invited.user.id && user.passkeyRegistered === true)) return true;
      await new Promise<void>(resolve => {
        const end = () => { clearTimeout(timer); signal.removeEventListener('abort', end); resolve(); };
        const timer = setTimeout(end, 250);
        signal.addEventListener('abort', end, { once: true });
        if (signal.aborted) end();
      });
    }
    return false;
  };
  const observation = observe();
  try {
    await Promise.race([pause, observation]);
    o.signal?.throwIfAborted();
    const current = await client.signinStatus();
    return current.users.some(user => user.id === invited.user.id && user.passkeyRegistered === true)
      ? [{ name, verdict: 'done', detail: `users mode; ${invited.user.name} passkey registered` }] : [pending];
  } catch (error) {
    o.signal?.throwIfAborted();
    if (error instanceof Cancelled) throw error;
    return [pending];
  } finally {
    stop.abort();
    await Promise.allSettled([pause, observation]);
  }
};
