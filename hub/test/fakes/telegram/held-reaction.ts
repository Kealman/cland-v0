import { TelegramApi, type TelegramApiOptions, type SetMessageReaction, type TelegramRequestOptions } from '../../../src/remote/telegram-api.ts';
import { TELEGRAM_TEST_TOKEN } from './fake-api.ts';

/** Hold only the completed HTTP receipt to select a native promise interleaving. */
export function heldTelegramReaction(options: TelegramApiOptions) {
  const completed = Promise.withResolvers<true>();
  const release = Promise.withResolvers<true>();
  const requests: Array<Promise<true>> = [];
  let active = 0, maximum = 0;
  class HeldReactionApi extends TelegramApi {
    override setMessageReaction(params: SetMessageReaction, requestOptions?: TelegramRequestOptions): Promise<true> {
      active++; maximum = Math.max(maximum, active);
      const sent = super.setMessageReaction(params, requestOptions);
      requests.push(sent);
      const result = params.reaction[0]?.emoji === '👌' ? release.promise : sent;
      if (params.reaction[0]?.emoji === '👌') void sent.then(completed.resolve, completed.reject);
      void result.then(() => { active--; }, () => { active--; });
      return result;
    }
  }
  return {
    api: new HeldReactionApi(TELEGRAM_TEST_TOKEN, options), completed: completed.promise,
    release: (receipt: true) => release.resolve(receipt), maximum: () => maximum,
    drain: () => Promise.allSettled(requests),
  };
}
