import type { MessengerFactory } from './configuration.ts';
import type { Clock } from '../hub/clock.ts';
import type { RemoteRedactor } from './redact.ts';
import { TelegramApi } from './telegram-api.ts';
import { TelegramRemote } from './telegram.ts';

/** Resolve platform roots from the daemon's environment, never a session's frames. */
export function messengerFactory(env: NodeJS.ProcessEnv, redactor: RemoteRedactor, clock: Clock): MessengerFactory {
  return (via, token) => {
    if (via !== 'telegram') throw new Error('Discord platform client is unavailable; an injected messenger factory is required');
    return new TelegramRemote(new TelegramApi(token, { redactor, clock,
      ...(env.CLAND_TELEGRAM_API_ROOT !== undefined ? { apiRoot: env.CLAND_TELEGRAM_API_ROOT } : {}),
    }), clock);
  };
}
